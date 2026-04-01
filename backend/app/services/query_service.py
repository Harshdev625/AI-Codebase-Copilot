from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.graph.workflow import compiled_graph
from app.llm.model_router import get_model_router
from app.services.cache_service import CacheService


logger = logging.getLogger(__name__)


class QueryService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.cache = CacheService()
        self.model_router = get_model_router()

    def run(self, repo_id: str, query: str) -> dict:
        result, assembled_context, cache_key, from_cache = self.prepare_generation(repo_id, query)
        if from_cache:
            return result

        try:
            llm_answer = self.model_router.chat(prompt=query, context=assembled_context)
        except RuntimeError as exc:
            logger.exception("LLM call failed repo_id=%s", repo_id)
            raise RuntimeError(f"Language model unavailable: {exc}") from exc

        if not llm_answer.strip():
            raise RuntimeError("Language model returned an empty response")

        result["answer"] = llm_answer
        return self.finalize_result(repo_id, result, cache_key)

    def prepare_generation(self, repo_id: str, query: str) -> tuple[dict, str, str, bool]:
        cache_key = f"chat:{repo_id}:{query.strip().lower()}"
        cached = self.cache.get_json(cache_key)
        if cached is not None:
            logger.debug("QueryService cache hit repo_id=%s", repo_id)
            return cached, "", cache_key, True

        state = {
            "repo_id": repo_id,
            "query": query,
            "session": self.session,
        }
        result = self._invoke_graph_with_trace(state)

        snippets = result.get("retrieved_context", [])[:6]
        if not snippets:
            raise RuntimeError("No relevant indexed context found for this query")

        context_parts = []
        for snippet in snippets:
            path = snippet.get("path", "unknown")
            symbol = snippet.get("symbol") or "module"
            content = snippet.get("content", "")
            context_parts.append(f"File: {path} | Symbol: {symbol}\n{content}")
        assembled_context = "\n\n---\n\n".join(context_parts)
        return result, assembled_context, cache_key, False

    def finalize_result(self, repo_id: str, result: dict, cache_key: str) -> dict:
        if not str(result.get("answer", "")).strip():
            raise RuntimeError("Language model returned an empty response")

        safe_result = json.loads(json.dumps(result, default=str))
        self.cache.set_json(cache_key, safe_result)
        logger.info(
            "QueryService completed repo_id=%s intent=%s retrieved=%s",
            repo_id,
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
            raise RuntimeError(f"Agent workflow execution failed: {exc}") from exc

        if isinstance(result, dict):
            result.setdefault("run_trace", run_trace)
            return result
        raise RuntimeError("Agent workflow returned an invalid response")
