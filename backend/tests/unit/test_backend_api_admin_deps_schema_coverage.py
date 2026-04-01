from __future__ import annotations

import json

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api import dependencies
from app.api.v1 import admin as admin_module
from app.db import schema as schema_module


class _Result:
    def __init__(self, rows=None):
        self.rows = rows or []

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class _SessionQueue:
    def __init__(self, results=None):
        self.results = results or []
        self.execute_index = 0
        self.commits = 0

    def execute(self, *_args, **_kwargs):
        if self.execute_index < len(self.results):
            result = self.results[self.execute_index]
            self.execute_index += 1
            return _Result(result)
        self.execute_index += 1
        return _Result([])

    def commit(self):
        self.commits += 1


def _payload(response):
    body = json.loads(response.body.decode("utf-8"))
    return body.get("data")


def test_get_current_user_all_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(HTTPException, match="Missing bearer token"):
        dependencies.get_current_user(credentials=None, session=_SessionQueue())

    monkeypatch.setattr(dependencies, "decode_access_token", lambda token: (_ for _ in ()).throw(ValueError("bad token")))
    with pytest.raises(HTTPException, match="bad token"):
        dependencies.get_current_user(
            credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials="x"),
            session=_SessionQueue(),
        )

    monkeypatch.setattr(dependencies, "decode_access_token", lambda token: {"sub": ""})
    with pytest.raises(HTTPException, match="Invalid token subject"):
        dependencies.get_current_user(
            credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials="x"),
            session=_SessionQueue(),
        )

    monkeypatch.setattr(dependencies, "decode_access_token", lambda token: {"sub": "u1"})
    inactive_session = _SessionQueue(results=[[{"id": "u1", "is_active": False}]])
    with pytest.raises(HTTPException, match="User not active"):
        dependencies.get_current_user(
            credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials="x"),
            session=inactive_session,
        )

    active_session = _SessionQueue(results=[[{"id": "u1", "email": "a@b.com", "role": "USER", "is_active": True}]])
    current = dependencies.get_current_user(
        credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials="x"),
        session=active_session,
    )
    assert current["id"] == "u1"


def test_require_roles_and_repository_access() -> None:
    checker = dependencies.require_roles({"ADMIN"})
    with pytest.raises(HTTPException, match="Insufficient role"):
        checker(current_user={"role": "USER"})
    assert checker(current_user={"role": "ADMIN", "id": "a1"})["id"] == "a1"

    allowed_session = _SessionQueue(results=[[{"id": "rid", "repo_id": "demo"}]])
    allowed = dependencies.ensure_repository_access(allowed_session, "demo", "u1")
    assert allowed["repo_id"] == "demo"

    missing_repo_session = _SessionQueue(results=[[], []])
    with pytest.raises(HTTPException, match="Repository not found"):
        dependencies.ensure_repository_access(missing_repo_session, "demo", "u1")

    forbidden_session = _SessionQueue(results=[[], [{"id": "exists"}]])
    with pytest.raises(HTTPException, match="Not authorized"):
        dependencies.ensure_repository_access(forbidden_session, "demo", "u1")


def test_admin_list_and_update_routes() -> None:
    session = _SessionQueue(
        results=[
            [{"id": "u1", "role": "ADMIN"}],
            [{"id": "r1"}],
            [{"id": "i1"}],
            [{"id": "j1", "status": "running"}],
            [{"id": "ru1", "email": "recent@example.com", "role": "USER", "is_active": True}],
            [],
            [{"id": "u2", "email": "x@x.com", "full_name": "X", "role": "ADMIN", "is_active": True}],
            [],
            [{"id": "u3", "email": "y@y.com", "full_name": "Y", "role": "USER", "is_active": False}],
            [{"id": "u4", "email": "z@z.com"}],
        ]
    )

    assert _payload(admin_module.admin_users(_={"id": "admin"}, session=session))[0]["id"] == "u1"
    assert _payload(admin_module.admin_repositories(_={"id": "admin"}, session=session))[0]["id"] == "r1"
    assert _payload(admin_module.admin_indexing_status(_={"id": "admin"}, session=session))[0]["id"] == "i1"
    activity = _payload(admin_module.admin_recent_activity(_={"id": "admin"}, session=session))
    assert activity["indexing_jobs"][0]["id"] == "j1"
    assert activity["recent_users"][0]["role"] == "USER"

    updated_role = admin_module.update_user_role(
        "u2",
        admin_module.UserRoleUpdate(role="ADMIN"),
        current_admin={"id": "admin"},
        session=session,
    )
    assert _payload(updated_role)["role"] == "ADMIN"

    updated_status = admin_module.update_user_status(
        "u3",
        admin_module.UserActiveUpdate(is_active=False),
        current_admin={"id": "admin"},
        session=session,
    )
    assert _payload(updated_status)["id"] == "u3"

    deleted = admin_module.delete_user("u4", current_admin={"id": "admin"}, session=session)
    assert _payload(deleted)["deleted"] is True


