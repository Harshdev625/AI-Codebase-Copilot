from __future__ import annotations

from typing import Any

from app.core.config import settings


BASE_SYSTEM_PROMPT = (
    "You are AI Codebase Copilot, an expert assistant that answers questions about software projects.\n\n"
    "STRICT RULES — follow every one of these:\n"
    "1. Answer ONLY from the retrieved codebase context embedded in this system prompt. "
    "Do NOT use your training knowledge to describe the project — only what the context shows.\n"
    "2. If the context does not contain enough information to answer, say exactly: "
    "'The retrieved context does not contain enough information to answer this question.' "
    "Do NOT guess or hallucinate.\n"
    "3. Never repeat or quote the context block headers (Source [Sx], Score, Code:). "
    "Summarise the information in your own words.\n"
    "4. Cite sources inline as [S1], [S2], etc. when making specific claims.\n"
    "5. Use only relative file paths; never expose absolute paths like C:\\ or E:\\.\n"
    "6. Keep responses concise and factual.\n"
)


def build_context_packet(
    *,
    query: str,
    snippets: list[dict[str, Any]],
    history: list[dict[str, Any]] | None = None,
    chat_mode: str = "ASK",
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

    if chat_mode.upper() == "PLAN":
        packets.append(
            "*** PLAN MODE ENFORCEMENT ***\n"
            "You are in PLAN mode. You MUST structure your response with the following exact sections:\n"
            "1. Summary\n"
            "2. Architecture\n"
            "3. Affected Files\n"
            "4. Implementation Steps\n"
            "5. Risks\n"
            "6. Testing Strategy\n"
            "Do not deviate from this template. Do not write a casual response."
        )

    if chat_mode.upper() == "ACT":
        packets.append(
            "*** ACT MODE ENFORCEMENT ***\n"
            "You are in ACT mode. Output a valid unified diff patch that can be applied with git apply.\n"
            "Rules:\n"
            "1. Start with `diff --git a/<path> b/<path>` for each changed file.\n"
            "2. Include ---/+++ headers and @@ hunk markers.\n"
            "3. Wrap the full patch in a ```diff fenced block.\n"
            "4. Keep prose minimal (1-2 sentence summary max before the diff).\n"
            "5. Only modify files supported by the retrieved context.\n"
        )

    total_chars = sum(len(part) for part in packets)
    for idx, snippet in enumerate(snippets, start=1):
        source_id = f"S{idx}"
        repository_name = snippet.get("repository_name") or snippet.get("repo_id") or snippet.get("repository_id") or "unknown-repo"
        raw_path = str(snippet.get("path") or "unknown")
        clean_path = raw_path.replace("\\", "/")
        repo_slug = repository_name.replace("/", "_")
        if f".repo_cache/{repo_slug}/" in clean_path:
            clean_path = clean_path.split(f".repo_cache/{repo_slug}/", 1)[-1]
        elif "/.repo_cache/" in clean_path:
            parts = clean_path.split("/.repo_cache/", 1)[-1].split("/", 1)
            if len(parts) > 1:
                clean_path = parts[1]

        symbol = snippet.get("symbol") or "module"
        start_line = snippet.get("start_line")
        end_line = snippet.get("end_line")
        score = snippet.get("rerank_score") or snippet.get("federation_score") or snippet.get("score")
        content = str(snippet.get("content") or "")

        header = [
            f"Source [{source_id}] File: {clean_path} (Symbol: {symbol})",
        ]
        if start_line is not None and end_line is not None:
            header.append(f"Lines: {start_line}-{end_line}")
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
                "path": clean_path,
                "symbol": symbol,
                "start_line": start_line,
                "end_line": end_line,
                "score": score,
            }
        )

    context = "\n\n---\n\n".join(packets)
    return context, source_index
