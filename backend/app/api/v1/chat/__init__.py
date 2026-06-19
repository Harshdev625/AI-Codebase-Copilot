from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
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
from app.api.v1.chat_stream_helpers import (
    llm_status_events,
    pipeline_status_events,
    source_events,
)
from app.services.query_service import QueryService
from app.core.exceptions import ExternalServiceError, LLMRequestError, NoContextError
from app.llm.prompt_builder import BASE_SYSTEM_PROMPT
from app.llm.token_usage import extract_ollama_usage

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


_ECHO_PREFIXES = (
    "Context:",
    "Retrieved codebase sources",
    "Current user question:",
    "Graph analysis",
    "--- Retrieved codebase context",
)

_INSUFFICIENT_CONTEXT_ANSWER = (
    "The retrieved context does not contain enough information to answer this question. "
    "Try rephrasing your question or ensure the repository is fully indexed."
)


def _looks_like_prompt_echo(text: str) -> bool:
    """Detect when the model regurgitates the retrieval context instead of answering."""
    probe = text.strip()
    if not probe:
        return False
    for prefix in _ECHO_PREFIXES:
        if probe.startswith(prefix):
            return True
    if "Current user question:" in probe and "Source [S" in probe:
        return True
    if re.search(r"Source\s*\[S\d+\].*?\nCode:", probe, re.DOTALL | re.IGNORECASE):
        return True
    if probe.count("Source [S") >= 2:
        return True
    return False


def _is_unacceptable_answer(text: str) -> bool:
    probe = text.strip()
    if not probe:
        return True
    if _looks_like_prompt_echo(probe):
        return True
    if re.search(r"Source\s*\[S\d+\]\s*File:", probe):
        return True
    return False


def _session_usage_totals(service: QueryService, session_id: str | None) -> dict | None:
    if not session_id:
        return None
    row = service.session.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not row:
        return None
    meta = dict(row.session_metadata or {})
    return meta.get("usage_totals")


def _done_payload(
    *,
    intent: str,
    sources,
    result: dict,
    run_trace,
    service: QueryService,
    session_id: str | None,
) -> dict:
    return {
        "type": "done",
        "intent": intent,
        "sources": sources,
        "proposal": result.get("patch_proposal"),
        "trace": run_trace,
        "usage": (result.get("stats") or {}).get("usage"),
        "session_usage": _session_usage_totals(service, session_id),
    }


def _statuses_from_trace(run_trace: list) -> list[str]:
    statuses: list[str] = []
    for entry in run_trace:
        if isinstance(entry, dict):
            label = entry.get("label")
            if label:
                statuses.append(str(label))
    return statuses


def _session_metadata(row: ChatSession) -> dict:
    meta = getattr(row, "session_metadata", None)
    return dict(meta) if meta else {}


