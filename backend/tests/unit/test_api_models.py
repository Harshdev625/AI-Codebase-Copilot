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
