from __future__ import annotations

from app.llm.model_router import get_model_router


def build_context(snippets: list[dict], limit: int = 6, max_chars: int = 9000) -> str:
    parts: list[str] = []
    for item in snippets[:limit]:
        path = item.get("path", "unknown")
        symbol = item.get("symbol") or "module"
        content = item.get("content", "")
        parts.append(f"File: {path} | Symbol: {symbol}\n{content}")

    context = "\n\n---\n\n".join(parts)
    if len(context) <= max_chars:
        return context
    return context[:max_chars]


def llm_try(prompt: str, context: str = "") -> str:
    try:
        router = get_model_router()
        return router.chat(prompt=prompt, context=context).strip()
    except RuntimeError:
        return ""
