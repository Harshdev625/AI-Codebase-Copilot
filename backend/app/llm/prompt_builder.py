from __future__ import annotations

from typing import Any

from app.core.config import settings


BASE_SYSTEM_PROMPT = (
    "You are AI Codebase Copilot.\n\n"
    "Rules:\n"
    "- Use only the provided sources.\n"
    "- Do not invent files, APIs, symbols, or behaviors.\n"
    "- If context is insufficient, explicitly say what is missing.\n"
    "- For major claims, cite at least one source id using [Sx].\n"
    "- Prefer precise, actionable explanations over broad generic advice.\n"
)


def build_context_packet(
    *,
    query: str,
    snippets: list[dict[str, Any]],
    history: list[dict[str, Any]] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    history = history or []
    packets: list[str] = []
    source_index: list[dict[str, Any]] = []

    if history:
        history_lines = ["Recent conversation context:"]
        for item in history[-4:]:
            user = str(item.get("query") or "").strip()
            answer = str(item.get("answer") or "").strip()
            if user:
                history_lines.append(f"- User: {user}")
            if answer:
                history_lines.append(f"- Assistant: {answer[:600]}")
        packets.append("\n".join(history_lines))

    packets.append(f"Current user question: {query.strip()}")

    total_chars = sum(len(part) for part in packets)
    for idx, snippet in enumerate(snippets, start=1):
        source_id = f"S{idx}"
        repository_name = snippet.get("repository_name") or snippet.get("repo_id") or snippet.get("repository_id") or "unknown-repo"
        path = snippet.get("path") or "unknown"
        symbol = snippet.get("symbol") or "module"
        start_line = snippet.get("start_line")
        end_line = snippet.get("end_line")
        score = snippet.get("rerank_score") or snippet.get("federation_score") or snippet.get("score")
        content = str(snippet.get("content") or "")

        header = [
            f"Source {source_id}",
            f"Repository: {repository_name}",
            f"File: {path} | Symbol: {symbol}",
            f"Path: {path}",
            f"Symbol: {symbol}",
        ]
        if start_line is not None and end_line is not None:
            header.append(f"Span: {start_line}-{end_line}")
        if score is not None:
            try:
                header.append(f"Score: {float(score):.4f}")
            except Exception:
                pass

        body = "\n".join(header) + "\nCode:\n" + content
        if total_chars + len(body) > settings.retrieval_context_char_budget:
            break

        packets.append(body)
        total_chars += len(body)
        source_index.append(
            {
                "source_id": source_id,
                "repository_name": repository_name,
                "path": path,
                "symbol": symbol,
                "start_line": start_line,
                "end_line": end_line,
                "score": score,
            }
        )

    context = "\n\n---\n\n".join(packets)
    return context, source_index
