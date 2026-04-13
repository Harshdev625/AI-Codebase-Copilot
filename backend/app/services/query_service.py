from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.graph.workflow import compiled_graph
from app.llm.model_router import get_model_router
from app.services.cache_service import get_cache_service


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

    def run(self, repository_id: str, repo_id: str, query: str, *, user_id: str | None = None, project_id: str | None = None, session_id: str | None = None) -> dict:
        logger.info(
            "query_run - request received repository_id=%s repo_id=%s user_id=%s session_id=%s",
            repository_id,
            repo_id,
            user_id,
            session_id,
        )
        # Ensure session exists or create new one
        active_session_id = self._ensure_session(session_id, user_id, project_id, repository_id)

        result, assembled_context, cache_key, from_cache = self.prepare_generation(
            repository_id,
            repo_id,
            query,
            user_id=user_id,
            project_id=project_id,
            session_id=active_session_id,
        )
        if from_cache:
            logger.info("query_run - completed from cache repository_id=%s repo_id=%s", repository_id, repo_id)
            result["session_id"] = active_session_id
            return result

        deterministic_answer = self.build_deterministic_answer(query, result)
        if deterministic_answer is not None:
            result["answer"] = deterministic_answer
            result["session_id"] = active_session_id
            logger.info("query_run - deterministic answer used repository_id=%s", repository_id)
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
            llm_answer = self.model_router.chat(prompt=query, context=assembled_context)
        except RuntimeError as exc:
            logger.exception("LLM call failed repo_id=%s repository_id=%s", repo_id, repository_id)
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
        repository_id: str,
        repo_id: str,
        query: str,
        *,
        user_id: str | None = None,
        project_id: str | None = None,
        session_id: str | None = None,
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
        cache_key = f"chat:v2:{repository_id}:{query_hash}:{history_hash}"
        cached = self.cache.get_json(cache_key)
        if cached is not None:
            logger.debug("QueryService cache hit repo_id=%s repository_id=%s", repo_id, repository_id)
            return cached, "", cache_key, True

        state = {
            "repo_id": repo_id,
            "repository_id": repository_id,
            "query": query,
            "session": self.session,
            "history": history,
        }
        result = self._invoke_graph_with_trace(state)

        snippets = result.get("retrieved_context", [])[:6]
        if not snippets:
            logger.warning("query_prepare - no indexed context repository_id=%s repo_id=%s", repository_id, repo_id)
            raise NoIndexedContextError(
                "No indexed context found for this query. Index the repository first and retry."
            )

        context_parts = []
        if history:
            history_lines = ["Conversation history:"]
            for item in history:
                history_lines.append(f"User: {item['query']}")
                history_lines.append(f"Assistant: {item['answer']}")
                history_lines.append("")
            context_parts.append("\n".join(history_lines).strip())

        for snippet in snippets:
            path = snippet.get("path", "unknown")
            symbol = snippet.get("symbol") or "module"
            content = snippet.get("content", "")
            context_parts.append(f"File: {path} | Symbol: {symbol}\n{content}")
        assembled_context = "\n\n---\n\n".join(context_parts)
        logger.debug(
            "query_prepare - context assembled repository_id=%s snippets=%s context_chars=%s",
            repository_id,
            len(snippets),
            len(assembled_context),
        )
        return result, assembled_context, cache_key, False

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
        repository_id: str,
        repo_id: str,
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

    def _ensure_session(self, session_id: str | None, user_id: str | None, project_id: str | None, repository_id: str) -> str:
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