def _session_to_response(row: ChatSession) -> ChatSessionResponse:
    return ChatSessionResponse(
        id=str(row.id),
        repository_id=str(row.repository_id) if row.repository_id else None,
        session_title=str(row.session_title) if row.session_title else None,
        session_mode=str(row.session_mode),
        is_pinned=bool(row.is_pinned),
        is_archived=bool(row.is_archived),
        summary=str(row.summary) if row.summary else None,
        created_at=str(row.created_at),
        updated_at=str(row.updated_at),
        last_activity_at=str(row.last_activity_at),
        metadata=_session_metadata(row),
    )


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
    query = session.query(ChatSession).filter(
        ChatSession.user_id == str(current_user["id"]),
        ChatSession.is_deleted.is_(False),
    )
    if repository_id:
        query = query.filter(ChatSession.repository_id == repository_id)
    if is_archived is not None:
        query = query.filter(ChatSession.is_archived == is_archived)
    if search:
        from sqlalchemy import or_
        query = query.filter(
            or_(
                ChatSession.session_title.ilike(f"%{search}%"),
                ChatSession.summary.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    rows = (
        query.order_by(ChatSession.updated_at.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
        .all()
    )

    payload = [_session_to_response(r) for r in rows]
    return paginated_success_response(
        items=payload,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Returns a specific chat session."""
    r = (
        session.query(ChatSession)
        .filter(
            ChatSession.id == session_id,
            ChatSession.user_id == str(current_user["id"]),
            ChatSession.is_deleted.is_(False),
        )
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Session not found")

    return success_response(_session_to_response(r).model_dump())


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
        .filter(
            ChatSession.id == session_id,
            ChatSession.user_id == str(current_user["id"]),
            ChatSession.is_deleted.is_(False),
        )
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
    if req.session_mode is not None:
        chat_session.session_mode = req.session_mode
    if req.metadata is not None:
        current_meta = _session_metadata(chat_session)
        current_meta.update(req.metadata)
        chat_session.session_metadata = current_meta

    session.commit()
    session.refresh(chat_session)
    return success_response(_session_to_response(chat_session).model_dump())


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
        .filter(
            ChatSession.id == session_id,
            ChatSession.user_id == str(current_user["id"]),
            ChatSession.is_deleted.is_(False),
        )
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
    """Soft-deletes a chat session (hidden from lists; messages retained)."""
    chat_session = (
        session.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == str(current_user["id"]))
        .first()
    )
    if not chat_session or chat_session.is_deleted:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    chat_session.is_deleted = True
    chat_session.deleted_at = now
    chat_session.is_archived = True
    session.commit()
    return success_response({"deleted": True, "soft": True})


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
            attached_files=req.attached_files,
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

    result: dict | None = None
    assembled_context = ""
    cache_key = ""
    from_cache = False
    run_trace: list = []
    sources: list = []
    intent = "unknown"
    stream_statuses: list[str] = []
    deterministic_answer = None
    graph_streamed_live = False

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
        """Stream LangGraph trace updates, retrieval sources, then LLM answer tokens."""
        nonlocal result, assembled_context, cache_key, from_cache, run_trace, sources, intent
        nonlocal stream_statuses, deterministic_answer, graph_streamed_live
        stream_started = False
        try:
            yield _event_success({"type": "start", "intent": intent, "session_id": active_session_id})
            stream_started = True

            try:
                async for pipeline_event in service.stream_generation_pipeline(
                    active_repository_id,
                    active_repo_id,
                    req.query,
                    user_id=str(current_user["id"]),
                    session_id=active_session_id,
                    federated=False,
                    scope_paths=req.scope_paths,
                    attached_files=req.attached_files,
                    chat_mode=req.mode,
                ):
                    event_type = pipeline_event.get("type")
                    if event_type == "trace_step":
                        graph_streamed_live = True
                        entry = pipeline_event.get("entry")
                        if isinstance(entry, dict):
                            run_trace.append(entry)
                            detail = entry.get("detail") if isinstance(entry.get("detail"), dict) else {}
                            if entry.get("node") == "planner" and detail.get("intent"):
                                intent = str(detail.get("intent"))
                            for payload in pipeline_status_events(entry):
                                if payload.get("type") == "status":
                                    stream_statuses.append(str(payload.get("step") or ""))
                                yield _event_success(payload)
                    elif event_type == "source":
                        source = pipeline_event.get("source")
                        if isinstance(source, dict):
                            sources.append(source)
                            yield _event_success({"type": "source", "source": source})
                    elif event_type == "complete":
                        result = dict(pipeline_event.get("result") or {})
                        assembled_context = str(pipeline_event.get("assembled_context") or "")
                        cache_key = str(pipeline_event.get("cache_key") or "")
                        from_cache = bool(pipeline_event.get("from_cache"))
                        run_trace = list(result.get("run_trace") or run_trace)
                        sources = list(result.get("retrieved_context") or sources)
                        intent = str(result.get("intent", intent))
            except NoContextError as exc:
                yield _event_error(str(exc), "no_context")
                return

            if result is None:
                yield _event_error("Generation pipeline returned no result", "pre_stream_error")
                return

            if from_cache or not graph_streamed_live:
                for entry in run_trace:
                    if isinstance(entry, dict):
                        for payload in pipeline_status_events(entry):
                            if payload.get("type") == "status":
                                label = str(payload.get("step") or "")
                                if label and label not in stream_statuses:
                                    stream_statuses.append(label)
                            yield _event_success(payload)
                for payload in source_events(sources):
                    yield _event_success(payload)

            build_deterministic = getattr(service, "build_deterministic_answer", None)
            if not from_cache and callable(build_deterministic):
                deterministic_answer = build_deterministic(req.query, result)
            if deterministic_answer is not None:
                result["answer"] = deterministic_answer
                result["query"] = req.query
                await service.finalize_result(
                    active_repository_id,
                    active_repo_id,
                    result,
                    cache_key,
                    user_id=str(current_user["id"]),
                    session_id=active_session_id,
                    query=req.query,
                    display_query=req.display_query,
                    scope_paths=req.scope_paths,
                )

            if from_cache:
                try:
                    result["query"] = req.query
                    await service.finalize_result(
                        active_repository_id,
                        active_repo_id,
                        result,
                        cache_key,
                        user_id=str(current_user["id"]),
                        session_id=active_session_id,
                        query=req.query,
                        display_query=req.display_query,
                        scope_paths=req.scope_paths,
                    )
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
                    result["query"] = req.query
                    await service.finalize_result(
                        active_repository_id,
                        active_repo_id,
                        result,
                        cache_key,
                        user_id=str(current_user["id"]),
                        session_id=active_session_id,
                        query=req.query,
                        display_query=req.display_query,
                        scope_paths=req.scope_paths,
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
            pending_probe: list[str] = []
            started_yielding = False
            used_non_stream_fallback = False

            async def _fallback_non_stream() -> str:
                llm_answer, usage = await service._get_llm_answer_with_timeout(
                    req.query,
                    assembled_context,
                    mode="single",
                )
                result["stats"] = {"usage": usage}
                if _is_unacceptable_answer(llm_answer):
                    return _INSUFFICIENT_CONTEXT_ANSWER
                return llm_answer

            for payload in llm_status_events():
                if payload.get("type") == "status":
                    stream_statuses.append(str(payload.get("step") or ""))
                yield _event_success(payload)
            result["stream_statuses"] = stream_statuses

            try:
                stream_iter = service.model_router.stream_chat(
                    prompt=req.query,
                    context=assembled_context,
                    system_prompt=BASE_SYSTEM_PROMPT,
                )
                for delta in stream_iter:
                    try:
                        if not delta:
                            continue
                        if not started_yielding:
                            pending_probe.append(delta)
                            probe_text = "".join(pending_probe)
                            if len(probe_text.strip()) >= 12 and _looks_like_prompt_echo(probe_text):
                                logger.warning(
                                    "chat_stream - prompt echo detected; retrying with non-stream chat"
                                )
                                llm_answer = await _fallback_non_stream()
                                used_non_stream_fallback = True
                                generated_parts = [llm_answer]
                                chunk_size = 48
                                for i in range(0, len(llm_answer), chunk_size):
                                    piece = llm_answer[i : i + chunk_size]
                                    yield _event_success({"type": "chunk", "delta": piece})
                                break
                            starts_with_echo_prefix = any(
                                probe_text.lstrip().startswith(p) for p in _ECHO_PREFIXES
                            )
                            if not starts_with_echo_prefix and len(probe_text) >= 8:
                                started_yielding = True
                                for piece in pending_probe:
                                    generated_parts.append(piece)
                                    yield _event_success({"type": "chunk", "delta": piece})
                                pending_probe = []
                            elif len(probe_text) >= 160:
                                logger.warning(
                                    "chat_stream - 160-char echo prefix buffer hit; forcing non-stream fallback"
                                )
                                llm_answer = await _fallback_non_stream()
                                used_non_stream_fallback = True
                                generated_parts = [llm_answer]
                                chunk_size = 48
                                for i in range(0, len(llm_answer), chunk_size):
                                    piece = llm_answer[i : i + chunk_size]
                                    yield _event_success({"type": "chunk", "delta": piece})
                                break
                            continue
                        generated_parts.append(delta)
                        yield _event_success({"type": "chunk", "delta": delta})
                    except Exception:
                        logger.exception("chat_stream - error yielding delta")
                        continue
                if pending_probe and not started_yielding and not used_non_stream_fallback:
                    joined = "".join(pending_probe)
                    if _looks_like_prompt_echo(joined):
                        logger.warning(
                            "chat_stream - prompt echo detected at stream end; retrying with non-stream chat"
                        )
                        llm_answer = await _fallback_non_stream()
                        generated_parts = [llm_answer]
                        chunk_size = 48
                        for i in range(0, len(llm_answer), chunk_size):
                            piece = llm_answer[i : i + chunk_size]
                            yield _event_success({"type": "chunk", "delta": piece})
                    else:
                        for piece in pending_probe:
                            generated_parts.append(piece)
                            yield _event_success({"type": "chunk", "delta": piece})
            except asyncio.CancelledError:
                logger.info("chat_stream - client disconnected during LLM stream")
                raise
            except Exception as stream_exc:
                logger.exception("chat_stream - error in model_router.stream_chat")
                if generated_parts:
                    yield _event_error(
                        "Stream interrupted: response may be incomplete",
                        "stream_interrupted",
                    )
                else:
                    yield _event_error(str(stream_exc), "llm_stream_error")
                return

            final_answer = "".join(generated_parts).strip()
            if _is_unacceptable_answer(final_answer):
                final_answer = _INSUFFICIENT_CONTEXT_ANSWER
                generated_parts = [final_answer]

            chat_mode = str(req.mode or "ASK").upper()
            if chat_mode == "ACT":
                patch_text = service.extract_patch_from_text(final_answer)
                if patch_text:
                    result["patch"] = patch_text
                    proposal = service._build_patch_proposal_from_state(result)
                    if proposal:
                        result["patch_proposal"] = proposal

            usage = service.model_router.consume_stream_usage()
            if not usage.get("total_tokens"):
                usage = extract_ollama_usage(
                    {},
                    prompt_text=f"{req.query}\n{assembled_context}",
                    completion_text=final_answer,
                )
            result["stats"] = {"usage": usage}

            # H6 FIX: Finalize result with error recovery
            try:
                result["answer"] = final_answer
                result["stream_statuses"] = stream_statuses
                result["query"] = req.query
                await service.finalize_result(
                    active_repository_id,
                    active_repo_id,
                    result,
                    cache_key,
                    user_id=str(current_user["id"]),
                    session_id=active_session_id,
                    query=req.query,
                    display_query=req.display_query,
                    scope_paths=req.scope_paths,
                )
            except Exception:
                logger.exception("chat_stream - error finalizing result")
                pass

            yield _event_success(
                _done_payload(
                    intent=intent,
                    sources=sources,
                    result=result,
                    run_trace=run_trace,
                    service=service,
                    session_id=active_session_id,
                )
                | ({"proposal": result.get("patch_proposal")} if result.get("patch_proposal") else {})
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


