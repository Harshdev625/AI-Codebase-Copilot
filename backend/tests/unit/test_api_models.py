"""Unit tests for API request models."""

import pytest
from pydantic import ValidationError

from app.models.api_models import (
    AddRepositoryRequest,
    AuthAdminRegisterRequest,
    AuthLoginRequest,
    AuthRegisterRequest,
    ChatRequest,
    CreateProjectRequest,
    IndexRequest,
)


def test_index_request_allows_repo_id_only() -> None:
    req = IndexRequest(repo_id="repo", commit_sha="abc")
    assert req.repo_id == "repo"


def test_index_request_rejects_short_repo_id() -> None:
    with pytest.raises(ValidationError):
        IndexRequest(repo_id="r")


def test_index_request_rejects_invalid_branch() -> None:
    with pytest.raises(ValidationError):
        IndexRequest(repo_id="repo", repo_ref="invalid branch with spaces")


def test_chat_request_valid() -> None:
    req = ChatRequest(repo_id="repo1", query="Where is auth?")
    assert req.repo_id == "repo1"


def test_chat_request_rejects_short_query() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(repo_id="repo1", query="hi")


def test_chat_request_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(repo_id="repo1", query="ok query", extra_field=True)


def test_auth_register_request_valid() -> None:
    req = AuthRegisterRequest(email="dev@example.com", password="password123", full_name="Dev")
    assert req.email == "dev@example.com"


def test_auth_register_request_rejects_bad_email() -> None:
    with pytest.raises(ValidationError):
        AuthRegisterRequest(email="dev-at-example", password="password123")


def test_auth_admin_register_requires_secret() -> None:
    with pytest.raises(ValidationError):
        AuthAdminRegisterRequest(email="admin@example.com", password="password123", full_name="Admin")


def test_auth_login_accepts_minimal_password() -> None:
    req = AuthLoginRequest(email="dev@example.com", password="x")
    assert req.password == "x"


def test_create_project_request_limits_name_length() -> None:
    with pytest.raises(ValidationError):
        CreateProjectRequest(name="a")


def test_add_repository_requires_source() -> None:
    with pytest.raises(ValidationError, match="Provide either remote_url or local_path"):
        AddRepositoryRequest(repo_id="repo-1")


def test_add_repository_valid_with_remote_url() -> None:
    req = AddRepositoryRequest(repo_id="repo-1", remote_url="https://github.com/org/repo.git")
    assert req.remote_url is not None
