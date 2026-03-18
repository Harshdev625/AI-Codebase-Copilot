from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_repository_access, get_current_user
from app.db.database import get_db_session
from app.models.api_models import (
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    CreateConversationRequest,
    MessageCreateRequest,
    MessageResponse,
)
from app.services.query_service import QueryService

router = APIRouter(tags=["chat"])


def _to_payload(row: dict) -> dict:
    payload = dict(row)
    created_at = payload.get("created_at")
    if created_at is not None and hasattr(created_at, "isoformat"):
        payload["created_at"] = created_at.isoformat()
    return payload


@router.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatResponse:
    ensure_repository_access(session, req.repo_id, current_user["id"])
    try:
        result = QueryService(session).run(repo_id=req.repo_id, query=req.query)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ChatResponse(
        answer=result.get("answer", ""),
        intent=result.get("intent", "unknown"),
        sources=result.get("retrieved_context", []),
    )


@router.post(
    "/projects/{project_id}/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    project_id: str,
    req: CreateConversationRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ConversationResponse:
    _ensure_membership(session, project_id, current_user["id"])

    conversation_id = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO conversations (id, project_id, user_id, title)
            VALUES (:id, :project_id, :user_id, :title)
            """
        ),
        {
            "id": conversation_id,
            "project_id": project_id,
            "user_id": current_user["id"],
            "title": req.title,
        },
    )
    session.commit()

    row = session.execute(
        text(
            """
            SELECT id, project_id, user_id, title, created_at
            FROM conversations
            WHERE id = :id
            """
        ),
        {"id": conversation_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=500, detail="Conversation creation failed")

    return ConversationResponse(**_to_payload(row))


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
def list_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> list[MessageResponse]:
    conv = _get_conversation(session, conversation_id)
    _ensure_membership(session, conv["project_id"], current_user["id"])

    rows = session.execute(
        text(
            """
            SELECT id, conversation_id, role, content, created_at
            FROM messages
            WHERE conversation_id = :conversation_id
            ORDER BY created_at ASC
            """
        ),
        {"conversation_id": conversation_id},
    ).mappings().all()
    return [MessageResponse(**_to_payload(row)) for row in rows]


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_message(
    conversation_id: str,
    req: MessageCreateRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> list[MessageResponse]:
    conv = _get_conversation(session, conversation_id)
    _ensure_membership(session, conv["project_id"], current_user["id"])

    user_message_id = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO messages (id, conversation_id, role, content)
            VALUES (:id, :conversation_id, 'user', :content)
            """
        ),
        {
            "id": user_message_id,
            "conversation_id": conversation_id,
            "content": req.query,
        },
    )

    run_id = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO agent_runs (id, conversation_id, user_id, project_id, repo_id, query, status)
            VALUES (:id, :conversation_id, :user_id, :project_id, :repo_id, :query, 'running')
            """
        ),
        {
            "id": run_id,
            "conversation_id": conversation_id,
            "user_id": current_user["id"],
            "project_id": conv["project_id"],
            "repo_id": req.repo_id,
            "query": req.query,
        },
    )
    session.commit()

    result = QueryService(session).run(repo_id=req.repo_id, query=req.query)
    answer = result.get("answer", "")
    intent = result.get("intent", "unknown")

    assistant_message_id = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO messages (id, conversation_id, role, content, metadata)
            VALUES (:id, :conversation_id, 'assistant', :content, CAST(:metadata AS jsonb))
            """
        ),
        {
            "id": assistant_message_id,
            "conversation_id": conversation_id,
            "content": answer,
            "metadata": json.dumps({"intent": intent}),
        },
    )
    session.execute(
        text(
            """
            UPDATE agent_runs
            SET status = 'completed',
                intent = :intent,
                diagnostics = CAST(:diagnostics AS jsonb),
                finished_at = NOW()
            WHERE id = :id
            """
        ),
        {
            "id": run_id,
            "intent": intent,
            "diagnostics": json.dumps({"source_count": len(result.get("retrieved_context", []))}),
        },
    )
    session.commit()

    rows = session.execute(
        text(
            """
            SELECT id, conversation_id, role, content, created_at
            FROM messages
            WHERE conversation_id = :conversation_id
            ORDER BY created_at DESC
            LIMIT 2
            """
        ),
        {
            "conversation_id": conversation_id,
        },
    ).mappings().all()

    ordered_rows = list(reversed(rows))
    return [MessageResponse(**_to_payload(row)) for row in ordered_rows]


def _get_conversation(session: Session, conversation_id: str) -> dict:
    row = session.execute(
        text("SELECT id, project_id FROM conversations WHERE id = :id"),
        {"id": conversation_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return dict(row)


def _ensure_membership(session: Session, project_id: str, user_id: str) -> None:
    membership = session.execute(
        text(
            """
            SELECT id
            FROM project_memberships
            WHERE project_id = :project_id AND user_id = :user_id
            """
        ),
        {"project_id": project_id, "user_id": user_id},
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not authorized for this project")
