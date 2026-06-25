from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.graph.workflow import compiled_graph
from app.llm.model_router import get_model_router
from app.llm.prompt_builder import BASE_SYSTEM_PROMPT, build_context_packet, get_system_prompt_for_mode
from app.llm.token_usage import extract_ollama_usage, merge_usage_totals
from app.observability.metrics import runtime_metrics
from app.rag.retrieval.service import get_retrieval_service
from app.services.cache_service import get_cache_service
from app.core.exceptions import (
    DatabaseException,
    ExternalServiceError,
    NoContextError,
    LLMRequestError,
    WorkflowError,
)
from app.core.resilience import retry, circuit_breaker
from app.db.models import ChatSession, Repository


logger = logging.getLogger(__name__)

_DEBUG_LOG_PATH = "debug-16bbe5.log"
_DEBUG_SESSION_ID = "16bbe5"


def _agent_debug_log(
    *,
    location: str,
    message: str,
    data: dict,
    hypothesis_id: str,
    run_id: str = "act-run",
) -> None:
    # #region agent log
    try:
        payload = {
            "sessionId": _DEBUG_SESSION_ID,
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, default=str) + "\n")
    except Exception:
        pass
    # #endregion


class QueryService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.cache = get_cache_service()
        self.model_router = get_model_router()
        self.retrieval_service = get_retrieval_service(session)

    @retry(attempts=2, delay_seconds=1, retryable_exceptions=(ExternalServiceError,))
    async def run(
        self,
        repository_id: str | None,
        repo_id: str | None,
        query: str,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        federated: bool = False,
        scope_paths: list[str] | None = None,
        attached_files: list[str] | None = None,
        chat_mode: str = "ASK",
    ) -> dict:
        logger.info(
            "query_run - request received repository_id=%s repo_id=%s user_id=%s session_id=%s federated=%s",
            repository_id,
            repo_id,
            user_id,
            session_id,
            federated,
        )
        run_started = time.perf_counter()
        runtime_metrics.increment("query_run_total", mode="federated" if federated else "single")
        # Ensure session exists or create new one
        active_session_id = await self._ensure_session(session_id, user_id, repository_id)

        result, assembled_context, cache_key, from_cache = await self.prepare_generation(
            repository_id,
            repo_id,
            query,
            user_id=user_id,
            session_id=active_session_id,
            federated=federated,
            scope_paths=scope_paths,
            attached_files=attached_files,
            chat_mode=chat_mode,
        )
        if from_cache:
            logger.info("query_run - completed from cache repository_id=%s repo_id=%s", repository_id, repo_id)
            result["session_id"] = active_session_id
            runtime_metrics.increment("query_cache_hits_total", mode="federated" if federated else "single")
            runtime_metrics.observe_ms(
                "query_run_latency_ms",
                (time.perf_counter() - run_started) * 1000.0,
                mode="federated" if federated else "single",
                stage="cache",
            )
            return result

        patch_proposal = result.get("patch_proposal")
        if isinstance(patch_proposal, dict) and patch_proposal.get("diff"):
            result["answer"] = str(patch_proposal.get("summary") or "Patch proposal ready for review.")
            result["session_id"] = active_session_id
            return await self.finalize_result(
                repository_id,
                repo_id,
                result,
                cache_key,
                user_id=user_id,
                session_id=active_session_id,
            )

        deterministic_answer = self.build_deterministic_answer(query, result)
        if deterministic_answer is not None:
            result["answer"] = deterministic_answer
            result["session_id"] = active_session_id
            logger.info("query_run - deterministic answer used repository_id=%s", repository_id)
            runtime_metrics.observe_ms(
                "query_run_latency_ms",
                (time.perf_counter() - run_started) * 1000.0,
                mode="federated" if federated else "single",
                stage="deterministic",
            )
            return await self.finalize_result(
                repository_id,
                repo_id,
                result,
                cache_key,
                user_id=user_id,
                session_id=active_session_id,
            )

        try:
            llm_answer, usage = await self._get_llm_answer_with_timeout(
                query,
                assembled_context,
                mode="federated" if federated else "single",
                chat_mode=chat_mode,
            )
            result["stats"] = {"usage": usage}
        except (LLMRequestError, ExternalServiceError) as exc:
            if str(chat_mode).upper() in {"ACT", "PLAN"}:
                logger.exception(
                    "LLM call failed (no fallback for %s) repo_id=%s repository_id=%s",
                    chat_mode,
                    repo_id,
                    repository_id,
                )
                raise
            logger.exception("LLM call failed repo_id=%s repository_id=%s", repo_id, repository_id)
            runtime_metrics.increment("llm_chat_errors_total", mode="federated" if federated else "single")
            fallback = self._select_fallback_answer(query, result)
            result["answer"] = fallback
            result["_llm_fallback"] = True
            result["session_id"] = active_session_id
            result["intent"] = result.get("intent", "unknown")
            logger.warning(
                "query_run - fallback response used repo_id=%s repository_id=%s answer_chars=%s",
                repo_id,
                repository_id,
                len(fallback),
            )
            return await self.finalize_result(
                repository_id,
                repo_id,
                result,
                cache_key,
                user_id=user_id,
                session_id=active_session_id,
            )

        if not llm_answer or not llm_answer.strip():
            raise LLMRequestError("Language model returned an empty response")

        result["answer"] = llm_answer
        result["session_id"] = active_session_id

        if str(chat_mode).upper() == "ACT":
            patch_text = self.extract_patch_from_text(llm_answer)
            _agent_debug_log(
                location="query_service.py:run",
                message="ACT patch extraction result",
                data={
                    "patch_found": bool(patch_text),
                    "patch_chars": len(patch_text or ""),
                    "answer_chars": len(llm_answer or ""),
                },
                hypothesis_id="H3-extract-patch",
            )
            if patch_text:
                result["patch"] = patch_text
                proposal = self._build_patch_proposal_from_state(result)
                if proposal:
                    result["patch_proposal"] = proposal
        
        logger.debug(
            "query_run - model answer generated repository_id=%s repo_id=%s chars=%s",
            repository_id,
            repo_id,
            len(llm_answer),
        )
        runtime_metrics.observe_ms(
            "query_run_latency_ms",
            (time.perf_counter() - run_started) * 1000.0,
            mode="federated" if federated else "single",
            stage="llm",
        )
        return await self.finalize_result(
            repository_id,
            repo_id,
            result,
            cache_key,
            user_id=user_id,
            session_id=active_session_id,
        )

    @circuit_breaker(failure_threshold=3, recovery_timeout_seconds=300, service_name="LLM")
    async def _get_llm_answer_with_timeout(
        self,
        query: str,
        context: str,
        mode: str,
        *,
        chat_mode: str = "ASK",
    ) -> tuple[str, dict]:
        with runtime_metrics.timer("llm_chat_latency_ms", mode=mode):
            mode_upper = str(chat_mode).upper()
            system_prompt = get_system_prompt_for_mode(chat_mode)
            if mode_upper == "ACT":
                timeout_seconds = max(5.0, float(settings.ollama_act_timeout_seconds))
            elif mode_upper == "PLAN":
                timeout_seconds = max(5.0, float(settings.ollama_plan_timeout_seconds))
            else:
                timeout_seconds = max(5.0, float(settings.ollama_chat_timeout_seconds))
            try:
                completion = await asyncio.wait_for(
                    asyncio.to_thread(
                        self.model_router.chat,
                        prompt=query,
                        context=context,
                        system_prompt=system_prompt,
                        timeout_seconds=timeout_seconds,
                        allow_context_retry=mode_upper not in {"ACT", "PLAN"},
                    ),
                    timeout=timeout_seconds + 30.0,
                )
                answer_text = completion.text
                if mode_upper == "ACT":
                    _agent_debug_log(
                        location="query_service.py:_get_llm_answer_with_timeout",
                        message="ACT LLM response received",
                        data={
                            "answer_chars": len(answer_text or ""),
                            "answer_preview": (answer_text or "")[:500],
                            "system_prompt_kind": "ACT",
                            "context_chars": len(context or ""),
                        },
                        hypothesis_id="H1-system-prompt",
                    )
                return answer_text, dict(completion.usage or {})
            except asyncio.TimeoutError as exc:
                logger.warning("llm_chat - timeout after %s seconds", timeout_seconds)
                raise LLMRequestError(
                    f"Language model timed out after {timeout_seconds}s. "
                    f"For Act mode, increase OLLAMA_ACT_TIMEOUT_SECONDS or use a faster model."
                ) from exc
            except Exception as exc:
                msg = str(exc)
                if "timed out" in msg.lower():
                    logger.warning("llm_chat - ollama timeout after %ss mode=%s", timeout_seconds, chat_mode)
                    raise LLMRequestError(
                        f"Ollama timed out after {timeout_seconds}s. "
                        "Use a smaller/faster model, reduce plan scope, or raise OLLAMA_ACT_TIMEOUT_SECONDS."
                    ) from exc
                logger.exception("llm_chat - unexpected error")
                raise LLMRequestError(f"Language model request failed: {msg[:240]}") from exc

    async def prepare_generation(
        self,
        repository_id: str | None,
        repo_id: str | None,
        query: str,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        federated: bool = False,
        scope_paths: list[str] | None = None,
        attached_files: list[str] | None = None,
        chat_mode: str = "ASK",
    ) -> tuple[dict, str, str, bool]:
        logger.debug(
            "query_prepare - start repository_id=%s repo_id=%s user_id=%s session_id=%s",
            repository_id,
            repo_id,
            user_id,
            session_id,
        )
        # Load history specifically from the active session
        history = await self._load_session_history(session_id)
        history_hash = self._history_hash(history)

        normalized = query.strip().lower()
        query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
        mode_key = f"{chat_mode.upper()}:{('federated' if federated else 'single')}"
        scope_suffix = f":{'-'.join(sorted(scope_paths))}" if scope_paths else ""
        attached_suffix = f":{'-'.join(sorted(attached_files))}" if attached_files else ""
        scope_key = f"{repository_id}{scope_suffix}{attached_suffix}"
        cache_key = f"chat:v3:{mode_key}:{scope_key}:{query_hash}:{history_hash}"
        cached = self.cache.get_json(cache_key)
        if cached is not None:
            logger.debug("QueryService cache hit repo_id=%s repository_id=%s", repo_id, repository_id)
            return cached, "", cache_key, True

        if not repository_id or not repo_id:
            raise NoContextError("Repository context missing. Select a repository and retry.")

        mode_upper = str(chat_mode).upper()
        if mode_upper == "ACT":
            result = {
                "repo_id": repo_id,
                "repository_id": repository_id,
                "query": query,
                "retrieved_context": [],
                "run_trace": [{"node": "act_prepare", "label": "Skipped graph for ACT mode"}],
            }
            _agent_debug_log(
                location="query_service.py:prepare_generation",
                message="ACT path bypassing LangGraph",
                data={
                    "scope_paths": scope_paths or [],
                    "attached_files": attached_files or [],
                },
                hypothesis_id="H2-graph-bypass",
            )
        else:
            state = {
                "repo_id": repo_id,
                "repository_id": repository_id,
                "query": query,
                "session": self.session,
                "history": history,
                "scope_paths": scope_paths,
            }
            result = await self._invoke_graph_with_trace(state)
        result = await self._complete_after_graph(
            result,
            repository_id=repository_id,
            repo_id=repo_id,
            query=query,
            session_id=session_id,
            scope_paths=scope_paths,
            attached_files=attached_files,
            chat_mode=chat_mode,
            history=history,
        )
        logger.debug(
            "query_prepare - context assembled repository_id=%s snippets=%s context_chars=%s",
            repository_id,
            len(result.get("retrieved_context", [])[:6]),
            len(result.get("_assembled_context", "")),
        )
        assembled_context = str(result.pop("_assembled_context", ""))
        return result, assembled_context, cache_key, False

    async def _complete_after_graph(
        self,
        result: dict,
        *,
        repository_id: str,
        repo_id: str,
        query: str,
        session_id: str | None,
        scope_paths: list[str] | None,
        attached_files: list[str] | None,
        chat_mode: str,
        history: list[dict],
    ) -> dict:
        proposal = self._build_patch_proposal_from_state(result)
        if proposal:
            result["patch_proposal"] = proposal

        attached_snippets = self._load_attached_file_snippets(repository_id, attached_files)
        if attached_snippets:
            existing = list(result.get("retrieved_context") or [])
            result["retrieved_context"] = attached_snippets + existing

        mode_upper = str(chat_mode).upper()
        if not result.get("retrieved_context"):
            top_k = 4 if mode_upper == "ACT" else 8
            retrieval_scope = scope_paths if mode_upper != "ACT" else None
            retrieved = self.retrieval_service.retrieve_repository(
                repository_id=repository_id,
                query=query,
                top_k=top_k,
                scope_paths=retrieval_scope,
            )
            if not retrieved and scope_paths and mode_upper == "ACT":
                retrieved = self.retrieval_service.retrieve_repository(
                    repository_id=repository_id,
                    query=query,
                    top_k=top_k,
                    scope_paths=None,
                )
            if retrieved:
                result["retrieved_context"] = retrieved

        snippet_limit = 4 if mode_upper == "ACT" else 6
        snippets = result.get("retrieved_context", [])[:snippet_limit]
        if not snippets:
            _agent_debug_log(
                location="query_service.py:_complete_after_graph",
                message="ACT context assembly failed",
                data={
                    "chat_mode": chat_mode,
                    "attached_files": attached_files or [],
                    "attached_snippet_count": len(attached_snippets),
                    "scope_paths": scope_paths or [],
                },
                hypothesis_id="H6-context-missing",
            )
            logger.warning("query_prepare - no indexed context repository_id=%s repo_id=%s", repository_id, repo_id)
            if mode_upper == "ACT" and attached_files and not attached_snippets:
                raise NoContextError(
                    "ACT could not load plan target files from the repository workspace. "
                    "Revise the plan with full file paths (e.g. css/style.css) and retry."
                )
            raise NoContextError(
                "No indexed context found for this query. Index the repository first and retry."
            )

        assembled_context, source_index = build_context_packet(
            query=query,
            snippets=result.get("retrieved_context", []),
            history=history,
            chat_mode=chat_mode,
        )
        analysis = str(result.get("analysis") or "").strip()
        if analysis:
            analysis_summary = analysis[:500]
            assembled_context = (
                f"Graph analysis (guidance only — do not repeat verbatim):\n{analysis_summary}\n\n"
                f"{assembled_context}"
            )
        result["source_index"] = source_index
        result["_assembled_context"] = assembled_context
        result["query"] = query
        return result

    async def stream_generation_pipeline(
        self,
        repository_id: str | None,
        repo_id: str | None,
        query: str,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        federated: bool = False,
        scope_paths: list[str] | None = None,
        attached_files: list[str] | None = None,
        chat_mode: str = "ASK",
    ) -> AsyncIterator[dict]:
        """Stream LangGraph node trace updates, then emit final prepared generation payload."""
        history = await self._load_session_history(session_id)
        history_hash = self._history_hash(history)

        normalized = query.strip().lower()
        query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
        mode_key = f"{chat_mode.upper()}:{('federated' if federated else 'single')}"
        scope_suffix = f":{'-'.join(sorted(scope_paths))}" if scope_paths else ""
        attached_suffix = f":{'-'.join(sorted(attached_files))}" if attached_files else ""
        scope_key = f"{repository_id}{scope_suffix}{attached_suffix}"
        cache_key = f"chat:v3:{mode_key}:{scope_key}:{query_hash}:{history_hash}"
        cached = self.cache.get_json(cache_key)
        if cached is not None:
            yield {
                "type": "complete",
                "result": cached,
                "assembled_context": "",
                "cache_key": cache_key,
                "from_cache": True,
            }
            return

        if not repository_id or not repo_id:
            raise NoContextError("Repository context missing. Select a repository and retry.")

        state = {
            "repo_id": repo_id,
            "repository_id": repository_id,
            "query": query,
            "session": self.session,
            "history": history,
            "scope_paths": scope_paths,
        }

        merged: dict = {}
        emitted_trace = 0
        try:
            async for update in compiled_graph.astream(state, stream_mode="updates"):
                for _node_name, node_output in update.items():
                    if not isinstance(node_output, dict):
                        continue
                    merged.update({k: v for k, v in node_output.items() if k != "run_trace"})
                    trace = list(node_output.get("run_trace") or merged.get("run_trace") or [])
                    if "run_trace" in node_output:
                        merged["run_trace"] = node_output["run_trace"]
                        trace = list(node_output["run_trace"])
                    while emitted_trace < len(trace):
                        entry = trace[emitted_trace]
                        emitted_trace += 1
                        if isinstance(entry, dict):
                            yield {"type": "trace_step", "entry": entry}
        except Exception as exc:
            logger.exception("LangGraph streaming failed")
            raise WorkflowError("Workflow execution failed") from exc

        result = await self._complete_after_graph(
            merged,
            repository_id=repository_id,
            repo_id=repo_id,
            query=query,
            session_id=session_id,
            scope_paths=scope_paths,
            attached_files=attached_files,
            chat_mode=chat_mode,
            history=history,
        )

        for source in list(result.get("retrieved_context") or [])[:8]:
            if isinstance(source, dict):
                yield {"type": "source", "source": source}

        assembled_context = str(result.pop("_assembled_context", ""))
        yield {
            "type": "complete",
            "result": result,
            "assembled_context": assembled_context,
            "cache_key": cache_key,
            "from_cache": False,
        }

    def _load_attached_file_snippets(
        self,
        repository_id: str | None,
        attached_files: list[str] | None,
    ) -> list[dict]:
        if not repository_id or not attached_files:
            return []

        from app.services.repository_cache import (
            normalize_repository_file_path,
            read_repository_file,
            resolve_act_file_paths,
            resolve_repository_workspace,
        )

        repo = self.session.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            return []

        repo_id_str = repo.repo_id or repository_id
        cache_path = resolve_repository_workspace(repo_id_str, repo.local_path)
        if not cache_path:
            return []

        resolved_paths = resolve_act_file_paths(
            attached_files,
            cache_path,
            local_path=repo.local_path,
        )
        paths_to_load = resolved_paths or list(attached_files)

        snippets: list[dict] = []
        max_chars = 50_000
        for raw_path in paths_to_load:
            norm = normalize_repository_file_path(
                raw_path,
                workspace=cache_path,
                local_path=repo.local_path,
            )
            if not norm or ".." in norm.split("/"):
                continue
            content_bytes = read_repository_file(cache_path, norm)
            if not content_bytes:
                continue
            content = content_bytes.decode("utf-8", errors="replace")
            if len(content) > max_chars:
                content = content[:max_chars] + "\n...(truncated)..."
            snippets.append({
                "path": norm,
                "symbol": "attached",
                "content": content,
                "score": 1.0,
                "pinned": True,
            })
        return snippets

    @staticmethod
    def extract_patch_from_text(text: str) -> str | None:
        """Extract unified diff from ACT mode LLM output."""
        raw = str(text or "").strip()
        if not raw:
            return None

        for match in re.finditer(r"```[^\n]*\n([\s\S]*?)```", raw):
            candidate = match.group(1).strip()
            if QueryService._looks_like_unified_diff(candidate):
                return candidate

        fenced = re.search(r"```(?:diff|patch)?\s*\n([\s\S]*?)```", raw, re.IGNORECASE)
        if fenced:
            candidate = fenced.group(1).strip()
            if QueryService._looks_like_unified_diff(candidate):
                return candidate

        if "diff --git" in raw:
            start = raw.find("diff --git")
            chunk = raw[start:].strip()
            if QueryService._looks_like_unified_diff(chunk):
                return chunk

        if "@@" in raw:
            start = raw.find("---")
            if start >= 0:
                chunk = raw[start:].strip()
                if QueryService._looks_like_unified_diff(chunk):
                    return chunk

        if raw.startswith("---"):
            return raw

        return None

    @staticmethod
    def _looks_like_unified_diff(text: str) -> bool:
        candidate = str(text or "").strip()
        if not candidate:
            return False
        if "diff --git" in candidate:
            return True
        if candidate.startswith("---") and "+++" in candidate:
            return True
        return False

    def _build_patch_proposal_from_state(self, state: dict) -> dict | None:
        patch_text = str(state.get("patch") or "").strip()
        if not patch_text:
            return None
        query = str(state.get("query") or "").strip()
        summary = str(state.get("refactor_plan") or state.get("analysis") or "Patch proposal generated.").strip()
        files: list[str] = []
        for line in patch_text.splitlines():
            if line.startswith("+++ b/"):
                files.append(line.replace("+++ b/", "", 1).strip())

        return {
            "title": f"Proposed change: {query[:72]}" if query else "Proposed code change",
            "summary": summary,
            "diff": patch_text,
            "files": files,
            "intent": "patch_generation",
        }

    def build_deterministic_answer(self, query: str, result: dict) -> str | None:
        """Return a deterministic location answer with concrete code excerpts."""
        q = query.strip().lower()
        location_intent = (
            "where" in q
            or "which file" in q
            or "location" in q
            or "implemented" in q
            or "defined" in q
        )
        if not location_intent:
            return None

        file_match = re.search(r"([A-Za-z0-9_.-]+\.(?:js|jsx|ts|tsx|py|java|go|rb|php|md|json))", query, re.IGNORECASE)
        requested_file = file_match.group(1).lower() if file_match else None

        target_match = re.search(r"([A-Za-z_][A-Za-z0-9_]*)\s+(?:function|method|class)", query, re.IGNORECASE)
        if target_match and target_match.group(1).lower() in {"the", "a", "an"}:
            target_match = None

        if target_match is None:
            target_match = re.search(r"(?:function|method|class)\s+[`'\"]?([A-Za-z_][A-Za-z0-9_]*)", query, re.IGNORECASE)
        target = target_match.group(1) if target_match else None

        if not target:
            quoted_match = re.search(r"[`'\"]([A-Za-z_][A-Za-z0-9_]*)[`'\"]", query)
            target = quoted_match.group(1) if quoted_match else None

        if not target and "auth" in q:
            target = "auth"

        if not target:
            return None

        snippets = result.get("retrieved_context", []) or []
        target_lower = target.lower()
        matches: list[tuple[int, str, str, str, bool]] = []

        def _snippet_lang(path: str) -> str:
            lower = path.lower()
            if lower.endswith(".py"):
                return "python"
            if lower.endswith(".ts"):
                return "ts"
            if lower.endswith(".tsx"):
                return "tsx"
            if lower.endswith(".js"):
                return "javascript"
            if lower.endswith(".jsx"):
                return "jsx"
            return "text"

        def _is_code_path(path: str) -> bool:
            lower = path.lower()
            code_exts = (
                ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".rb", ".php", ".cs", ".cpp", ".c", ".h"
            )
            return lower.endswith(code_exts)

        def _extract_excerpt(content: str) -> str:
            lines = content.splitlines()
            if not lines:
                return ""
            idx = next((i for i, line in enumerate(lines) if target_lower in line.lower()), 0)
            start = max(0, idx - 2)
            end = min(len(lines), idx + 4)
            excerpt = "\n".join(lines[start:end]).strip()
            return excerpt if excerpt else content[:280]

        for item in snippets:
            path = str(item.get("path") or "unknown")
            symbol = str(item.get("symbol") or "module")
            content = str(item.get("content") or "")
            searchable = f"{path}\n{symbol}\n{content}".lower()
            if target_lower not in searchable:
                continue

            score = 0
            lower_path = path.lower()
            lower_symbol = symbol.lower()
            if requested_file and requested_file in lower_path:
                score += 100
            if lower_symbol == target_lower:
                score += 40
            elif target_lower in lower_symbol:
                score += 20
            if lower_path.endswith(".md") or "readme" in lower_path or "privacy" in lower_path:
                score -= 40
            if re.search(rf"\b(function|def|class)\s+{re.escape(target_lower)}\b", content.lower()):
                score += 30

            excerpt = _extract_excerpt(content)
            is_code_file = _is_code_path(path)
            matches.append((score, path, symbol, excerpt, is_code_file))

        if not matches:
            return None

        # Strong preference to source code when present.
        if any(item[4] for item in matches):
            matches = [item for item in matches if item[4]]

        matches.sort(key=lambda x: x[0], reverse=True)

        deduped: list[tuple[int, str, str, str, bool]] = []
        seen: set[tuple[str, str]] = set()
        for score, path, symbol, excerpt, is_code_file in matches:
            key = (path, symbol)
            if key in seen:
                continue
            seen.add(key)
            deduped.append((score, path, symbol, excerpt, is_code_file))

        if not deduped:
            return None

        lines = [f"I found {target} related implementation. Showing code excerpts:"]
        for _, path, symbol, excerpt, _ in deduped[:3]:
            lines.append(f"- {path} (symbol: {symbol})")
            language = _snippet_lang(path)
            snippet = excerpt[:700] if excerpt else "(no content captured in this chunk)"
            lines.append(f"```{language}\n{snippet}\n```")

        lines.append("If you want, I can show a longer excerpt from one specific file.")
        return "\n".join(lines)

    def _build_fallback_answer(self, query: str, result: dict) -> str:
        sources = result.get("retrieved_context", []) or []
        top_sources = sources[:3]
        lines = [
            "The language model is temporarily unavailable.",
            "Here are the most relevant files I found from your index:",
        ]
        if not top_sources:
            lines.append("- (no indexed sources available)")
        else:
            for item in top_sources:
                path = str(item.get("path") or "unknown")
                symbol = str(item.get("symbol") or "module")
                lines.append(f"- {path} ({symbol})")
        lines.append("Please retry your request once the model is reachable.")
        return "\n".join(lines)

    def _select_fallback_answer(self, query: str, result: dict) -> str:
        """Select the best available fallback answer: graph -> deterministic -> generic."""
        # Try graph-generated answer first
        graph_answer = str(result.get("answer") or "").strip()
        if graph_answer:
            logger.info("fallback_select - using graph answer chars=%s", len(graph_answer))
            return graph_answer

        # Try deterministic answer extraction
        deterministic = self.build_deterministic_answer(query, result)
        if deterministic is not None and deterministic.strip():
            logger.info("fallback_select - using deterministic answer chars=%s", len(deterministic))
            return deterministic

        # Fall back to generic answer
        generic = self._build_fallback_answer(query, result)
        generic = generic or "I was unable to process your question with the current context. Please check the indexed content and try again."
        logger.info("fallback_select - using generic fallback chars=%s", len(generic))
        return generic

    async def finalize_result(
        self,
        repository_id: str | None,
        repo_id: str | None,
        result: dict,
        cache_key: str,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        query: str | None = None,
        display_query: str | None = None,
        scope_paths: list[str] | None = None,
    ) -> dict:
        answer = str(result.get("answer") or "").strip()
        if not answer:
            logger.error(
                "finalize_result - empty answer repository_id=%s repo_id=%s answer=%s",
                repository_id,
                repo_id,
                repr(result.get("answer")),
            )
            raise LLMRequestError("Language model returned an empty response")
        
        result["answer"] = answer

        safe_result = json.loads(json.dumps(result, default=str))
        self.cache.set_json(cache_key, safe_result)
        logger.debug("query_finalize - cache stored repository_id=%s key=%s", repository_id, cache_key)

        try:
            await self._record_agent_run(
                user_id=user_id,
                repo_id=str(repo_id or ""),
                repository_id=str(repository_id or ""),
                query=str(query or safe_result.get("query") or ""),
                display_content=str(display_query or query or safe_result.get("query") or ""),
                scope_paths=scope_paths,
                intent=str(safe_result.get("intent") or "unknown"),
                answer=str(safe_result.get("answer") or ""),
                source_index=safe_result.get("source_index", []) or [],
                stats=safe_result.get("stats", {}) or {},
                patch_proposal=safe_result.get("patch_proposal"),
                session_id=session_id,
                trace=safe_result.get("run_trace", []) or [],
                statuses=safe_result.get("stream_statuses", []) or [],
            )
        except Exception:
            logger.exception("Failed to record agent run")

        return result

    async def _ensure_session(
        self,
        session_id: str | None,
        user_id: str | None,
        repository_id: str | None,
    ) -> str:
        if session_id:
            return session_id
        
        new_session_id = str(uuid.uuid4())
        try:
            self.session.add(
                ChatSession(
                    id=new_session_id,
                    user_id=user_id,
                    repository_id=repository_id,
                    session_metadata={},
                )
            )
            self.session.commit()
            return new_session_id
        except Exception as exc:
            self.session.rollback()
            raise DatabaseException("Failed to create new chat session") from exc

    async def _load_session_history(self, session_id: str | None) -> list[dict]:
        if not session_id:
            return []
        
        try:
            rows = self.session.execute(
                text(
                    """
                    SELECT role, content, created_at
                    FROM messages
                    WHERE chat_session_id = :session_id
                    ORDER BY created_at ASC
                    LIMIT 20
                    """
                ),
                {"session_id": session_id},
            ).mappings().all()
            history: list[dict] = []
            for row in rows:
                role = str(row.get("role") or "").lower()
                created_at = row.get("created_at")
                if role == "user":
                    history.append({"query": row.get("content"), "created_at": created_at})
                elif role == "assistant":
                    history.append({"answer": row.get("content"), "created_at": created_at})
                else:
                    history.append({"answer": row.get("content"), "created_at": created_at})
            return history
        except Exception as exc:
            raise DatabaseException("Failed to load session history") from exc

    def _history_hash(self, history: list[dict]) -> str:
        """Compute a lightweight hash for history-aware cache keys.

        PHASE 1 FIX: Handle both datetime objects and string timestamps.
        Previously crashed with ``AttributeError: 'str' has no attribute 'timestamp'``
        when ``created_at`` was serialized as a string (e.g., from cache or DB mapping).
        """
        if not history:
            return "no-history"
        last_entry = history[-1]
        created_at = last_entry.get("created_at")
        if created_at is None:
            return "no-timestamp"
        if hasattr(created_at, "timestamp"):
            return str(created_at.timestamp())
        # Fallback for string timestamps
        return hashlib.sha256(str(created_at).encode("utf-8")).hexdigest()[:16]

    async def _record_agent_run(self, **kwargs) -> None:
        session_id = kwargs.get("session_id")
        if not session_id:
            return
        try:
            source_index = kwargs.get("source_index", []) or []
            usage = dict((kwargs.get("stats") or {}).get("usage") or {})
            assistant_metadata = {
                "intent": kwargs.get("intent"),
                "repository_id": kwargs.get("repository_id"),
                "repo_id": kwargs.get("repo_id"),
                "source_index": source_index,
                "sources": source_index,
                "stats": kwargs.get("stats", {}),
                "usage": usage,
                "patch_proposal": kwargs.get("patch_proposal"),
                "trace": kwargs.get("trace", []) or [],
                "traceSteps": kwargs.get("trace", []) or [],
                "statuses": kwargs.get("statuses", []) or [],
            }
            user_metadata = {
                "repository_id": kwargs.get("repository_id"),
                "repo_id": kwargs.get("repo_id"),
                "scope_paths": kwargs.get("scope_paths") or [],
                "display_content": kwargs.get("display_content") or "",
            }
            query_text = str(kwargs.get("query") or "").strip()
            display_text = str(kwargs.get("display_content") or "").strip()
            user_content = display_text or query_text
            answer_text = str(kwargs.get("answer") or "").strip()

            if user_content:
                self.session.execute(
                    text(
                        """
                        INSERT INTO messages (id, chat_session_id, role, content, metadata)
                        VALUES (:id, :chat_session_id, :role, :content, :metadata)
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "chat_session_id": session_id,
                        "role": "user",
                        "content": user_content,
                        "metadata": json.dumps(user_metadata),
                    },
                )

            if answer_text:
                self.session.execute(
                    text(
                        """
                        INSERT INTO messages (id, chat_session_id, role, content, metadata)
                        VALUES (:id, :chat_session_id, :role, :content, :metadata)
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "chat_session_id": session_id,
                        "role": "assistant",
                        "content": answer_text,
                        "metadata": json.dumps(assistant_metadata),
                    },
                )

            self._touch_session(session_id, query_text=query_text, usage=usage)
            self.session.commit()
        except Exception as exc:
            self.session.rollback()
            raise DatabaseException("Failed to record agent run") from exc

    def _touch_session(self, session_id: str, *, query_text: str, usage: dict) -> None:
        row = self.session.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not row:
            return

        now = datetime.now(timezone.utc)
        row.last_activity_at = now
        row.updated_at = now

        title = (row.session_title or "").strip()
        if not title and query_text:
            preview = query_text.strip()
            row.session_title = preview[:60] + ("…" if len(preview) > 60 else "")

        meta = dict(row.session_metadata or {})
        if query_text:
            meta["title_preview"] = query_text.strip()[:80]
        meta["usage_totals"] = merge_usage_totals(meta.get("usage_totals"), usage)
        row.session_metadata = meta

    async def _invoke_graph_with_trace(self, state: dict) -> dict:
        try:
            return await compiled_graph.ainvoke(state)
        except Exception as exc:
            logger.exception("LangGraph invocation failed")
            raise WorkflowError("Workflow execution failed") from exc