def test_admin_guardrail_and_not_found_branches() -> None:
    session = _SessionQueue(results=[[]])

    with pytest.raises(HTTPException, match="Invalid role"):
        admin_module.update_user_role(
            "u1",
            admin_module.UserRoleUpdate(role="wrong"),
            current_admin={"id": "admin"},
            session=session,
        )

    with pytest.raises(HTTPException, match="Cannot demote yourself"):
        admin_module.update_user_role(
            "admin",
            admin_module.UserRoleUpdate(role="USER"),
            current_admin={"id": "admin"},
            session=session,
        )

    with pytest.raises(HTTPException, match="Cannot deactivate yourself"):
        admin_module.update_user_status(
            "admin",
            admin_module.UserActiveUpdate(is_active=False),
            current_admin={"id": "admin"},
            session=session,
        )

    with pytest.raises(HTTPException, match="Cannot delete yourself"):
        admin_module.delete_user("admin", current_admin={"id": "admin"}, session=session)

    with pytest.raises(HTTPException, match="User not found"):
        admin_module.delete_user("missing", current_admin={"id": "admin"}, session=session)


def test_admin_system_metrics() -> None:
    counts_session = _SessionQueue(results=[[{"users_count": 1}]])
    assert _payload(admin_module.admin_system_metrics(_={"id": "admin"}, session=counts_session))["users_count"] == 1

    empty_session = _SessionQueue(results=[[]])
    assert _payload(admin_module.admin_system_metrics(_={"id": "admin"}, session=empty_session)) == {}


def test_admin_service_health(monkeypatch: pytest.MonkeyPatch) -> None:
    class _OkResponse:
        def raise_for_status(self):
            return None

    class _FailResponse:
        def raise_for_status(self):
            raise RuntimeError("down")

    class _Client:
        def __init__(self, timeout=3.0):
            _ = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url: str):
            if url.endswith("/collections"):
                return _OkResponse()
            return _FailResponse()

    class _Redis:
        def __init__(self, **kwargs):
            _ = kwargs

        def ping(self):
            raise RuntimeError("redis down")

    monkeypatch.setattr(admin_module.httpx, "Client", _Client)
    monkeypatch.setattr(admin_module.redis, "Redis", _Redis)

    statuses = _payload(admin_module.admin_service_health(_={"id": "admin"}, session=_SessionQueue(results=[[{"ok": 1}]])))
    by_name = {item["name"]: item["status"] for item in statuses}
    assert by_name["Backend API"] == "online"
    assert by_name["PostgreSQL"] == "online"
    assert by_name["Qdrant"] == "online"
    assert by_name["Redis"] == "offline"
    assert by_name["Ollama"] == "offline"


def test_ensure_app_schema_role_normalization_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeConnection:
        def __init__(self, existing_rows):
            self.existing_rows = existing_rows
            self.exec_calls = 0

        def execute(self, *_args, **_kwargs):
            self.exec_calls += 1
            if self.exec_calls == 3:
                return _Result(self.existing_rows)
            return _Result([])

    class FakeBegin:
        def __init__(self, connection):
            self.connection = connection

        def __enter__(self):
            return self.connection

        def __exit__(self, exc_type, exc, tb):
            return False

    class FakeEngine:
        def __init__(self, connection):
            self.connection = connection

        def begin(self):
            return FakeBegin(self.connection)

    conn_noop = FakeConnection(existing_rows=[])
    monkeypatch.setattr(schema_module, "engine", FakeEngine(conn_noop))
    schema_module.ensure_app_schema()
    assert conn_noop.exec_calls >= 4
