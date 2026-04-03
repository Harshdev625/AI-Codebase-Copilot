from __future__ import annotations

import hashlib
import json
import logging

from sqlalchemy.orm import Session

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

    def run(self, repository_id: str, repo_id: str, query: str) -> dict:
        result, assembled_context, cache_key, from_cache = self.prepare_generation(repository_id, repo_id, query)
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
        return self.finalize_result(repository_id, repo_id, result, cache_key)

    def prepare_generation(self, repository_id: str, repo_id: str, query: str) -> tuple[dict, str, str, bool]:
        normalized = query.strip().lower()
        query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
        cache_key = f"chat:{repository_id}:{query_hash}"
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
        for snippet in snippets:
            path = snippet.get("path", "unknown")
            symbol = snippet.get("symbol") or "module"
            content = snippet.get("content", "")
            context_parts.append(f"File: {path} | Symbol: {symbol}\n{content}")
        assembled_context = "\n\n---\n\n".join(context_parts)
        return result, assembled_context, cache_key, False

    def finalize_result(self, repository_id: str, repo_id: str, result: dict, cache_key: str) -> dict:
        if not str(result.get("answer", "")).strip():
            raise EmptyLLMResponseError("Language model returned an empty response")

        safe_result = json.loads(json.dumps(result, default=str))
        self.cache.set_json(cache_key, safe_result)
        logger.info(
            "QueryService completed repo_id=%s repository_id=%s intent=%s retrieved=%s",
            repo_id,
            repository_id,
            safe_result.get("intent", "unknown"),
            len(safe_result.get("retrieved_context", []) or []),
        )
        return safe_result

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
