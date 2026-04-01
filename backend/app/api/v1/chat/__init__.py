from __future__ import annotations

import json
import logging
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_repository_access, get_current_user
from app.core.api_response import success_response
from app.db.database import get_db_session
from app.models.api_models import (
    ChatRequest,
    ChatResponse,
)
from app.services.query_service import QueryService

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


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
    ensure_repository_access(session, req.repo_id, current_user["id"])
    service = QueryService(session)

    try:
        result, assembled_context, cache_key, from_cache = service.prepare_generation(req.repo_id, req.query)
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
        except RuntimeError:
            logger.exception("Streaming chat failed repo_id=%s user_id=%s", req.repo_id, current_user["id"])
            yield _event_error("AI service is temporarily unavailable. Please retry shortly.")
            return

        result["answer"] = "".join(generated_parts)
        try:
            service.finalize_result(req.repo_id, result, cache_key)
        except RuntimeError:
            yield _event_error("AI service returned an empty response. Please retry.")
            return

        yield _event_success({"type": "done", "intent": intent, "sources": sources})

    return StreamingResponse(_iter_stream(), media_type="application/x-ndjson")


