from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.graph.workflow import compiled_graph
from app.llm.model_router import get_model_router
from app.services.cache_service import CacheService


class QueryService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.cache = CacheService()
        self.model_router = get_model_router()

    def run(self, repo_id: str, query: str) -> dict:
        cache_key = f"chat:{repo_id}:{query.strip().lower()}"
        cached = self.cache.get_json(cache_key)
        if cached is not None:
            return cached

        state = {
            "repo_id": repo_id,
            "query": query,
            "session": self.session,
        }
        result = compiled_graph.invoke(state)

        snippets = result.get("retrieved_context", [])[:6]
        context_parts = []
        for snippet in snippets:
            path = snippet.get("path", "unknown")
            symbol = snippet.get("symbol") or "module"
            content = snippet.get("content", "")
            context_parts.append(f"File: {path} | Symbol: {symbol}\n{content}")
        assembled_context = "\n\n---\n\n".join(context_parts)

        try:
            llm_answer = self.model_router.chat(prompt=query, context=assembled_context)
        except RuntimeError:
            llm_answer = self._build_fallback_answer(snippets)

        if llm_answer:
            result["answer"] = llm_answer

        safe_result = json.loads(json.dumps(result, default=str))
        self.cache.set_json(cache_key, safe_result)
        return safe_result

    def _build_fallback_answer(self, snippets: list[dict]) -> str:
        if not snippets:
            return "I could not reach the language model right now, and no indexed context was found for this query."

        lines = [
            "I could not reach the language model right now, but I found related indexed code:",
        ]
        for snippet in snippets[:5]:
            path = snippet.get("path", "unknown")
            symbol = snippet.get("symbol") or "module"
            lines.append(f"- {path} ({symbol})")
        lines.append("Please retry in a moment for a full AI-generated explanation.")
        return "\n".join(lines)
