from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.graph.workflow import compiled_graph
from app.llm.model_router import get_model_router
from app.llm.prompt_builder import BASE_SYSTEM_PROMPT, build_context_packet
from app.observability.metrics import runtime_metrics
from app.rag.retrieval.service import get_retrieval_service
from app.services.cache_service import get_cache_service
from app.services.saas_service import record_query_usage


logger = logging.getLogger(__name__)


class QueryServiceError(RuntimeError):
    """Base error for QueryService failures."""


class NoIndexedContextError(QueryServiceError):
    """Raised when retrieval returns no usable context (likely not indexed yet)."""


class LLMUnavailableError(QueryServiceError):
    """Raised when the LLM backend cannot be reached or returns an error."""


class WorkflowExecutionError(QueryServiceError):
    """Raised when the LangGraph workflow fails."""


class EmptyLLMResponseError(QueryServiceError):
    """Raised when the LLM returns an empty response."""


class QueryService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.cache = get_cache_service()
        self.model_router = get_model_router()
        self.retrieval_service = get_retrieval_service(session)

    def run(
        self,
        repository_id: str | None,
        repo_id: str | None,
        query: str,
        *,
        user_id: str | None = None,
        project_id: str | None = None,
        session_id: str | None = None,
        federated: bool = False,
    ) -> dict:
        logger.info(
            "query_run - request received repository_id=%s repo_id=%s project_id=%s user_id=%s session_id=%s federated=%s",
            repository_id,
            repo_id,
            project_id,
            user_id,
            session_id,
            federated,
        )
        run_started = time.perf_counter()
        runtime_metrics.increment("query_run_total", mode="federated" if federated else "single")
        # Ensure session exists or create new one
        active_session_id = self._ensure_session(session_id, user_id, project_id, repository_id)

        result, assembled_context, cache_key, from_cache = self.prepare_generation(
            repository_id,
            repo_id,
            query,
            user_id=user_id,
            project_id=project_id,
            session_id=active_session_id,
            federated=federated,
        )
        if from_cache:
            logger.info("query_run - completed from cache repository_id=%s repo_id=%s", repository_id, repo_id)
            if user_id and project_id:
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
            return self.finalize_result(
                repository_id,
                repo_id,
                result,
                cache_key,
                user_id=user_id,
                project_id=project_id,
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
            return self.finalize_result(
                repository_id,
                repo_id,
                result,
                cache_key,
                user_id=user_id,
                project_id=project_id,
                session_id=active_session_id,
            )

        try:
            with runtime_metrics.timer("llm_chat_latency_ms", mode="federated" if federated else "single"):
                try:
                    llm_answer = self.model_router.chat(
                        prompt=query,
                        context=assembled_context,
                        system_prompt=BASE_SYSTEM_PROMPT,
                    )
                except TypeError:
                    llm_answer = self.model_router.chat(
                        prompt=query,
                        context=assembled_context,
                    )
        except RuntimeError as exc:
            logger.exception("LLM call failed repo_id=%s repository_id=%s", repo_id, repository_id)
            runtime_metrics.increment("llm_chat_errors_total", mode="federated" if federated else "single")
            raise LLMUnavailableError(f"Language model unavailable: {exc}") from exc

        if not llm_answer.strip():
            raise EmptyLLMResponseError("Language model returned an empty response")

        result["answer"] = llm_answer
        result["session_id"] = active_session_id
        
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
        return self.finalize_result(
            repository_id,
            repo_id,
            result,
            cache_key,
            user_id=user_id,
            project_id=project_id,
            session_id=active_session_id,
        )

    def prepare_generation(
        self,
        repository_id: str | None,
        repo_id: str | None,
        query: str,
        *,
        user_id: str | None = None,
        project_id: str | None = None,
        session_id: str | None = None,
        federated: bool = False,
    ) -> tuple[dict, str, str, bool]:
        logger.debug(
            "query_prepare - start repository_id=%s repo_id=%s user_id=%s session_id=%s",
            repository_id,
            repo_id,
            user_id,
            session_id,
        )
        # Load history specifically from the active session
        history = self._load_session_history(session_id)
        history_hash = self._history_hash(history)

        normalized = query.strip().lower()
        query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
        mode_key = "federated" if federated else "single"
        scope_key = project_id if federated else repository_id
        cache_key = f"chat:v3:{mode_key}:{scope_key}:{query_hash}:{history_hash}"
        cached = self.cache.get_json(cache_key)
        if cached is not None:
            logger.debug("QueryService cache hit repo_id=%s repository_id=%s", repo_id, repository_id)
            return cached, "", cache_key, True

        if federated and project_id:
            return self._prepare_federated_generation(
                project_id=project_id,
                query=query,
                history=history,
                cache_key=cache_key,
            )

        if not repository_id or not repo_id:
            raise NoIndexedContextError("Repository context missing. Select a repository or use project federation.")

        state = {
            "repo_id": repo_id,
            "repository_id": repository_id,
            "project_id": project_id,
            "query": query,
            "session": self.session,
            "history": history,
        }
        result = self._invoke_graph_with_trace(state)
        proposal = self._build_patch_proposal_from_state(result)
        if proposal:
            result["patch_proposal"] = proposal

        if not result.get("retrieved_context"):
            retrieved = self.retrieval_service.retrieve_repository(
                repository_id=repository_id,
                query=query,
                top_k=8,
            )
            if retrieved:
                result["retrieved_context"] = retrieved

        snippets = result.get("retrieved_context", [])[:6]
        if not snippets:
            logger.warning("query_prepare - no indexed context repository_id=%s repo_id=%s", repository_id, repo_id)
            raise NoIndexedContextError(
                "No indexed context found for this query. Index the repository first and retry."
            )

        assembled_context, source_index = build_context_packet(
            query=query,
            snippets=snippets,
            history=history,
        )
        result["source_index"] = source_index
        logger.debug(
            "query_prepare - context assembled repository_id=%s snippets=%s context_chars=%s",
            repository_id,
            len(snippets),
            len(assembled_context),
        )
        return result, assembled_context, cache_key, False

    def _prepare_federated_generation(
        self,
        *,
        project_id: str,
        query: str,
        history: list[dict],
        cache_key: str,
    ) -> tuple[dict, str, str, bool]:
        snippets = self.retrieval_service.retrieve_project(
            project_id=project_id,
            query=query,
            top_k=8,
            per_repo_k=6,
        )
        if not snippets:
            raise NoIndexedContextError("No indexed context found in this project. Index repositories and retry.")

        assembled_context, source_index = build_context_packet(
            query=query,
            snippets=snippets[:8],
            history=history,
        )
        result = {
            "intent": "search",
            "retrieval_strategy": "project_federation",
            "retrieved_context": snippets,
            "source_index": source_index,
        }
        return result, assembled_context, cache_key, False

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

        lines = [f"I found {target} related implementation. Showing code excerpts:"]
        for _, path, symbol, excerpt, _ in deduped[:3]:
            lines.append(f"- {path} (symbol: {symbol})")
            language = _snippet_lang(path)
            snippet = excerpt[:700] if excerpt else "(no content captured in this chunk)"
            lines.append(f"```{language}\n{snippet}\n```")

        lines.append("If you want, I can show a longer excerpt from one specific file.")
        return "\n".join(lines)

    def finalize_result(
        self,
        repository_id: str | None,
        repo_id: str | None,
        result: dict,
        cache_key: str,
        *,
        user_id: str | None = None,
        project_id: str | None = None,
        session_id: str | None = None,
    ) -> dict:
        if not str(result.get("answer", "")).strip():
            raise EmptyLLMResponseError("Language model returned an empty response")

        safe_result = json.loads(json.dumps(result, default=str))
        self.cache.set_json(cache_key, safe_result)
        logger.debug("query_finalize - cache stored repository_id=%s key=%s", repository_id, cache_key)

        if user_id:
            try:
                record_query_usage(
                    self.session,
                    user_id=str(user_id),
                    project_id=project_id,
                    query=str(safe_result.get("query") or ""),
                    answer=str(safe_result.get("answer") or ""),
                    retrieved_count=len(list(safe_result.get("retrieved_context", []) or [])),
                    auto_commit=True,
                )
            except Exception:
                logger.exception("query_finalize - usage tracking failed")

        try:
            self._record_agent_run(
                user_id=user_id,
                project_id=project_id,
                repo_id=str(repo_id or ""),
                repository_id=str(repository_id or ""),
                query=str(safe_result.get("query") or ""),
                intent=str(safe_result.get("intent") or "unknown"),
                answer=str(safe_result.get("answer") or ""),
                sources=safe_result.get("retrieved_context", []) or [],
            )
        except Exception:
            logger.error("query_finalize - failed to record agent run", exc_info=True)

        # Record to persistent messages table
        if session_id:
            try:
                self._persist_message_turn(
                    session_id=session_id,
                    query=str(safe_result.get("query") or ""),
                    answer=str(safe_result.get("answer") or ""),
                    metadata={
                        "intent": str(safe_result.get("intent") or "unknown"),
                        "sources": safe_result.get("retrieved_context", []) or [],
                        "source_index": safe_result.get("source_index", []) or [],
                        "proposal": safe_result.get("patch_proposal"),
                    }
                )
            except Exception:
                logger.error("Failed to persist message turn session_id=%s", session_id, exc_info=True)

        logger.info(
            "QueryService completed repo_id=%s repository_id=%s intent=%s",
            repo_id,
            repository_id,
            safe_result.get("intent", "unknown"),
        )
        return safe_result

    def _ensure_session(
        self,
        session_id: str | None,
        user_id: str | None,
        project_id: str | None,
        repository_id: str | None,
    ) -> str:
        """Verifies if a session exists, or creates a new one if needed."""
        if not user_id or not project_id:
             # Fallback for anonymous or system calls
             return session_id or str(uuid.uuid4())

        if session_id:
            # check if exists
            row = self.session.execute(
                text("SELECT id FROM chat_sessions WHERE id = :id AND user_id = :user_id"),
                {"id": session_id, "user_id": user_id}
            ).fetchone()
            if row:
                # Update timestamp
                self.session.execute(
                    text("UPDATE chat_sessions SET updated_at = NOW() WHERE id = :id"),
                    {"id": session_id}
                )
                self.session.commit()
                return session_id

        # Create new
        new_id = session_id or str(uuid.uuid4())
        self.session.execute(
            text(
                "INSERT INTO chat_sessions (id, project_id, repository_id, user_id, created_at, updated_at) "
                "VALUES (:id, :project_id, :repository_id, :user_id, NOW(), NOW())"
            ),
            {
                "id": new_id,
                "project_id": project_id,
                "repository_id": repository_id,
                "user_id": user_id,
            }
        )
        self.session.commit()
        logger.debug("query_session - created new session_id=%s", new_id)
        return new_id

    def _history_hash(self, history: list[dict]) -> str:
        """Generate a hash based on conversation history for cache key."""
        if not history:
            return hashlib.sha256(b"").hexdigest()[:16]
        
        history_str = json.dumps(history, sort_keys=True)
        return hashlib.sha256(history_str.encode("utf-8")).hexdigest()[:16]

    def _load_session_history(self, session_id: str | None, limit: int = 10) -> list[dict]:
        """Loads previous turns from the messages table for context."""
        if not session_id:
            return []
        if not hasattr(self.session, "execute"):
            return []

        rows = self.session.execute(
            text(
                "SELECT content, role FROM messages WHERE chat_session_id = :session_id ORDER BY created_at ASC LIMIT :limit"
            ),
            {"session_id": session_id, "limit": limit * 2}
        ).fetchall()

        history: list[dict] = []
        # Group pairs of user/assistant messages
        current_turn: dict = {}
        for row in rows:
            if row.role == "user":
                current_turn = {"query": row.content}
            elif row.role == "assistant" and "query" in current_turn:
                current_turn["answer"] = row.content
                history.append(current_turn)
                current_turn = {}
        
        return history

    def _persist_message_turn(self, session_id: str, query: str, answer: str, metadata: dict) -> None:
        """Saves a user query and assistant response as linked messages."""
        if not hasattr(self.session, "execute") or not hasattr(self.session, "commit"):
            return

        user_msg_id = str(uuid.uuid4())
        asst_msg_id = str(uuid.uuid4())

        # Save User prompt
        self.session.execute(
            text("INSERT INTO messages (id, chat_session_id, role, content, created_at) VALUES (:id, :sid, 'user', :content, NOW())"),
            {"id": user_msg_id, "sid": session_id, "content": query}
        )
        # Save Assistant response
        self.session.execute(
            text("INSERT INTO messages (id, chat_session_id, role, content, metadata, created_at) VALUES (:id, :sid, 'assistant', :content, CAST(:meta AS jsonb), NOW())"),
            {"id": asst_msg_id, "sid": session_id, "content": answer, "meta": json.dumps(metadata)}
        )
        
        # Update session summary if it's the first message
        self.session.execute(
            text("UPDATE chat_sessions SET summary = :summary WHERE id = :id AND summary IS NULL"),
            {"id": session_id, "summary": (query[:50] + "...") if len(query) > 50 else query}
        )
        
        self.session.commit()
        logger.debug("query_persistence - saved turn for session_id=%s", session_id)

    def _record_agent_run(
        self,
        *,
        user_id: str | None,
        project_id: str | None,
        repo_id: str,
        repository_id: str,
        query: str,
        intent: str,
        answer: str,
        sources: list[dict],
    ) -> None:
        if not user_id or not project_id:
            logger.debug("query_record_agent_run - skipped missing user/project context")
            return

        run_id = str(uuid.uuid4())
        diagnostics = {
            "repository_id": repository_id,
            "answer": answer,
            "sources": sources[:10],
            "model": getattr(self.model_router, "chat_model", None),
            "retrieved_count": len(sources),
            "confidence": (
                self._safe_float((sources[0].get("rerank_score") if sources else 0.0), default=0.0)
                or self._safe_float((sources[0].get("federation_score") if sources else 0.0), default=0.0)
                or self._safe_float((sources[0].get("score") if sources else 0.0), default=0.0)
            ),
        }

        self.session.execute(
            text(
                """
                INSERT INTO agent_runs (id, user_id, project_id, repo_id, query, intent, status, diagnostics, started_at, finished_at)
                VALUES (:id, :user_id, :project_id, :repo_id, :query, :intent, 'completed', CAST(:diagnostics AS jsonb), NOW(), NOW())
                """
            ),
            {
                "id": run_id,
                "user_id": user_id,
                "project_id": project_id,
                "repo_id": repo_id,
                "query": query,
                "intent": intent,
                "diagnostics": json.dumps(diagnostics),
            },
        )
        self.session.commit()
        logger.debug("query_record_agent_run - persisted run_id=%s repository_id=%s", run_id, repository_id)

    def _safe_float(self, value: object, *, default: float) -> float:
        try:
            return float(value)
        except Exception:
            return default

    def _invoke_graph_with_trace(self, state: dict) -> dict:
        run_trace: list[dict] = []

        stream = getattr(compiled_graph, "stream", None)
        if callable(stream):
            merged = dict(state)
            try:
                for event in stream(state, stream_mode="updates"):
                    if not isinstance(event, dict):
                        continue
                    for node_name, node_output in event.items():
                        if isinstance(node_output, dict):
                            merged.update(node_output)
                            run_trace.append(
                                {
                                    "node": str(node_name),
                                    "output_keys": sorted(node_output.keys()),
                                }
                            )
                            logger.debug("Graph step node=%s keys=%s", node_name, sorted(node_output.keys()))
                if run_trace:
                    merged["run_trace"] = run_trace
                logger.debug("graph_invoke - stream completed nodes=%s", len(run_trace))
                return merged
            except Exception:
                logger.exception("graph_invoke - stream failed; falling back to invoke")
                # Fall back to non-stream invocation below.
                pass

        try:
            result = compiled_graph.invoke(state)
        except Exception as exc:
            raise WorkflowExecutionError(f"Agent workflow execution failed: {exc}") from exc

        if isinstance(result, dict):
            result.setdefault("run_trace", run_trace)
            return result
        raise RuntimeError("Agent workflow returned an invalid response")
