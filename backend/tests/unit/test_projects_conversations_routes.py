from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.repositories import router as repositories_router
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
                CREATE TABLE repository_snapshots (
                    id TEXT PRIMARY KEY,
                    repository_id TEXT NOT NULL,
                    commit_sha TEXT,
                    branch TEXT,
                    index_status TEXT,
                    stats TEXT DEFAULT '{}',
                    indexed_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE indexing_jobs (
                    id TEXT PRIMARY KEY,
                    repository_id TEXT NOT NULL,
                    snapshot_id TEXT NOT NULL,
                    status TEXT,
                    message TEXT,
                    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    finished_at TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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

    @event.listens_for(engine, "connect")
    def _sqlite_now(conn, _record):  # type: ignore[no-untyped-def]
        conn.create_function("NOW", 0, lambda: "2026-01-01 00:00:00")

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
    fastapi_app.include_router(repositories_router, prefix="/v1")
    fastapi_app.include_router(chat_router, prefix="/v1")

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
    return _payload(response)["access_token"]


def _payload(response):
    body = response.json()
    if isinstance(body, dict) and "success" in body and "data" in body:
        return body.get("data")
    return body


def test_create_and_list_project_for_current_user(client: TestClient, session_factory: sessionmaker) -> None:
    _insert_user(session_factory, "u-1", "owner@example.com")
    token = _login(client, "owner@example.com")

    create_response = client.post(
        "/v1/projects",
        json={"name": "Platform", "description": "Core project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_response.status_code == 201
    project_id = _payload(create_response)["id"]

    list_response = client.get("/v1/projects", headers={"Authorization": f"Bearer {token}"})
    assert list_response.status_code == 200
    assert any(project["id"] == project_id for project in _payload(list_response))


def test_add_and_list_repositories_for_project(client: TestClient, session_factory: sessionmaker) -> None:
    _insert_user(session_factory, "u-2", "repo@example.com")
    token = _login(client, "repo@example.com")

    create_project = client.post(
        "/v1/projects",
        json={"name": "RepoProject", "description": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    project_id = _payload(create_project)["id"]

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
    assert _payload(list_repo)[0]["repo_id"] == "demo-repo"


def test_add_repository_duplicate_repo_id_returns_conflict(
    client: TestClient,
    session_factory: sessionmaker,
) -> None:
    _insert_user(session_factory, "u-5", "dup@example.com")
    token = _login(client, "dup@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    project_one = client.post(
        "/v1/projects",
        json={"name": "RepoProjectOne", "description": None},
        headers=headers,
    )
    project_two = client.post(
        "/v1/projects",
        json={"name": "RepoProjectTwo", "description": None},
        headers=headers,
    )
    project_one_id = _payload(project_one)["id"]
    project_two_id = _payload(project_two)["id"]

    first_add = client.post(
        f"/v1/projects/{project_one_id}/repositories",
        json={
            "repo_id": "dup-repo",
            "remote_url": "https://github.com/example/dup-repo",
            "local_path": None,
            "default_branch": "main",
        },
        headers=headers,
    )
    assert first_add.status_code == 201

    duplicate_add = client.post(
        f"/v1/projects/{project_two_id}/repositories",
        json={
            "repo_id": "dup-repo",
            "remote_url": "https://github.com/example/dup-repo2",
            "local_path": None,
            "default_branch": "main",
        },
        headers=headers,
    )
    assert duplicate_add.status_code == 409


def test_chat_stream_endpoint_exists(client: TestClient, session_factory: sessionmaker) -> None:
    _insert_user(session_factory, "u-3", "chat@example.com")
    token = _login(client, "chat@example.com")

    response = client.post(
        "/v1/chat/stream",
        json={"repo_id": "missing-repo", "query": "architecture"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code in {403, 404}


def test_index_uses_repository_source_and_returns_progress(
    client: TestClient,
    session_factory: sessionmaker,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.v1 import repositories as repositories_module

    _insert_user(session_factory, "u-4", "index@example.com")
    token = _login(client, "index@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_project = client.post(
        "/v1/projects",
        json={"name": "IndexProject", "description": "index flow"},
        headers=headers,
    )
    assert create_project.status_code == 201
    project_id = _payload(create_project)["id"]

    repo_id = "index-repo"
    add_repo = client.post(
        f"/v1/projects/{project_id}/repositories",
        json={
            "repo_id": repo_id,
            "remote_url": "https://github.com/example/index-repo",
            "local_path": None,
            "default_branch": "main",
        },
        headers=headers,
    )
    assert add_repo.status_code == 201

    captured = {}

    def fake_index_repository(self, **kwargs):  # type: ignore[no-untyped-def]
        captured.update(kwargs)
        return 7

    monkeypatch.setattr(repositories_module.IndexingService, "index_repository", fake_index_repository)
    monkeypatch.setattr(repositories_module, "SessionLocal", session_factory)

    index_response = client.post(
        "/v1/index",
        json={"repo_id": repo_id},
        headers=headers,
    )
    assert index_response.status_code == 202
    snapshot_id = _payload(index_response)["snapshot_id"]

    assert captured["repo_id"] == repo_id
    assert captured["repo_url"] == "https://github.com/example/index-repo"
    assert captured["repo_ref"] == "main"

    progress_response = client.get(f"/v1/index/progress/{snapshot_id}", headers=headers)
    assert progress_response.status_code == 200
    progress_payload = _payload(progress_response)
    assert progress_payload["snapshot_id"] == snapshot_id
    assert progress_payload["index_status"] in {"pending", "running", "completed", "failed"}
