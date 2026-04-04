from __future__ import annotations

import json
import logging
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_repository_access, ensure_repository_access_by_id, get_current_user
from app.core.api_response import success_response
from app.core.config import settings
from app.db.database import get_db_session
from app.models.api_models import (
    ChatRequest,
    ChatResponse,
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


@router.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatResponse:
    if req.repository_id:
        repo_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repo_row = ensure_repository_access(session, str(req.repo_id), current_user["id"])
    try:
        service = QueryService(session)
        try:
            result = service.run(
                repository_id=repo_row["id"],
                repo_id=str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                query=req.query,
                user_id=str(current_user["id"]),
                project_id=str(repo_row["project_id"]) if repo_row.get("project_id") is not None else None,
            )
        except TypeError:
            # Allows unit tests (and any custom QueryService) that monkeypatch a simpler signature.
            result = service.run(
                repository_id=repo_row["id"],
                repo_id=str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                query=req.query,
            )
    except NoIndexedContextError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc
    except (LLMUnavailableError, EmptyLLMResponseError) as exc:
        logger.exception("Chat request failed repo_id=%s user_id=%s", req.repo_id, current_user["id"])
        detail = "AI service is temporarily unavailable. Please retry shortly."
        if str(settings.app_env).lower() != "production":
            detail = str(exc)
        raise HTTPException(status_code=503, detail=detail) from exc
    except WorkflowExecutionError as exc:
        logger.exception("Chat workflow failed repo_id=%s user_id=%s", req.repo_id, current_user["id"])
        raise HTTPException(status_code=500, detail="Agent workflow failed. Please retry.") from exc
    except RuntimeError as exc:
        logger.exception("Chat request failed repo_id=%s user_id=%s", req.repo_id, current_user["id"])
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable. Please retry shortly.") from exc
    return success_response(
        ChatResponse(
            answer=result.get("answer", ""),
            intent=result.get("intent", "unknown"),
            sources=result.get("retrieved_context", []),
        ).model_dump()
    )


@router.post("/chat/stream")
def chat_stream(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> StreamingResponse:
    if req.repository_id:
        repo_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repo_row = ensure_repository_access(session, str(req.repo_id), current_user["id"])
    service = QueryService(session)

    try:
        try:
            result, assembled_context, cache_key, from_cache = service.prepare_generation(
                repo_row["id"],
                str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                req.query,
                user_id=str(current_user["id"]),
                project_id=str(repo_row["project_id"]) if repo_row.get("project_id") is not None else None,
            )
        except TypeError:
            result, assembled_context, cache_key, from_cache = service.prepare_generation(
                repo_row["id"],
                str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                req.query,
            )
    except NoIndexedContextError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (LLMUnavailableError, EmptyLLMResponseError) as exc:
        logger.exception("Streaming chat preparation failed repo_id=%s user_id=%s", req.repo_id, current_user["id"])
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable. Please retry shortly.") from exc
    except WorkflowExecutionError as exc:
        logger.exception("Streaming chat workflow failed repo_id=%s user_id=%s", req.repo_id, current_user["id"])
        raise HTTPException(status_code=500, detail="Agent workflow failed. Please retry.") from exc
    except RuntimeError as exc:
        logger.exception("Streaming chat preparation failed repo_id=%s user_id=%s", req.repo_id, current_user["id"])
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable. Please retry shortly.") from exc

    intent = str(result.get("intent", "unknown"))
    sources = result.get("retrieved_context", [])

    def _event_success(payload: dict) -> str:
        return json.dumps({"success": True, "data": payload, "error": None}) + "\n"

    def _event_error(message: str) -> str:
        return json.dumps({"success": False, "data": None, "error": message}) + "\n"

    def _iter_stream() -> Iterator[str]:
        yield _event_success({"type": "start", "intent": intent})

        if from_cache:
            cached_answer = str(result.get("answer", ""))
            if cached_answer:
                yield _event_success({"type": "chunk", "delta": cached_answer})
            yield _event_success({"type": "done", "intent": intent, "sources": sources})
            return

        generated_parts: list[str] = []
        try:
            for delta in service.model_router.stream_chat(prompt=req.query, context=assembled_context):
                if not delta:
                    continue
                generated_parts.append(delta)
                yield _event_success({"type": "chunk", "delta": delta})
        except RuntimeError as exc:
            logger.exception("Streaming chat failed repo_id=%s user_id=%s", req.repo_id, current_user["id"])
            message = "AI service is temporarily unavailable. Please retry shortly."
            if str(settings.app_env).lower() != "production":
                message = str(exc)
            yield _event_error(message)
            return

        result["answer"] = "".join(generated_parts)
        try:
            try:
                service.finalize_result(
                    repo_row["id"],
                    str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                    result,
                    cache_key,
                    user_id=str(current_user["id"]),
                    project_id=str(repo_row["project_id"]) if repo_row.get("project_id") is not None else None,
                )
            except TypeError:
                service.finalize_result(
                    repo_row["id"],
                    str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
                    result,
                    cache_key,
                )
        except RuntimeError:
            yield _event_error("AI service returned an empty response. Please retry.")
            return

        yield _event_success({"type": "done", "intent": intent, "sources": sources})

    return StreamingResponse(_iter_stream(), media_type="application/x-ndjson")


