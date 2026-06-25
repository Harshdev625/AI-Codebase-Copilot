from __future__ import annotations

from typing import Any


def estimate_tokens(text: str) -> int:
    """Heuristic token estimate (~4 characters per token)."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def extract_ollama_usage(
    body: dict[str, Any],
    *,
    prompt_text: str = "",
    completion_text: str = "",
) -> dict[str, Any]:
    """Normalize Ollama usage fields into a stable usage payload."""
    prompt = int(body.get("prompt_eval_count") or 0)
    completion = int(body.get("eval_count") or 0)
    source = "ollama"

    if prompt == 0 and completion == 0 and (prompt_text or completion_text):
        prompt = estimate_tokens(prompt_text)
        completion = estimate_tokens(completion_text)
        source = "estimated"

    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": prompt + completion,
        "source": source,
        "model": body.get("model"),
    }


def merge_usage_totals(
    existing: dict[str, Any] | None,
    usage: dict[str, Any],
) -> dict[str, Any]:
    """Accumulate per-request usage into session-level totals."""
    totals = {
        "prompt_tokens": int((existing or {}).get("prompt_tokens") or 0),
        "completion_tokens": int((existing or {}).get("completion_tokens") or 0),
        "total_tokens": int((existing or {}).get("total_tokens") or 0),
        "request_count": int((existing or {}).get("request_count") or 0),
    }
    totals["prompt_tokens"] += int(usage.get("prompt_tokens") or 0)
    totals["completion_tokens"] += int(usage.get("completion_tokens") or 0)
    totals["total_tokens"] += int(usage.get("total_tokens") or 0)
    totals["request_count"] += 1
    return totals
