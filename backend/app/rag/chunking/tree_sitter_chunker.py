from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.models.domain_models import CodeChunk


LANGUAGE_BY_SUFFIX = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "c_sharp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
}

SYMBOL_REGEXES = [
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE),
    re.compile(r"^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE),
    re.compile(r"^\s*(?:def|class)\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE),
]


def _make_chunk(
    repo_id: str,
    commit_sha: str,
    file_path: Path,
    language: str,
    symbol: str,
    chunk_type: str,
    start_line: int,
    end_line: int,
    content: str,
) -> CodeChunk:
    raw_key = f"{repo_id}|{file_path}|{symbol}|{start_line}|{end_line}|{content[:200]}"
    return CodeChunk(
        id=str(uuid.uuid5(uuid.NAMESPACE_OID, raw_key)),
        repo_id=repo_id,
        commit_sha=commit_sha,
        path=str(file_path),
        language=language,
        symbol=symbol,
        chunk_type=chunk_type,
        start_line=start_line,
        end_line=end_line,
        content=content,
    )


def _detect_language(file_path: Path) -> str | None:
    return LANGUAGE_BY_SUFFIX.get(file_path.suffix.lower())


def _iter_nodes(root_node):
    stack = [root_node]
    while stack:
        node = stack.pop()
        yield node
        children = getattr(node, "children", None) or []
        if children:
            stack.extend(reversed(children))


def _chunk_with_tree_sitter_parser(
    repo_id: str,
    commit_sha: str,
    file_path: Path,
    source: str,
    language: str,
) -> list[CodeChunk]:
    try:
        from tree_sitter_language_pack import get_parser
    except Exception:
        return []

    try:
        parser = get_parser(language)
        tree = parser.parse(source.encode("utf-8", errors="ignore"))
    except Exception:
        return []

    lines = source.splitlines()
    chunks: list[CodeChunk] = []
    function_like = {
        "function_definition",
        "function_declaration",
        "method_definition",
        "method_declaration",
        "arrow_function",
    }
    class_like = {"class_definition", "class_declaration"}

    for node in _iter_nodes(tree.root_node):
        node_type = getattr(node, "type", "")
        if node_type not in function_like and node_type not in class_like:
            continue

        start = getattr(node, "start_point", (0, 0))[0] + 1
        end = getattr(node, "end_point", (start - 1, 0))[0] + 1
        if end < start:
            end = start

        snippet = "\n".join(lines[start - 1 : end]).strip()
        if not snippet:
            continue

        symbol = ""
        text = getattr(node, "text", b"")
        if isinstance(text, bytes) and text:
            maybe = text.decode("utf-8", errors="ignore")
            m = re.search(r"([A-Za-z_][A-Za-z0-9_]*)", maybe)
            if m:
                symbol = m.group(1)

        chunk_type = "class" if node_type in class_like else "function"
        chunks.append(
            _make_chunk(
                repo_id=repo_id,
                commit_sha=commit_sha,
                file_path=file_path,
                language=language,
                symbol=symbol,
                chunk_type=chunk_type,
                start_line=start,
                end_line=end,
                content=snippet,
            )
        )

    return chunks


def _fallback_structured_chunks(repo_id: str, commit_sha: str, file_path: Path, source: str) -> list[CodeChunk]:
    language = file_path.suffix.lstrip(".") or "text"
    lines = source.splitlines()
    chunks: list[CodeChunk] = []
    chunk_size = 80

    for start_idx in range(0, len(lines), chunk_size):
        end_idx = min(start_idx + chunk_size, len(lines))
        snippet = "\n".join(lines[start_idx:end_idx]).strip()
        if not snippet:
            continue

        symbol = ""
        for pattern in SYMBOL_REGEXES:
            match = pattern.search(snippet)
            if match:
                symbol = match.group(1)
                break

        chunks.append(
            _make_chunk(
                repo_id=repo_id,
                commit_sha=commit_sha,
                file_path=file_path,
                language=language,
                symbol=symbol,
                chunk_type="generic",
                start_line=start_idx + 1,
                end_line=end_idx,
                content=snippet,
            )
        )

    return chunks


def chunk_with_tree_sitter(repo_id: str, commit_sha: str, file_path: Path, source: str) -> list[CodeChunk]:
    language = _detect_language(file_path)
    if language:
        chunks = _chunk_with_tree_sitter_parser(repo_id, commit_sha, file_path, source, language)
        if chunks:
            return chunks

    return _fallback_structured_chunks(repo_id, commit_sha, file_path, source)
