from __future__ import annotations

import logging
import re
from typing import Any

from app.graph.state import CopilotState


logger = logging.getLogger(__name__)


def _snippet_label(item: dict[str, Any]) -> str:
    path = str(item.get("path") or "unknown")
    symbol = str(item.get("symbol") or "module")
    return f"{path}::{symbol}" if symbol else path


def _bounded_excerpt(content: str, *, max_lines: int = 4, max_chars: int = 320) -> str:
    lines = [line for line in content.splitlines() if line.strip()]
    excerpt = "\n".join(lines[:max_lines]).strip()
    if len(excerpt) > max_chars:
        return excerpt[: max_chars - 3].rstrip() + "..."
    return excerpt


def _compute_confidence(query: str, snippets: list[dict[str, Any]]) -> float:
    if not snippets:
        return 0.15

    tokens = [token for token in re.findall(r"[a-zA-Z0-9_]+", query.lower()) if len(token) >= 3]
    if not tokens:
        return 0.45

    top = snippets[:4]
    hits = 0
    for token in tokens[:8]:
        if any(
            token in str(item.get("path") or "").lower()
            or token in str(item.get("symbol") or "").lower()
            or token in str(item.get("content") or "").lower()
            for item in top
        ):
            hits += 1

    token_score = hits / max(1, min(len(tokens), 8))
    coverage_score = min(1.0, len(snippets) / 6.0)
    return round(min(0.95, 0.35 + (token_score * 0.4) + (coverage_score * 0.2)), 3)


def reasoning_node(state: CopilotState) -> CopilotState:
    query = str(state.get("query") or "")
    intent = str(state.get("intent") or "code")
    retrieved = list(state.get("retrieved_context") or [])

    logger.debug(
        "reasoning_node - intent=%s query_len=%s retrieved=%s",
        intent,
        len(query),
        len(retrieved),
    )

    verification = {
        "retrieved_count": len(retrieved),
        "confidence": _compute_confidence(query, retrieved),
    }
    trace = list(state.get("run_trace") or [])
    trace.append(
        {
            "node": "reasoning",
            "intent": intent,
            "retrieved_count": len(retrieved),
            "confidence": verification["confidence"],
        }
    )

    if not retrieved:
        return {
            "analysis": (
                "No indexed context was found for this request. "
                "Index the repository and retry so the answer can be grounded in source files."
            ),
            "verification": verification,
            "confidence": verification["confidence"],
            "run_trace": trace,
        }

    highlights = [f"- {_snippet_label(item)}" for item in retrieved[:4]]
    base_analysis = "Relevant indexed locations:\n" + "\n".join(highlights)

    updates: CopilotState = {
        "analysis": base_analysis,
        "verification": verification,
        "confidence": verification["confidence"],
        "run_trace": trace,
    }

    if intent == "debug":
        updates["analysis"] = (
            "Debug focus:\n"
            + "\n".join(highlights)
            + "\n\nCheck failing branches and guards in these locations first, then validate input assumptions around the reported error path."
        )
    elif intent == "refactor":
        updates["refactor_plan"] = (
            "Refactor plan:\n"
            + "\n".join(highlights)
            + "\n\n1. Isolate duplicated logic into focused helpers.\n"
            "2. Preserve API behavior and add regression tests for edited call paths.\n"
            "3. Run lint and type checks before shipping."
        )
    elif intent == "docs":
        doc_lines: list[str] = []
        for item in retrieved[:3]:
            label = _snippet_label(item)
            excerpt = _bounded_excerpt(str(item.get("content") or ""))
            if excerpt:
                doc_lines.append(f"- {label}\n{excerpt}")
            else:
                doc_lines.append(f"- {label}")
        updates["documentation"] = "Documentation notes:\n" + "\n\n".join(doc_lines)
    elif intent == "patch_generation":
        updates["refactor_plan"] = (
            "Patch planning targets:\n"
            + "\n".join(highlights)
            + "\n\nGenerate a minimal diff touching only the files above and verify behavior with targeted tests."
        )
    elif intent == "tool":
        updates["analysis"] = (
            "Tool execution requested. "
            "Proceeding to tool node for command execution safety checks before producing the final answer."
        )

    return updates

