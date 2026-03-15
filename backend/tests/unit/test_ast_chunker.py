"""Unit tests for the AST-based Python chunker."""
from pathlib import Path

import pytest

from app.rag.chunking.ast_chunker import chunk_python_file


REPO_ID = "test-repo"
COMMIT = "abc123"
FILE_PATH = Path("src/example.py")


def test_single_function_produces_one_chunk():
    source = "def hello():\n    return 'hello'\n"
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, source)
    assert len(chunks) == 1
    assert chunks[0].symbol == "hello"
    assert chunks[0].chunk_type == "function"


def test_async_function_is_chunked():
    source = "async def fetch_data():\n    pass\n"
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, source)
    assert len(chunks) == 1
    assert chunks[0].symbol == "fetch_data"
    assert chunks[0].chunk_type == "function"


def test_class_produces_chunk():
    source = "class MyService:\n    pass\n"
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, source)
    assert any(c.chunk_type == "class" and c.symbol == "MyService" for c in chunks)


def test_class_with_methods_yields_class_and_method_chunks():
    source = (
        "class Calc:\n"
        "    def add(self, a, b):\n"
        "        return a + b\n"
        "    def sub(self, a, b):\n"
        "        return a - b\n"
    )
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, source)
    symbols = [c.symbol for c in chunks]
    assert "Calc" in symbols
    assert "add" in symbols
    assert "sub" in symbols


def test_module_level_code_only_produces_no_chunks():
    source = "x = 1\ny = 2\nprint(x + y)\n"
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, source)
    assert chunks == []


def test_empty_source_produces_no_chunks():
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, "")
    assert chunks == []


def test_chunk_ids_are_unique():
    source = (
        "def alpha():\n    pass\n"
        "def beta():\n    pass\n"
    )
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, source)
    ids = [c.id for c in chunks]
    assert len(ids) == len(set(ids)), "Chunk IDs must be unique"


def test_chunk_fields_are_populated():
    source = "def greet(name):\n    return f'Hello {name}'\n"
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, source)
    assert len(chunks) == 1
    c = chunks[0]
    assert c.repo_id == REPO_ID
    assert c.commit_sha == COMMIT
    assert c.path == str(FILE_PATH)
    assert c.language == "python"
    assert c.start_line >= 1
    assert c.end_line >= c.start_line
    assert "greet" in c.content


def test_chunk_content_matches_source_lines():
    source = "def foo():\n    x = 1\n    return x\n"
    chunks = chunk_python_file(REPO_ID, COMMIT, FILE_PATH, source)
    assert len(chunks) == 1
    assert "def foo" in chunks[0].content
    assert "return x" in chunks[0].content


def test_same_content_different_files_have_different_ids():
    source = "def foo():\n    pass\n"
    chunks_a = chunk_python_file(REPO_ID, COMMIT, Path("a.py"), source)
    chunks_b = chunk_python_file(REPO_ID, COMMIT, Path("b.py"), source)
    assert chunks_a[0].id != chunks_b[0].id
