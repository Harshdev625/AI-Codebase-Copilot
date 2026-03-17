"""Unit tests for API request/response models."""
import pytest
from pydantic import ValidationError

from app.models.api_models import (
    ChatRequest,
    IndexRequest,
    SearchRequest,
    ToolRequest,
)


# ---------------------------------------------------------------------------
# IndexRequest
# ---------------------------------------------------------------------------

def test_index_request_requires_repo_path_or_url():
    with pytest.raises(ValidationError, match="repo_path or repo_url"):
        IndexRequest(repo_id="repo", commit_sha="abc")


def test_index_request_valid_with_repo_path():
    req = IndexRequest(repo_id="repo", repo_path="/some/path")
    assert req.repo_path == "/some/path"


def test_index_request_valid_with_repo_url():
    req = IndexRequest(repo_id="repo", repo_url="https://github.com/a/b.git")
    assert req.repo_url == "https://github.com/a/b.git"


def test_index_request_default_commit_sha():
    req = IndexRequest(repo_id="repo", repo_path="/path")
    assert req.commit_sha == "local-working-copy"


def test_index_request_custom_commit_sha():
    req = IndexRequest(repo_id="repo", repo_path="/path", commit_sha="deadbeef")
    assert req.commit_sha == "deadbeef"


def test_index_request_with_repo_ref():
    req = IndexRequest(repo_id="repo", repo_url="https://github.com/a/b.git", repo_ref="main")
    assert req.repo_ref == "main"


# ---------------------------------------------------------------------------
# ChatRequest
# ---------------------------------------------------------------------------

def test_chat_request_valid():
    req = ChatRequest(repo_id="repo", query="Where is auth?")
    assert req.repo_id == "repo"


def test_chat_request_requires_repo_id():
    with pytest.raises(ValidationError):
        ChatRequest(query="test")


def test_chat_request_query_too_short():
    with pytest.raises(ValidationError):
        ChatRequest(repo_id="repo", query="hi")


# ---------------------------------------------------------------------------
# SearchRequest
# ---------------------------------------------------------------------------

def test_search_request_default_top_k():
    req = SearchRequest(repo_id="repo", query="auth middleware")
    assert req.top_k == 8


def test_search_request_custom_top_k():
    req = SearchRequest(repo_id="repo", query="auth middleware", top_k=20)
    assert req.top_k == 20


def test_search_request_top_k_below_min():
    with pytest.raises(ValidationError):
        SearchRequest(repo_id="repo", query="test", top_k=0)


def test_search_request_top_k_above_max():
    with pytest.raises(ValidationError):
        SearchRequest(repo_id="repo", query="test", top_k=51)


# ---------------------------------------------------------------------------
# ToolRequest
# ---------------------------------------------------------------------------

def test_tool_request_valid_read_file():
    req = ToolRequest(tool_name="read_file", args={"path": "/some/file.py"})
    assert req.tool_name == "read_file"


def test_tool_request_invalid_tool_name():
    with pytest.raises(ValidationError):
        ToolRequest(tool_name="rm_rf", args={})


def test_tool_request_empty_args_default():
    req = ToolRequest(tool_name="git_status")
    assert req.args == {}


# ---------------------------------------------------------------------------
# IndexRequest Additional Tests
# ---------------------------------------------------------------------------

def test_index_request_empty_repo_id():
    # Empty repo_id is actually allowed by the model
    req = IndexRequest(repo_id="", repo_path="/path")
    assert req.repo_id == ""


def test_index_request_whitespace_repo_id():
    # Whitespace repo_id is actually allowed by the model
    req = IndexRequest(repo_id="   ", repo_path="/path")
    assert req.repo_id == "   "


def test_index_request_both_path_and_url():
    # Should accept both if provided
    req = IndexRequest(
        repo_id="repo",
        repo_path="/local/path",
        repo_url="https://github.com/a/b.git"
    )
    assert req.repo_path == "/local/path"
    assert req.repo_url == "https://github.com/a/b.git"


def test_index_request_normalized_paths():
    req = IndexRequest(repo_id="repo", repo_path="/path/to/repo")
    assert req.repo_path == "/path/to/repo"


def test_index_request_with_all_fields():
    req = IndexRequest(
        repo_id="my-repo",
        repo_url="https://github.com/user/repo.git",
        repo_ref="develop",
        commit_sha="abc123def",
    )
    assert req.repo_id == "my-repo"
    assert req.repo_ref == "develop"
    assert req.commit_sha == "abc123def"


# ---------------------------------------------------------------------------
# ChatRequest Additional Tests
# ---------------------------------------------------------------------------

def test_chat_request_valid_with_all_fields():
    req = ChatRequest(repo_id="repo-1", query="What is the authentication flow?")
    assert req.repo_id == "repo-1"
    assert req.query == "What is the authentication flow?"


def test_chat_request_query_with_special_characters():
    req = ChatRequest(repo_id="repo", query="How to handle @app decorators?")
    assert req.query == "How to handle @app decorators?"


def test_chat_request_very_long_query():
    long_query = "a" * 1000
    req = ChatRequest(repo_id="repo", query=long_query)
    assert req.query == long_query


def test_chat_request_numeric_repo_id():
    req = ChatRequest(repo_id="12345", query="test query")
    assert req.repo_id == "12345"


# ---------------------------------------------------------------------------
# SearchRequest Additional Tests
# ---------------------------------------------------------------------------

def test_search_request_valid_with_all_fields():
    req = SearchRequest(
        repo_id="repo",
        query="middleware",
        top_k=15,
    )
    assert req.repo_id == "repo"
    assert req.query == "middleware"
    assert req.top_k == 15


def test_search_request_query_with_quotes():
    req = SearchRequest(repo_id="repo", query='"exact phrase"')
    assert '"exact phrase"' in req.query


def test_search_request_top_k_boundary_values():
    # Test minimum valid value
    req_min = SearchRequest(repo_id="repo", query="test", top_k=1)
    assert req_min.top_k == 1

    # Test maximum valid value
    req_max = SearchRequest(repo_id="repo", query="test", top_k=50)
    assert req_max.top_k == 50


# ---------------------------------------------------------------------------
# ToolRequest Additional Tests
# ---------------------------------------------------------------------------

def test_tool_request_read_file_with_path():
    req = ToolRequest(tool_name="read_file", args={"path": "/app/main.py"})
    assert req.tool_name == "read_file"
    assert req.args["path"] == "/app/main.py"


def test_tool_request_multiple_args():
    # ToolRequest only allows specific tool names
    req = ToolRequest(
        tool_name="read_file",
        args={"pattern": "auth", "file": "*.py"}
    )
    assert req.tool_name == "read_file"
    assert len(req.args) == 2


def test_tool_request_nested_args():
    req = ToolRequest(
        tool_name="git_status",
        args={"config": {"nested": "value"}}
    )
    assert req.args["config"]["nested"] == "value"


def test_tool_request_numeric_args():
    req = ToolRequest(
        tool_name="run_command",
        args={"depth": 3, "limit": 100}
    )
    assert req.args["depth"] == 3
    assert req.args["limit"] == 100
