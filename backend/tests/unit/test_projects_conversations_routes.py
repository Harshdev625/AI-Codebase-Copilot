from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.routes_auth import router as auth_router
from app.api.v1.routes_conversations import router as conversations_router
from app.api.v1.routes_projects import router as projects_router
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
        """
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          user_id TEXT,
          title TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT,
          role TEXT,
          content TEXT,
          metadata TEXT DEFAULT '{}',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE agent_runs (
          id TEXT PRIMARY KEY,
          conversation_id TEXT,
          user_id TEXT,
          project_id TEXT,
          repo_id TEXT,
          query TEXT,
          intent TEXT,
          status TEXT,
          diagnostics TEXT DEFAULT '{}',
          started_at TEXT DEFAULT CURRENT_TIMESTAMP,
          finished_at TEXT
        )
        """,
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
def app(session_factory: sessionmaker) -> FastAPI:
    fastapi_app = FastAPI()
    fastapi_app.include_router(auth_router, prefix="/v1")
    fastapi_app.include_router(projects_router, prefix="/v1")
    fastapi_app.include_router(conversations_router, prefix="/v1")

    def override_db() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    fastapi_app.dependency_overrides[get_db_session] = override_db
    return fastapi_app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


def _insert_user(session_factory: sessionmaker, user_id: str, email: str, role: str = "developer") -> None:
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


def _login(client: TestClient, email: str) -> str:
    response = client.post("/v1/auth/login", json={"email": email, "password": "password123"})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_create_and_list_project_for_current_user(client: TestClient, session_factory: sessionmaker) -> None:
    _insert_user(session_factory, "u-1", "owner@example.com")
    token = _login(client, "owner@example.com")

    create_response = client.post(
        "/v1/projects",
        json={"name": "Platform", "description": "Core project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_response.status_code == 201
    project_id = create_response.json()["id"]

    list_response = client.get("/v1/projects", headers={"Authorization": f"Bearer {token}"})
    assert list_response.status_code == 200
    assert any(project["id"] == project_id for project in list_response.json())


def test_add_and_list_repositories_for_project(client: TestClient, session_factory: sessionmaker) -> None:
    _insert_user(session_factory, "u-2", "repo@example.com")
    token = _login(client, "repo@example.com")

    create_project = client.post(
        "/v1/projects",
        json={"name": "RepoProject", "description": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    project_id = create_project.json()["id"]

    add_repo = client.post(
        f"/v1/projects/{project_id}/repositories",
        json={
            "repo_id": "demo-repo",
            "remote_url": "https://github.com/example/demo-repo",
            "local_path": None,
            "default_branch": "main",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_repo.status_code == 201

    list_repo = client.get(
        f"/v1/projects/{project_id}/repositories",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_repo.status_code == 200
    assert list_repo.json()[0]["repo_id"] == "demo-repo"


def test_create_and_list_conversation(client: TestClient, session_factory: sessionmaker) -> None:
    _insert_user(session_factory, "u-3", "chat@example.com")
    token = _login(client, "chat@example.com")

    create_project = client.post(
        "/v1/projects",
        json={"name": "ChatProject", "description": "chat flow"},
        headers={"Authorization": f"Bearer {token}"},
    )
    project_id = create_project.json()["id"]

    add_repo = client.post(
        f"/v1/projects/{project_id}/repositories",
        json={
            "repo_id": "chat-repo",
            "remote_url": "https://github.com/example/chat-repo",
            "local_path": None,
            "default_branch": "main",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_repo.status_code == 201

    create_conversation = client.post(
        f"/v1/projects/{project_id}/conversations",
        json={"title": "Architecture chat"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_conversation.status_code == 201
    conversation_id = create_conversation.json()["id"]

    list_messages = client.get(
        f"/v1/conversations/{conversation_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_messages.status_code == 200
    assert list_messages.json() == []
