from __future__ import annotations

import json
import logging
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import (
    PaginationParams,
    ensure_repository_access,
    ensure_repository_access_by_id,
    get_current_user,
    get_pagination,
)
from app.core.api_response import paginated_success_response, success_response
from app.core.config import settings
from app.db.database import get_db_session
from app.models.api_models import (
    ChatRequest,
    ChatResponse,
    ChatSessionResponse,
    ChatMessageResponse,
)
from app.services.query_service import QueryService
from app.services.query_service import (
    EmptyLLMResponseError,
    LLMUnavailableError,
    NoIndexedContextError,
    WorkflowExecutionError,
)

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


@router.get("/sessions")
def list_sessions(
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    """Returns all chat sessions for the current user."""
    total = int(
        session.execute(
            text("SELECT COUNT(*) FROM chat_sessions WHERE user_id = :user_id"),
            {"user_id": current_user["id"]},
        ).scalar()
        or 0
    )
    rows = session.execute(
        text(
            """
            SELECT *
            FROM chat_sessions
            WHERE user_id = :user_id
            ORDER BY updated_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            "user_id": current_user["id"],
            "limit": pagination.limit,
            "offset": pagination.offset,
        },
    ).fetchall()

    payload = [
        ChatSessionResponse(
            id=str(r.id),
            project_id=str(r.project_id),
            repository_id=str(r.repository_id) if r.repository_id else None,
            title=str(r.title) if r.title else None,
            summary=str(r.summary) if r.summary else None,
            created_at=str(r.created_at),
            updated_at=str(r.updated_at),
        ) for r in rows
    ]
    return paginated_success_response(
        items=payload,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    """Returns full history for a specific chat thread."""
    # Security check
    row = session.execute(
        text("SELECT id FROM chat_sessions WHERE id = :id AND user_id = :user_id"),
        {"id": session_id, "user_id": current_user["id"]}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    total = int(
        session.execute(
            text("SELECT COUNT(*) FROM messages WHERE chat_session_id = :sid"),
            {"sid": session_id},
        ).scalar()
        or 0
    )

    rows = session.execute(
        text(
            """
            SELECT *
            FROM messages
            WHERE chat_session_id = :sid
            ORDER BY created_at ASC
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            "sid": session_id,
            "limit": pagination.limit,
            "offset": pagination.offset,
        },
    ).fetchall()

    payload = [
        ChatMessageResponse(
            id=str(r.id),
            role=str(r.role),
            content=str(r.content),
            metadata=dict(r.metadata or {}),
            created_at=str(r.created_at),
        ) for r in rows
    ]
    return paginated_success_response(
        items=payload,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
):
    """Deletes a chat session and all its messages."""
    session.execute(
        text("DELETE FROM chat_sessions WHERE id = :id AND user_id = :user_id"),
        {"id": session_id, "user_id": current_user["id"]}
    )
    session.commit()
    return success_response({"deleted": True})


@router.post("", response_model=ChatResponse)
@router.post("/chat", response_model=ChatResponse, include_in_schema=False)
def chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatResponse:
    logger.info(
        "chat - request received user_id=%s repository_id=%s",
        current_user["id"],
        req.repository_id,
    )
    if req.repository_id:
        repo_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repo_row = ensure_repository_access(session, str(req.repo_id), current_user["id"])
    
    try:
        service = QueryService(session)
        project_id = str(repo_row["project_id"]) if repo_row.get("project_id") is not None else None
        try:
            result = service.run(
                repository_id=repo_row["id"],
                repo_id=str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                query=req.query,
                user_id=str(current_user["id"]),
                project_id=project_id,
                session_id=req.session_id,
            )
        except TypeError:
            # Backward compatibility for tests and legacy service signatures.
            result = service.run(
                repository_id=repo_row["id"],
                repo_id=str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                query=req.query,
            )
    except NoIndexedContextError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except (LLMUnavailableError, EmptyLLMResponseError) as exc:
        raise HTTPException(status_code=503, detail="AI service unavailable.")
    except Exception as exc:
        logger.exception("Chat failed")
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable. Please retry shortly.")

    return success_response(
        ChatResponse(
            answer=result.get("answer", ""),
            intent=result.get("intent", "unknown"),
            session_id=str(result.get("session_id") or req.session_id or ""),
            sources=result.get("retrieved_context", []),
        ).model_dump()
    )


@router.post("/stream")
@router.post("/chat/stream", include_in_schema=False)
def chat_stream(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> StreamingResponse:
    logger.info(
        "chat_stream - request user_id=%s repository_id=%s",
        current_user["id"],
        req.repository_id,
    )
    if req.repository_id:
        repo_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repo_row = ensure_repository_access(session, str(req.repo_id), current_user["id"])
    
    service = QueryService(session)
    project_id = str(repo_row["project_id"]) if repo_row.get("project_id") is not None else None
    active_session_id = req.session_id
    ensure_session = getattr(service, "_ensure_session", None)
    if callable(ensure_session) and project_id is not None:
        active_session_id = ensure_session(
            req.session_id,
            str(current_user["id"]),
            project_id,
            str(repo_row["id"]),
        )

    try:
        try:
            result, assembled_context, cache_key, from_cache = service.prepare_generation(
                repo_row["id"],
                str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                req.query,
                user_id=str(current_user["id"]),
                project_id=project_id,
                session_id=active_session_id,
            )
        except TypeError:
            # Test doubles may expose the older prepare_generation signature.
            result, assembled_context, cache_key, from_cache = service.prepare_generation(
                repo_row["id"],
                str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                req.query,
            )
    except NoIndexedContextError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    intent = str(result.get("intent", "unknown"))
    sources = result.get("retrieved_context", [])
    deterministic_answer = None
    build_deterministic = getattr(service, "build_deterministic_answer", None)
    if not from_cache and callable(build_deterministic):
        deterministic_answer = build_deterministic(req.query, result)
    if deterministic_answer is not None:
        result["answer"] = deterministic_answer
        service.finalize_result(
            repo_row["id"],
            str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
            result,
            cache_key,
            user_id=str(current_user["id"]),
            project_id=project_id,
            session_id=active_session_id,
        )

    def _event_success(payload: dict) -> str:
        return json.dumps({"success": True, "data": payload, "error": None}) + "\n"

    def _iter_stream() -> Iterator[str]:
        yield _event_success({"type": "start", "intent": intent, "session_id": active_session_id})

        if from_cache:
            yield _event_success({"type": "chunk", "delta": str(result.get("answer", ""))})
            yield _event_success({"type": "done", "intent": intent, "sources": sources})
            return

        if deterministic_answer is not None:
            yield _event_success({"type": "chunk", "delta": deterministic_answer})
            yield _event_success({"type": "done", "intent": intent, "sources": sources})
            return

        generated_parts: list[str] = []
        try:
            for delta in service.model_router.stream_chat(prompt=req.query, context=assembled_context):
                if not delta: continue
                generated_parts.append(delta)
                yield _event_success({"type": "chunk", "delta": delta})
        except Exception:
            yield json.dumps({"success": False, "error": "Streaming failed"}) + "\n"
            return

        result["answer"] = "".join(generated_parts)
        service.finalize_result(
            repo_row["id"],
            str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
            result,
            cache_key,
            user_id=str(current_user["id"]),
            project_id=project_id,
            session_id=active_session_id,
        )
        yield _event_success({"type": "done", "intent": intent, "sources": sources})

    return StreamingResponse(_iter_stream(), media_type="application/x-ndjson")


