from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.api.v1.auth import admin_login, admin_register, login, register
from app.api.v1.chat import chat
from app.api.v1.repositories import _ensure_membership as repo_ensure_membership
from app.api.v1.repositories import get_index_progress, list_projects
from app.core import security
from app.models.api_models import AuthAdminRegisterRequest, AuthLoginRequest, AuthRegisterRequest, ChatRequest


class _Result:
    def __init__(self, rows=None):
        self.rows = rows or []

    def first(self):
        return self.rows[0] if self.rows else None

    def mappings(self):
        return self

    def all(self):
        return self.rows


class _SessionQueue:
    def __init__(self, results=None):
        self.results = results or []
        self.idx = 0
        self.commits = 0

    def execute(self, *_args, **_kwargs):
        if self.idx < len(self.results):
            rows = self.results[self.idx]
            self.idx += 1
            return _Result(rows)
        self.idx += 1
        return _Result([])

    def commit(self):
        self.commits += 1


def _payload(response) -> dict:
    return json.loads(response.body.decode("utf-8"))["data"]


def test_security_negative_paths() -> None:
    assert security.verify_password("x", "bad-format") is False

    token = security.create_access_token("u1", expires_seconds=1)
    parts = token.split(".")
    bad_token = f"{parts[0]}.{parts[1]}.invalid"
    with pytest.raises(ValueError, match="Invalid token signature"):
        security.decode_access_token(bad_token)

    payload = security.decode_access_token(token)
    assert payload["sub"] == "u1"


def test_auth_register_and_login_paths() -> None:
    existing_session = _SessionQueue(results=[[{"id": "u1"}]])
    with pytest.raises(HTTPException, match="Email already registered"):
        register(AuthRegisterRequest(email="a@b.com", password="password123", full_name="A"), session=existing_session)

    new_session = _SessionQueue(results=[[]])
    register_response = register(
        AuthRegisterRequest(email="c@d.com", password="password123", full_name="C"),
        session=new_session,
    )
    assert _payload(register_response)["role"] == "USER"

    bad_login_session = _SessionQueue(results=[[{"id": "u1", "password_hash": "x", "is_active": True}]])
    with pytest.raises(HTTPException, match="Invalid credentials"):
        login(AuthLoginRequest(email="a@b.com", password="wrong"), session=bad_login_session)

    pwd_hash = security.hash_password("password123")
    inactive_login_session = _SessionQueue(results=[[{"id": "u1", "password_hash": pwd_hash, "is_active": False}]])
    with pytest.raises(HTTPException, match="User is inactive"):
        login(AuthLoginRequest(email="a@b.com", password="password123"), session=inactive_login_session)

    active_login_session = _SessionQueue(results=[[{"id": "u1", "password_hash": pwd_hash, "is_active": True}]])
    login_response = login(AuthLoginRequest(email="a@b.com", password="password123"), session=active_login_session)
    assert _payload(login_response)["access_token"]


def test_admin_register_and_admin_login_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.v1.auth as auth_module

    monkeypatch.setattr(auth_module.settings, "admin_registration_secret_key", "secret-key")

    with pytest.raises(HTTPException, match="Invalid admin secret key"):
        admin_register(
            AuthAdminRegisterRequest(
                email="admin@example.com",
                password="password123",
                full_name="Admin",
                admin_secret_key="wrong",
            ),
            session=_SessionQueue(results=[[]]),
        )

    register_response = admin_register(
        AuthAdminRegisterRequest(
            email="admin@example.com",
            password="password123",
            full_name="Admin",
            admin_secret_key="secret-key",
        ),
        session=_SessionQueue(results=[[]]),
    )
    assert _payload(register_response)["role"] == "ADMIN"

    pwd_hash = security.hash_password("password123")
    with pytest.raises(HTTPException, match="Admin account required"):
        admin_login(
            AuthLoginRequest(email="dev@example.com", password="password123"),
            session=_SessionQueue(results=[[{"id": "u1", "password_hash": pwd_hash, "is_active": True, "role": "USER"}]]),
        )

    admin_login_response = admin_login(
        AuthLoginRequest(email="admin@example.com", password="password123"),
        session=_SessionQueue(results=[[{"id": "u1", "password_hash": pwd_hash, "is_active": True, "role": "ADMIN"}]]),
    )
    assert _payload(admin_login_response)["access_token"]


def test_chat_route_success_and_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.v1.chat as chat_module

    monkeypatch.setattr(chat_module, "ensure_repository_access", lambda session, repo_id, user_id: {"id": "r1"})

    class FakeQueryService:
        def __init__(self, session):
            self.session = session

        def run(self, repo_id: str, query: str):
            return {"answer": "hello", "intent": "explain", "retrieved_context": [{"path": "x"}]}

    monkeypatch.setattr(chat_module, "QueryService", FakeQueryService)

    response = chat(ChatRequest(repo_id="repo1", query="what?"), current_user={"id": "u1"}, session=_SessionQueue())
    assert _payload(response)["answer"] == "hello"

    class FailingQueryService(FakeQueryService):
        def run(self, repo_id: str, query: str):
            raise RuntimeError("llm unavailable")

    monkeypatch.setattr(chat_module, "QueryService", FailingQueryService)
    with pytest.raises(HTTPException, match="AI service is temporarily unavailable"):
        chat(ChatRequest(repo_id="repo1", query="what?"), current_user={"id": "u1"}, session=_SessionQueue())


def test_repository_list_projects_and_progress_paths() -> None:
    now = datetime.now(timezone.utc)
    projects_session = _SessionQueue(
        results=[[{"id": "p0", "name": "Proj0", "description": "d0", "created_by": "u1", "created_at": now}]]
    )
    projects_response = list_projects(current_user={"id": "u1"}, session=projects_session)
    assert _payload(projects_response)[0]["id"] == "p0"

    progress_session = _SessionQueue(
        results=[[
            {
                "id": "s1",
                "index_status": "completed",
                "stats": {"indexed_chunks": 12, "total_files": 5, "processed_files": 5, "percentage": 100},
                "message": "done",
                "status": "completed",
                "started_at": now,
                "updated_at": now,
            }
        ]]
    )
    progress_response = get_index_progress("s1", current_user={"id": "u1"}, session=progress_session)
    progress_data = _payload(progress_response)
    assert progress_data["snapshot_id"] == "s1"
    assert progress_data["percentage"] == 100


def test_repository_membership_and_progress_errors() -> None:
    with pytest.raises(HTTPException, match="Not authorized"):
        repo_ensure_membership(_SessionQueue(results=[[]]), "p1", "u1")

    with pytest.raises(HTTPException, match="Snapshot not found"):
        get_index_progress("missing", current_user={"id": "u1"}, session=_SessionQueue(results=[[]]))
