import pytest
from fastapi import status
from sqlalchemy import text

from app.main import app
from app.api.dependencies import get_current_user

@pytest.fixture
def override_current_user():
    def _override():
        return {
            "id": "test-dashboard-user-id",
            "email": "dashboard@example.com",
            "role": "user",
            "token_scopes": ["repository:read"],
            "is_active": True
        }
    return _override

@pytest.fixture(autouse=True)
def _override_dependency(client, override_current_user):
    client.app.dependency_overrides[get_current_user] = override_current_user
    yield
    client.app.dependency_overrides.clear()

@pytest.fixture
def override_unauthorized_user():
    def _override():
        return {
            "id": "test-user-id",
            "email": "test@example.com",
            "role": "user",
            "token_scopes": [],
            "is_active": True
        }
    app.dependency_overrides[get_current_user] = _override
    yield
    app.dependency_overrides.pop(get_current_user, None)

def test_dashboard_me_success(client, override_current_user, db_session):
    from app.db.models import User, Repository, ChatSession, CodeChunk

    user = User(id="test-dashboard-user-id", email="dashboard@example.com", password_hash="hash", role="user", is_active=True)
    db_session.merge(user)

    repo = Repository(id="repo-dash-1", repo_id="test/repo-dash-1", remote_url="url1", local_path="path1", owner_user_id="test-dashboard-user-id", default_branch="main")
    db_session.merge(repo)

    chat = ChatSession(
        id="session-dash-1",
        user_id="test-dashboard-user-id",
        repository_id="repo-dash-1",
        session_title="Debug session",
        session_mode="ASK",
        is_archived=False,
    )
    db_session.merge(chat)

    chunk = CodeChunk(id="chunk-dash-1", repo_id="test/repo-dash-1", repository_id="repo-dash-1", path="file.py", content="code", start_line=1, end_line=10, commit_sha="local", language="python", symbol="", chunk_type="generic")
    db_session.merge(chunk)
    db_session.flush()

    response = client.get("/v1/dashboard/me")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    assert data["user"]["id"] == "test-dashboard-user-id"
    assert data["user"]["email"] == "dashboard@example.com"

    assert data["metrics"]["repositories_count"] == 1
    assert data["metrics"]["chat_count"] == 1
    assert data["metrics"]["indexed_chunks_count"] == 1
    assert "indexed_files_count" in data["metrics"]
    assert "active_indexing_jobs" in data["metrics"]
    assert "last_activity_at" in data["metrics"]

    assert data["indexing_summary"]["ready"] >= 0
    assert "idle" in data["indexing_summary"]

    assert len(data["recent_repositories"]) == 1
    assert data["recent_repositories"][0]["id"] == "repo-dash-1"
    assert "indexed_chunks_count" in data["recent_repositories"][0]

    assert len(data["recent_sessions"]) == 1
    assert data["recent_sessions"][0]["id"] == "session-dash-1"
    assert data["recent_sessions"][0]["session_mode"] == "ASK"

def test_dashboard_activity_success(client, override_current_user, db_session):
    from app.db.models import User, Repository, ChatSession

    user = User(id="test-dashboard-user-id", email="dashboard@example.com", password_hash="hash", role="user", is_active=True)
    db_session.merge(user)
    repo = Repository(id="repo-dash-1", repo_id="test/repo-dash-1", remote_url="url1", local_path="path1", owner_user_id="test-dashboard-user-id", default_branch="main")
    db_session.merge(repo)
    chat = ChatSession(id="session-act-1", user_id="test-dashboard-user-id", repository_id="repo-dash-1")
    db_session.merge(chat)
    db_session.flush()

    response = client.get("/v1/dashboard/activity?days=7")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()["data"]
    assert "days" in data
    assert len(data["days"]) == 7
    assert all("date" in d and "sessions" in d and "indexing_jobs_completed" in d for d in data["days"])

def test_dashboard_me_unauthorized(client, override_unauthorized_user):
    response = client.get("/v1/dashboard/me")
    assert response.status_code == status.HTTP_200_OK
