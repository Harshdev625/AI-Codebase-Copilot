from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.core.security import hash_password
from app.db.database import get_db_session


def _create_schema(session: Session) -> None:
    statements = [
        """
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT,
          role TEXT NOT NULL,
          is_active BOOLEAN NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE project_memberships (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          membership_role TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE repositories (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          repo_id TEXT UNIQUE NOT NULL,
          remote_url TEXT,
          local_path TEXT,
          default_branch TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "CREATE TABLE conversations (id TEXT PRIMARY KEY, project_id TEXT, user_id TEXT, title TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, role TEXT, content TEXT, metadata TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE agent_runs (id TEXT PRIMARY KEY, conversation_id TEXT, user_id TEXT, project_id TEXT, repo_id TEXT, query TEXT, intent TEXT, status TEXT, diagnostics TEXT DEFAULT '{}', started_at TEXT DEFAULT CURRENT_TIMESTAMP, finished_at TEXT)",
        "CREATE TABLE code_chunks (id TEXT PRIMARY KEY, repo_id TEXT)",
    ]
    for statement in statements:
        session.execute(text(statement))
    session.commit()


@pytest.fixture
def session_factory() -> Generator[sessionmaker, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = SessionLocal()
    try:
        _create_schema(session)
    finally:
        session.close()
    yield SessionLocal
    engine.dispose()


@pytest.fixture
def test_app(session_factory: sessionmaker) -> FastAPI:
    app = FastAPI()
    app.include_router(auth_router, prefix="/v1")
    app.include_router(admin_router, prefix="/v1")
    app.include_router(chat_router, prefix="/v1")

    def override_db() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db_session] = override_db
    return app


@pytest.fixture
def client(test_app: FastAPI) -> TestClient:
    return TestClient(test_app)


def _insert_user(session_factory: sessionmaker, user_id: str, email: str, role: str = "USER") -> None:
    session = session_factory()
    try:
        session.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, full_name, role, is_active)
                VALUES (:id, :email, :password_hash, :full_name, :role, 1)
                """
            ),
            {
                "id": user_id,
                "email": email,
                "password_hash": hash_password("password123"),
                "full_name": email.split("@")[0],
                "role": role,
            },
        )
        session.commit()
    finally:
        session.close()


