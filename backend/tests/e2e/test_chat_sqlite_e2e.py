from __future__ import annotations

import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


def _payload(response):
    body = response.json()
    if isinstance(body, dict) and "success" in body and "data" in body:
        return body["data"]
    return body


@pytest.fixture
def sqlite_client(tmp_path: Path):
    """Create a temporary SQLite database and initialize the app with it."""
    db_path = tmp_path / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"

    # Clear any previously imported modules to ensure clean reload
    modules_to_clear = [m for m in sys.modules.keys() if m.startswith("app.")]
    for mod in modules_to_clear:
        del sys.modules[mod]

    # Now import and initialize
    from app.db.database import Base, engine
    from app.main import app

    # Create all tables
    with engine.begin() as conn:
        Base.metadata.create_all(bind=conn)

    client = TestClient(app)
    try:
        yield client
    finally:
        client.close()
        if db_path.exists():
            db_path.unlink(missing_ok=True)
        os.environ.pop("DATABASE_URL", None)


def test_chat_returns_409_when_no_index(sqlite_client: TestClient):
    # Register
    r = sqlite_client.post(
        "/v1/auth/register",
        json={"email": "e2e@example.com", "password": "password123"},
    )
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"

    # Login
    r = sqlite_client.post(
        "/v1/auth/login",
        json={"email": "e2e@example.com", "password": "password123"},
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    login_data = r.json()
    token = login_data.get("data", {}).get("access_token") or login_data.get("access_token")
    assert token, f"No token in response: {login_data}"
    headers = {"Authorization": f"Bearer {token}"}

    # Add repository
    r = sqlite_client.post(
        "/v1/repositories",
        json={"repo_id": "e2e/repo", "local_path": "/tmp/repo", "default_branch": "main"},
        headers=headers,
    )
    assert r.status_code == 201, f"Add repo failed: {r.status_code} {r.text}"
    repo_data = r.json()
    repo = repo_data.get("data", repo_data)

    # Chat should return 409 (no index available in SQLite test)
    r = sqlite_client.post(
        "/v1/chat",
        json={"repository_id": repo.get("id"), "query": "What is this repo?"},
        headers=headers,
    )
    assert r.status_code == 409, f"Chat failed: expected 409, got {r.status_code} {r.text}"
