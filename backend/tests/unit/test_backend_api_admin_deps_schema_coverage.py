from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api import dependencies
from app.api.v1 import admin as admin_module
from app.api.v1.tools import execute_tool
from app.db import schema as schema_module
from app.models.api_models import ToolRequest


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

    active_session = _SessionQueue(results=[[{"id": "u1", "email": "a@b.com", "role": "developer", "is_active": True}]])
    current = dependencies.get_current_user(
        credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials="x"),
        session=active_session,
    )
    assert current["id"] == "u1"


def test_require_roles_and_repository_access() -> None:
    checker = dependencies.require_roles({"admin"})
    with pytest.raises(HTTPException, match="Insufficient role"):
        checker(current_user={"role": "developer"})
    assert checker(current_user={"role": "admin", "id": "a1"})["id"] == "a1"

    allowed_session = _SessionQueue(results=[[{"id": "rid", "repo_id": "demo"}]])
    allowed = dependencies.ensure_repository_access(allowed_session, "demo", "u1")
    assert allowed["repo_id"] == "demo"

    missing_repo_session = _SessionQueue(results=[[], []])
    with pytest.raises(HTTPException, match="Repository not found"):
        dependencies.ensure_repository_access(missing_repo_session, "demo", "u1")

    forbidden_session = _SessionQueue(results=[[], [{"id": "exists"}]])
    with pytest.raises(HTTPException, match="Not authorized"):
        dependencies.ensure_repository_access(forbidden_session, "demo", "u1")


def test_tools_execute_all_supported_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.v1.tools as tools_module

    monkeypatch.setattr(tools_module, "read_file", lambda path: f"file:{path}")
    monkeypatch.setattr(tools_module, "git_status", lambda repo_path: f"git:{repo_path}")
    monkeypatch.setattr(tools_module, "is_command_allowed", lambda command: command == "echo ok")
    monkeypatch.setattr(tools_module, "run_command", lambda command, cwd=None: f"run:{command}:{cwd}")

    out_file = execute_tool(ToolRequest(tool_name="read_file", args={"path": "x.py"}))
    assert out_file.success is True and out_file.output == "file:x.py"

    out_git = execute_tool(ToolRequest(tool_name="git_status", args={"repo_path": "."}))
    assert out_git.success is True and out_git.output == "git:."

    blocked = execute_tool(ToolRequest(tool_name="run_command", args={"command": "rm -rf /"}))
    assert blocked.success is False

    allowed = execute_tool(ToolRequest(tool_name="run_command", args={"command": "echo ok", "cwd": "tmp"}))
    assert allowed.success is True and "run:echo ok:tmp" in allowed.output

    unsupported = execute_tool(SimpleNamespace(tool_name="something_else", args={}))
    assert unsupported.success is False and "Unsupported" in unsupported.output


def test_admin_list_and_update_routes() -> None:
    session = _SessionQueue(
        results=[
            [{"id": "u1"}],
            [{"id": "r1"}],
            [{"id": "i1"}],
            [{"id": "a1"}],
            [],
            [{"id": "u2", "email": "x@x.com", "full_name": "X", "role": "admin", "is_active": True}],
            [],
            [{"id": "u3", "email": "y@y.com", "full_name": "Y", "role": "developer", "is_active": False}],
            [{"id": "u4", "email": "z@z.com"}],
        ]
    )

    assert admin_module.admin_users(_={"id": "admin"}, session=session)[0]["id"] == "u1"
    assert admin_module.admin_repositories(_={"id": "admin"}, session=session)[0]["id"] == "r1"
    assert admin_module.admin_indexing_status(_={"id": "admin"}, session=session)[0]["id"] == "i1"
    assert admin_module.admin_agent_runs(_={"id": "admin"}, session=session)[0]["id"] == "a1"

    updated_role = admin_module.update_user_role(
        "u2",
        admin_module.UserRoleUpdate(user_id="u2", role="admin"),
        current_admin={"id": "admin"},
        session=session,
    )
    assert updated_role["role"] == "admin"

    updated_status = admin_module.update_user_status(
        "u3",
        admin_module.UserActiveUpdate(user_id="u3", is_active=False),
        current_admin={"id": "admin"},
        session=session,
    )
    assert updated_status["id"] == "u3"

    deleted = admin_module.delete_user("u4", current_admin={"id": "admin"}, session=session)
    assert deleted["deleted"] is True


def test_admin_guardrail_and_not_found_branches() -> None:
    session = _SessionQueue(results=[[]])

    with pytest.raises(HTTPException, match="Invalid role"):
        admin_module.update_user_role(
            "u1",
            admin_module.UserRoleUpdate(user_id="u1", role="wrong"),
            current_admin={"id": "admin"},
            session=session,
        )

    with pytest.raises(HTTPException, match="Cannot demote yourself"):
        admin_module.update_user_role(
            "admin",
            admin_module.UserRoleUpdate(user_id="admin", role="developer"),
            current_admin={"id": "admin"},
            session=session,
        )

    with pytest.raises(HTTPException, match="Cannot deactivate yourself"):
        admin_module.update_user_status(
            "admin",
            admin_module.UserActiveUpdate(user_id="admin", is_active=False),
            current_admin={"id": "admin"},
            session=session,
        )

    with pytest.raises(HTTPException, match="Cannot delete yourself"):
        admin_module.delete_user("admin", current_admin={"id": "admin"}, session=session)

    with pytest.raises(HTTPException, match="User not found"):
        admin_module.delete_user("missing", current_admin={"id": "admin"}, session=session)


def test_admin_system_metrics(monkeypatch: pytest.MonkeyPatch) -> None:
    counts_session = _SessionQueue(results=[[{"users_count": 1}]])
    assert admin_module.admin_system_metrics(_={"id": "admin"}, session=counts_session)["users_count"] == 1

    empty_session = _SessionQueue(results=[[]])
    assert admin_module.admin_system_metrics(_={"id": "admin"}, session=empty_session) == {}


def test_ensure_app_schema_bootstrap_paths(monkeypatch: pytest.MonkeyPatch) -> None:
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

    monkeypatch.setattr(schema_module.settings, "bootstrap_admin_email", "", raising=False)
    monkeypatch.setattr(schema_module.settings, "bootstrap_admin_password", "", raising=False)
    conn_no_bootstrap = FakeConnection(existing_rows=[])
    monkeypatch.setattr(schema_module, "engine", FakeEngine(conn_no_bootstrap))
    schema_module.ensure_app_schema()
    assert conn_no_bootstrap.exec_calls == 2

    monkeypatch.setattr(schema_module.settings, "bootstrap_admin_email", "admin@example.com", raising=False)
    monkeypatch.setattr(schema_module.settings, "bootstrap_admin_password", "pass12345", raising=False)
    monkeypatch.setattr(schema_module.settings, "bootstrap_admin_full_name", "Admin", raising=False)

    conn_insert = FakeConnection(existing_rows=[])
    monkeypatch.setattr(schema_module, "engine", FakeEngine(conn_insert))
    schema_module.ensure_app_schema()
    assert conn_insert.exec_calls >= 4

    conn_update = FakeConnection(existing_rows=[{"id": "u1", "role": "developer", "is_active": False}])
    monkeypatch.setattr(schema_module, "engine", FakeEngine(conn_update))
    schema_module.ensure_app_schema()
    assert conn_update.exec_calls >= 4
