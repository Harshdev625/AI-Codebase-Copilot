from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import (
    PaginationParams,
    assert_scopes,
    ensure_repository_access,
    ensure_repository_access_by_id,
    get_current_user,
    get_pagination,
)
from app.core.api_response import paginated_success_response, success_response
from app.db.database import get_db_session
from app.db.models import ChatSession, Message
from app.models.api_models import (
    ChatRequest,
    ChatResponse,
    ChatSessionResponse,
    ChatMessageResponse,
    ApplyPatchRequest,
    ChatSessionUpdateRequest,
)
from app.services.query_service import QueryService
from app.core.exceptions import ExternalServiceError, LLMRequestError, NoContextError

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


@router.get("/sessions")
def list_sessions(
    repository_id: str | None = None,
    search: str | None = None,
    is_archived: bool | None = None,
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    """Returns all chat sessions for the current user, optionally filtered by repository."""
    query = session.query(ChatSession).filter(ChatSession.user_id == str(current_user["id"]))
    if repository_id:
        query = query.filter(ChatSession.repository_id == repository_id)
    if is_archived is not None:
        query = query.filter(ChatSession.is_archived == is_archived)
    if search:
        query = query.filter(ChatSession.session_title.ilike(f"%{search}%"))

    total = query.count()
    rows = (
        query.order_by(ChatSession.updated_at.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
        .all()
    )

    payload = [
        ChatSessionResponse(
            id=str(r.id),
            repository_id=str(r.repository_id) if r.repository_id else None,
            session_title=str(r.session_title) if r.session_title else None,
            session_mode=str(r.session_mode),
            is_pinned=bool(r.is_pinned),
            is_archived=bool(r.is_archived),
            summary=str(r.summary) if r.summary else None,
            created_at=str(r.created_at),
            updated_at=str(r.updated_at),
            last_activity_at=str(r.last_activity_at),
        ) for r in rows
    ]
    return paginated_success_response(
        items=payload,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.patch("/sessions/{session_id}")
def update_session(
    session_id: str,
    req: ChatSessionUpdateRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Updates session metadata like title, pinned status, and archived status."""
    chat_session = (
        session.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == str(current_user["id"]))
        .first()
    )
    if not chat_session:
        raise HTTPException(status_code=404, detail="Session not found")

    if req.session_title is not None:
        chat_session.session_title = req.session_title
    if req.is_pinned is not None:
        chat_session.is_pinned = req.is_pinned
    if req.is_archived is not None:
        chat_session.is_archived = req.is_archived

    session.commit()
    session.refresh(chat_session)
    return success_response({
        "id": chat_session.id,
        "session_title": chat_session.session_title,
        "is_pinned": chat_session.is_pinned,
        "is_archived": chat_session.is_archived
    })


@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    """Returns full history for a specific chat thread."""
    # Security check
    chat_session = (
        session.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == str(current_user["id"]))
        .first()
    )
    if not chat_session:
        raise HTTPException(status_code=404, detail="Session not found")

    total = session.query(Message).filter(Message.chat_session_id == session_id).count()
    rows = (
        session.query(Message)
        .filter(Message.chat_session_id == session_id)
        .order_by(Message.created_at.asc())
        .limit(pagination.limit)
        .offset(pagination.offset)
        .all()
    )

    payload = [
        ChatMessageResponse(
            id=str(r.id),
            role=str(r.role),
            content=str(r.content),
            metadata=dict(r.msg_metadata or {}),
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
    # PHASE 2 FIX: Check existence BEFORE attempting delete to avoid unnecessary rollback
    exists = (
        session.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == str(current_user["id"]))
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Session not found")
    session.query(ChatSession).filter(ChatSession.id == session_id).delete(synchronize_session=False)
    session.commit()
    return success_response({"deleted": True})


@router.post("/apply-patch")
def apply_patch(
    req: ApplyPatchRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Applies a patch proposal diff directly to the local codebase."""
    assert_scopes(current_user, {"chat:query"})
    
    if req.repository_id:
        repo_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repo_row = ensure_repository_access(session, str(req.repo_id), current_user["id"])
        
    local_path = repo_row.get("local_path")
    if not local_path:
        raise HTTPException(status_code=400, detail="Cannot apply patches to remote-only repositories.")
        
    from app.utils.diff_utils import apply_diff_to_codebase
    from pathlib import Path
    
    repo_path = Path(local_path).resolve()
    try:
        apply_diff_to_codebase(repo_path, req.diff)
        return success_response({"applied": True, "message": "Patch applied successfully."})
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("", response_model=ChatResponse)
@router.post("/chat", response_model=ChatResponse, include_in_schema=False)
async def chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatResponse:
    assert_scopes(current_user, {"chat:query"})
    logger.info(
        "chat - request received user_id=%s repository_id=%s",
        current_user["id"],
        req.repository_id,
    )

    try:
        service = QueryService(session)
        if req.repository_id:
            repo_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
        else:
            repo_row = ensure_repository_access(session, str(req.repo_id), current_user["id"])
        result = await service.run(
            repository_id=repo_row["id"],
            repo_id=str(repo_row.get("repo_id") or req.repo_id or repo_row["id"]),
            query=req.query,
            user_id=str(current_user["id"]),
            session_id=req.session_id,
            federated=False,
            scope_paths=req.scope_paths,
            chat_mode=req.mode,
        )
    except NoContextError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except HTTPException:
        raise
    except (LLMRequestError, ExternalServiceError):
        raise HTTPException(status_code=503, detail="AI service unavailable.")
    except Exception as exc:
        logger.exception("Chat failed")
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable. Please retry shortly.") from exc

    return success_response(
        ChatResponse(
            answer=result.get("answer", ""),
            intent=result.get("intent", "unknown"),
            session_id=str(result.get("session_id") or req.session_id or ""),
            sources=[
                *list(result.get("retrieved_context", []) or []),
                *([
                    {
                        "kind": "patch_proposal",
                        "proposal": result.get("patch_proposal"),
                    }
                ] if result.get("patch_proposal") else []),
            ],
        ).model_dump()
    )


@router.post("/stream")
@router.post("/chat/stream", include_in_schema=False)
async def chat_stream(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> StreamingResponse:
    assert_scopes(current_user, {"chat:query"})
    logger.info(
        "chat_stream - request user_id=%s repository_id=%s",
        current_user["id"],
        req.repository_id,
    )

    service = QueryService(session)
    active_repository_id: str | None = None
    active_repo_id: str | None = None
    if req.repository_id:
        repo_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repo_row = ensure_repository_access(session, str(req.repo_id), current_user["id"])
    active_repository_id = str(repo_row["id"])
    active_repo_id = str(repo_row.get("repo_id") or req.repo_id or repo_row["id"])

    # FIX: Ensure a session exists and is persisted before streaming
    active_session_id = await service._ensure_session(
        req.session_id, str(current_user["id"]), active_repository_id
    )

    try:
        result, assembled_context, cache_key, from_cache = await service.prepare_generation(
            active_repository_id,
            active_repo_id,
            req.query,
            user_id=str(current_user["id"]),
            session_id=active_session_id,
            federated=False,
            scope_paths=req.scope_paths,
            chat_mode=req.mode,
        )
    except NoContextError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    intent = str(result.get("intent", "unknown"))
    sources = result.get("retrieved_context", [])
    deterministic_answer = None
    build_deterministic = getattr(service, "build_deterministic_answer", None)
    if not from_cache and callable(build_deterministic):
        deterministic_answer = build_deterministic(req.query, result)
    if deterministic_answer is not None:
        result["answer"] = deterministic_answer
        await service.finalize_result(
            active_repository_id,
            active_repo_id,
            result,
            cache_key,
            user_id=str(current_user["id"]),
            session_id=active_session_id,
        )

    def _event_success(payload: dict, event_type: str = "message") -> str:
        # True SSE format
        data_str = json.dumps({"success": True, "data": payload, "error": None})
        return f"event: {event_type}\ndata: {data_str}\n\n"

    def _event_error(error_msg: str, error_type: str = "stream_error") -> str:
        """Format error event for streaming response in SSE format."""
        data_str = json.dumps({
            "success": False,
            "data": {"type": error_type, "error": error_msg},
            "error": error_msg,
        })
        return f"event: error\ndata: {data_str}\n\n"

    async def _iter_stream() -> AsyncIterator[str]:
        """H6 FIX: Improved streaming with error recovery and proper error signaling."""
        stream_started = False
        try:
            yield _event_success({"type": "start", "intent": intent, "session_id": active_session_id})
            stream_started = True

            if from_cache:
                try:
                    yield _event_success({"type": "chunk", "delta": str(result.get("answer", ""))})
                    yield _event_success(
                        {
                            "type": "done",
                            "intent": intent,
                            "sources": sources,
                            "proposal": result.get("patch_proposal"),
                            "trace": result.get("run_trace", []),
                        }
                    )
                    return
                except Exception as exc:
                    logger.exception("chat_stream - error streaming cached result")
                    yield _event_error("Failed to stream cached response", "cache_error")
                    return

            if deterministic_answer is not None:
                try:
                    yield _event_success({"type": "chunk", "delta": deterministic_answer})
                    yield _event_success(
                        {
                            "type": "done",
                            "intent": intent,
                            "sources": sources,
                            "proposal": result.get("patch_proposal"),
                            "trace": result.get("run_trace", []),
                        }
                    )
                    return
                except Exception as exc:
                    logger.exception("chat_stream - error streaming deterministic answer")
                    yield _event_error("Failed to stream deterministic answer", "deterministic_error")
                    return

            if result.get("patch_proposal"):
                try:
                    yield _event_success({"type": "chunk", "delta": str(result.get("answer", "Patch proposal ready."))})
                    await service.finalize_result(
                        active_repository_id,
                        active_repo_id,
                        result,
                        cache_key,
                        user_id=str(current_user["id"]),
                        session_id=active_session_id,
                    )
                    yield _event_success(
                        {
                            "type": "done",
                            "intent": intent,
                            "sources": sources,
                            "proposal": result.get("patch_proposal"),
                            "trace": result.get("run_trace", []),
                        }
                    )
                    return
                except Exception as exc:
                    logger.exception("chat_stream - error streaming patch proposal")
                    yield _event_error("Failed to stream patch proposal", "proposal_error")
                    return

            # H6 FIX: Stream LLM response with per-delta error recovery
            generated_parts: list[str] = []
            try:
                for delta in service.model_router.stream_chat(prompt=req.query, context=assembled_context):
                    try:
                        if not delta:
                            continue
                        generated_parts.append(delta)
                        yield _event_success({"type": "chunk", "delta": delta})
                    except Exception as delta_exc:
                        logger.exception("chat_stream - error yielding delta")
                        # Continue collecting deltas; error won't stop streaming
                        continue
            except asyncio.CancelledError:
                logger.info("chat_stream - client disconnected during LLM stream")
                raise
            except Exception as stream_exc:
                logger.exception("chat_stream - error in model_router.stream_chat")
                if generated_parts:
                    # Partial response already sent; send error to indicate incomplete
                    yield _event_error(
                        "Stream interrupted: response may be incomplete",
                        "stream_interrupted",
                    )
                else:
                    # No data sent yet; send full error
                    yield _event_error(str(stream_exc), "llm_stream_error")
                return

            # H6 FIX: Finalize result with error recovery
            try:
                result["answer"] = "".join(generated_parts)
                await service.finalize_result(
                    active_repository_id,
                    active_repo_id,
                    result,
                    cache_key,
                    user_id=str(current_user["id"]),
                    session_id=active_session_id,
                )
            except Exception as finalize_exc:
                logger.exception("chat_stream - error finalizing result")
                # Still send completion even if finalization fails
                pass

            yield _event_success(
                {
                    "type": "done",
                    "intent": intent,
                    "sources": sources,
                    "proposal": result.get("patch_proposal"),
                    "trace": result.get("run_trace", []),
                }
            )
        except asyncio.CancelledError:
            logger.info("chat_stream - client disconnected, cancelling stream")
            raise
        except Exception as exc:
            # H6 FIX: Outer catch-all for unexpected errors
            logger.exception("chat_stream - unexpected error in iterator")
            if stream_started:
                # Stream has begun; send error event
                yield _event_error("Unexpected streaming error", "unexpected_error")
            else:
                # Stream not started; error before first yield
                yield _event_error(str(exc), "pre_stream_error")
        finally:
            # Session lifecycle is managed by FastAPI DI (get_db_session generator)
            logger.debug("chat_stream - stream completed")

    return StreamingResponse(
        _iter_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


