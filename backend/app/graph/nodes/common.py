from __future__ import annotations

import logging

from app.llm.model_router import get_model_router


logger = logging.getLogger(__name__)


def build_context(snippets: list[dict], limit: int = 6, max_chars: int = 9000) -> str:
    logger.debug("graph_build_context - request snippets=%s limit=%s", len(snippets), limit)
    parts: list[str] = []
    for item in snippets[:limit]:
        path = item.get("path", "unknown")
        symbol = item.get("symbol") or "module"
        content = item.get("content", "")
        parts.append(f"File: {path} | Symbol: {symbol}\n{content}")

    context = "\n\n---\n\n".join(parts)
    if len(context) <= max_chars:
        logger.debug("graph_build_context - response chars=%s", len(context))
        return context
    logger.debug("graph_build_context - truncated chars=%s max_chars=%s", len(context), max_chars)
    return context[:max_chars]


def llm_try(prompt: str, context: str = "") -> str:
    try:
        router = get_model_router()
        logger.debug("graph_llm_try - calling model prompt_chars=%s context_chars=%s", len(prompt), len(context))
        return router.chat(prompt=prompt, context=context).strip()
    except RuntimeError:
        logger.exception("graph_llm_try - model call failed")
        return ""
