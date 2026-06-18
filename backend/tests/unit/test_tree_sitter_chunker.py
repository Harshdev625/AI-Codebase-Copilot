"""Unit tests for tree-sitter chunking and regex fallback."""

from pathlib import Path
from unittest.mock import MagicMock, patch

from app.rag.chunking.tree_sitter_chunker import (
    LANGUAGE_BY_SUFFIX,
    _detect_language,
    _fallback_structured_chunks,
    chunk_with_tree_sitter,
)


REPO_ID = "test-repo"
COMMIT = "abc123"


def test_detect_language_by_suffix():
    assert _detect_language(Path("app.tsx")) == "tsx"
    assert _detect_language(Path("main.go")) == "go"
    assert _detect_language(Path("readme.md")) is None


def test_fallback_structured_chunks_splits_large_file(tmp_path):
    file_path = tmp_path / "large.ts"
    lines = [f"const line{i} = {i};" for i in range(120)]
    source = "\n".join(lines)
    chunks = _fallback_structured_chunks(REPO_ID, COMMIT, "large.ts", file_path, source)
    assert len(chunks) >= 2
    assert chunks[0].chunk_type == "generic"
    assert chunks[0].start_line == 1


def test_fallback_detects_function_symbol(tmp_path):
    file_path = tmp_path / "util.js"
    source = "function greet() {\n  return 'hi';\n}\n"
    chunks = _fallback_structured_chunks(REPO_ID, COMMIT, "util.js", file_path, source)
    assert len(chunks) == 1
    assert chunks[0].symbol == "greet"


def test_chunk_with_tree_sitter_uses_fallback_for_unknown_extension(tmp_path):
    file_path = tmp_path / "data.xyz"
    source = "function alpha() {}\n"
    chunks = chunk_with_tree_sitter(REPO_ID, COMMIT, "data.xyz", source, file_path)
    assert len(chunks) == 1
    assert chunks[0].symbol == "alpha"


def test_chunk_with_tree_sitter_parser_unavailable_falls_back(tmp_path):
    file_path = tmp_path / "app.ts"
    source = "export function beta() { return 1; }\n"
    with patch(
        "app.rag.chunking.tree_sitter_chunker._chunk_with_tree_sitter_parser",
        return_value=[],
    ):
        chunks = chunk_with_tree_sitter(REPO_ID, COMMIT, "app.ts", source, file_path)
    assert len(chunks) >= 1


def test_chunk_with_tree_sitter_parser_returns_chunks(tmp_path):
    file_path = tmp_path / "app.ts"
    source = "export function gamma() { return 1; }\n"
    mock_chunk = MagicMock()
    with patch(
        "app.rag.chunking.tree_sitter_chunker._chunk_with_tree_sitter_parser",
        return_value=[mock_chunk],
    ):
        chunks = chunk_with_tree_sitter(REPO_ID, COMMIT, "app.ts", source, file_path)
    assert chunks == [mock_chunk]


def test_language_map_covers_common_suffixes():
    assert ".py" not in LANGUAGE_BY_SUFFIX  # python uses ast_chunker
    assert LANGUAGE_BY_SUFFIX[".ts"] == "typescript"