def _login(client: TestClient, email: str, password: str = "password123") -> str:
    response = client.post("/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    payload = _payload(response)
    return payload["access_token"]


def _payload(response) -> dict:
    body = response.json()
    if isinstance(body, dict) and "success" in body and "data" in body:
        return body.get("data") or {}
    return body


def _error(response) -> str:
    body = response.json()
    if isinstance(body, dict) and "success" in body and "error" in body:
        return str(body.get("error") or "")
    return str(body.get("detail") or body.get("error") or "")


def test_register_login_and_me_flow(client: TestClient) -> None:
    register_response = client.post(
        "/v1/auth/register",
        json={"email": "dev@example.com", "password": "password123", "full_name": "Dev User"},
    )
    assert register_response.status_code == 201
    assert _payload(register_response)["role"] == "USER"

    token = _login(client, "dev@example.com")
    me_response = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert me_response.status_code == 200
    assert _payload(me_response)["email"] == "dev@example.com"


def test_admin_register_with_secret_and_admin_login(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.api.v1.auth.settings.admin_registration_secret_key", "top-secret")

    register_response = client.post(
        "/v1/auth/admin/register",
        json={
            "email": "admin-register@example.com",
            "password": "password123",
            "full_name": "Admin Register",
            "admin_secret_key": "top-secret",
        },
    )
    assert register_response.status_code == 201
    assert _payload(register_response)["role"] == "ADMIN"

    admin_login_response = client.post(
        "/v1/auth/admin/login",
        json={"email": "admin-register@example.com", "password": "password123"},
    )
    assert admin_login_response.status_code == 200
    assert "access_token" in _payload(admin_login_response)


def test_admin_register_and_login_reject_invalid_secret_or_non_admin(
    client: TestClient,
    session_factory: sessionmaker,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.api.v1.auth.settings.admin_registration_secret_key", "top-secret")

    wrong_secret_response = client.post(
        "/v1/auth/admin/register",
        json={
            "email": "wrong-secret@example.com",
            "password": "password123",
            "full_name": "Wrong Secret",
            "admin_secret_key": "invalid",
        },
    )
    assert wrong_secret_response.status_code == 403

    _insert_user(session_factory, "dev-admin-login", "developer-login@example.com", role="USER")
    developer_admin_login = client.post(
        "/v1/auth/admin/login",
        json={"email": "developer-login@example.com", "password": "password123"},
    )
    assert developer_admin_login.status_code == 403

def test_admin_endpoint_requires_admin_role(client: TestClient, session_factory: sessionmaker) -> None:
    _insert_user(session_factory, "user-1", "developer@example.com", role="USER")
    developer_token = _login(client, "developer@example.com")

    forbidden = client.get(
        "/v1/admin/system-metrics",
        headers={"Authorization": f"Bearer {developer_token}"},
    )
    assert forbidden.status_code == 403

    _insert_user(session_factory, "admin-1", "admin@example.com", role="ADMIN")
    admin_token = _login(client, "admin@example.com")
    allowed = client.get(
        "/v1/admin/system-metrics",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert allowed.status_code == 200
    assert "users_count" in _payload(allowed)


def test_chat_requires_repository_membership(
    client: TestClient,
    session_factory: sessionmaker,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _insert_user(session_factory, "user-2", "chat-user@example.com", role="USER")
    session = session_factory()
    try:
        session.execute(
            text(
                """
                INSERT INTO projects (id, name, description, created_by)
                VALUES ('project-2', 'Chat Project', 'desc', 'user-2')
                """
            )
        )
        session.execute(
            text(
                """
                INSERT INTO repositories (id, project_id, repo_id, remote_url, local_path, default_branch)
                VALUES ('repo-2', 'project-2', 'chat-repo', 'https://example.com/chat.git', NULL, 'main')
                """
            )
        )
        session.commit()
    finally:
        session.close()

    monkeypatch.setattr(
        "app.api.v1.chat.QueryService.run",
        lambda *_args, **_kwargs: {"answer": "hello", "intent": "qna", "retrieved_context": []},
    )

    token = _login(client, "chat-user@example.com")
    unauthorized = client.post(
        "/v1/chat",
        json={"repo_id": "chat-repo", "query": "hello"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert unauthorized.status_code == 403

    session = session_factory()
    try:
        session.execute(
            text(
                """
                INSERT INTO project_memberships (id, project_id, user_id, membership_role)
                VALUES ('membership-2', 'project-2', 'user-2', 'owner')
                """
            )
        )
        session.commit()
    finally:
        session.close()

    authorized = client.post(
        "/v1/chat",
        json={"repo_id": "chat-repo", "query": "hello"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert authorized.status_code == 200
    assert _payload(authorized)["answer"] == "hello"


def test_chat_returns_503_when_query_service_fails(
    client: TestClient,
    session_factory: sessionmaker,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _insert_user(session_factory, "user-3", "chat-fail@example.com", role="USER")
    session = session_factory()
    try:
        session.execute(
            text(
                """
                INSERT INTO projects (id, name, description, created_by)
                VALUES ('project-3', 'Failing Chat Project', 'desc', 'user-3')
                """
            )
        )
        session.execute(
            text(
                """
                INSERT INTO repositories (id, project_id, repo_id, remote_url, local_path, default_branch)
                VALUES ('repo-3', 'project-3', 'chat-repo-fail', 'https://example.com/chat-fail.git', NULL, 'main')
                """
            )
        )
        session.execute(
            text(
                """
                INSERT INTO project_memberships (id, project_id, user_id, membership_role)
                VALUES ('membership-3', 'project-3', 'user-3', 'owner')
                """
            )
        )
        session.commit()
    finally:
        session.close()

    def raise_runtime_error(*_args, **_kwargs):
        raise RuntimeError("Query engine unavailable")

    monkeypatch.setattr("app.api.v1.chat.QueryService.run", raise_runtime_error)

    token = _login(client, "chat-fail@example.com")
    response = client.post(
        "/v1/chat",
        json={"repo_id": "chat-repo-fail", "query": "hello"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 503
    assert _error(response) == "AI service is temporarily unavailable. Please retry shortly."