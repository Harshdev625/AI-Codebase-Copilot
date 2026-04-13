from __future__ import annotations

import hashlib
import json
import logging
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

    def run(self, repository_id: str, repo_id: str, query: str, *, user_id: str | None = None, project_id: str | None = None) -> dict:
        result, assembled_context, cache_key, from_cache = self.prepare_generation(
            repository_id,
            repo_id,
            query,
            user_id=user_id,
            project_id=project_id,
        )
        if from_cache:
            return result

        try:
            llm_answer = self.model_router.chat(prompt=query, context=assembled_context)
        except RuntimeError as exc:
            logger.exception("LLM call failed repo_id=%s repository_id=%s", repo_id, repository_id)
            raise LLMUnavailableError(f"Language model unavailable: {exc}") from exc

        if not llm_answer.strip():
            raise EmptyLLMResponseError("Language model returned an empty response")

        result["answer"] = llm_answer
        return self.finalize_result(
            repository_id,
            repo_id,
            result,
            cache_key,
            user_id=user_id,
            project_id=project_id,
        )

    def prepare_generation(
        self,
        repository_id: str,
        repo_id: str,
        query: str,
        *,
        user_id: str | None = None,
        project_id: str | None = None,
    ) -> tuple[dict, str, str, bool]:
        history = self._load_recent_history(user_id=user_id, project_id=project_id, repository_id=repository_id)
        history_hash = self._history_hash(history)

        normalized = query.strip().lower()
        query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
        cache_key = f"chat:{repository_id}:{query_hash}:{history_hash}"
        cached = self.cache.get_json(cache_key)
        if cached is not None:
            logger.debug("QueryService cache hit repo_id=%s repository_id=%s", repo_id, repository_id)
            return cached, "", cache_key, True

        state = {
            "repo_id": repo_id,
            "repository_id": repository_id,
            "query": query,
            "session": self.session,
        }
        result = self._invoke_graph_with_trace(state)

        snippets = result.get("retrieved_context", [])[:6]
        if not snippets:
            raise NoIndexedContextError(
                "No indexed context found for this query. Index the repository first and retry."
            )

        context_parts = []
        if history:
            history_lines = ["Conversation history (most recent first):"]
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
        return result, assembled_context, cache_key, False

    def finalize_result(
        self,
        repository_id: str,
        repo_id: str,
        result: dict,
        cache_key: str,
        *,
        user_id: str | None = None,
        project_id: str | None = None,
    ) -> dict:
        if not str(result.get("answer", "")).strip():
            raise EmptyLLMResponseError("Language model returned an empty response")

        safe_result = json.loads(json.dumps(result, default=str))
        self.cache.set_json(cache_key, safe_result)

        try:
            self._record_agent_run(
                user_id=user_id,
                project_id=project_id,
                repo_id=repo_id,
                repository_id=repository_id,
                query=str(safe_result.get("query") or ""),
                intent=str(safe_result.get("intent") or "unknown"),
                answer=str(safe_result.get("answer") or ""),
                sources=safe_result.get("retrieved_context", []) or [],
            )
        except Exception:
            logger.debug("Failed to record agent run", exc_info=True)

        logger.info(
            "QueryService completed repo_id=%s repository_id=%s intent=%s retrieved=%s",
            repo_id,
            repository_id,
            safe_result.get("intent", "unknown"),
            len(safe_result.get("retrieved_context", []) or []),
        )
        return safe_result

    def _history_hash(self, history: list[dict]) -> str:
        if not history:
            return "none"
        raw = "\n".join([f"{item.get('query','')}\n{item.get('answer','')}" for item in history])
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]

    def _load_recent_history(
        self,
        *,
        user_id: str | None,
        project_id: str | None,
        repository_id: str,
        limit: int = 3,
    ) -> list[dict]:
        if not user_id or not project_id:
            return []

        rows = self.session.execute(
            text(
                """
                SELECT query, diagnostics
                FROM agent_runs
                WHERE user_id = :user_id
                  AND project_id = :project_id
                  AND status = 'completed'
                  AND diagnostics->>'repository_id' = :repository_id
                ORDER BY started_at DESC
                LIMIT :limit
                """
            ),
            {
                "user_id": user_id,
                "project_id": project_id,
                "repository_id": repository_id,
                "limit": limit,
            },
        ).mappings().all()

        history: list[dict] = []
        for row in rows:
            diagnostics = row.get("diagnostics")
            if isinstance(diagnostics, str):
                try:
                    diagnostics = json.loads(diagnostics)
                except json.JSONDecodeError:
                    diagnostics = {}
            diagnostics = diagnostics or {}
            answer = str(diagnostics.get("answer") or "").strip()
            query_text = str(row.get("query") or "").strip()
            if not query_text or not answer:
                continue
            history.append({"query": query_text, "answer": answer})
        return history

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
                return merged
            except Exception:
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
