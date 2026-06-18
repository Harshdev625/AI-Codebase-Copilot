"""B11 — SQLite TestClient smoke flows (no live server)."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.db.models import ChatSession


def _payload(response):
    body = response.json()
    if isinstance(body, dict) and "success" in body and "data" in body:
        return body["data"]
    return body


def _register_and_login(client: TestClient) -> tuple[dict[str, str], str]:
    email = f"e2e+{uuid.uuid4().hex[:8]}@example.com"
    password = "password123"

    register = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert register.status_code in (200, 201), register.text

    login = client.post("/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = _payload(login).get("access_token") or login.json().get("access_token")
    assert token

    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    user = _payload(me)
    assert user["email"] == email
    return headers, user["id"]


def test_auth_dashboard_and_repository_flow(client: TestClient):
    headers, user_id = _register_and_login(client)

    dashboard = client.get("/v1/dashboard/me", headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    dash = _payload(dashboard)
    assert dash["user"]["id"] == user_id
    assert dash["metrics"]["repositories_count"] == 0

    create_repo = client.post(
        "/v1/repositories",
        json={"repo_id": "e2e/smoke-repo", "local_path": "/tmp/smoke", "default_branch": "main"},
        headers=headers,
    )
    assert create_repo.status_code == 201, create_repo.text
    repo = _payload(create_repo)

    list_repos = client.get("/v1/repositories", headers=headers)
    assert list_repos.status_code == 200, list_repos.text
    items = _payload(list_repos).get("items", [])
    assert any(item["id"] == repo["id"] for item in items)

    tree = client.get(f"/v1/repositories/{repo['id']}/tree", headers=headers)
    assert tree.status_code == 200, tree.text

    dashboard_after = client.get("/v1/dashboard/me", headers=headers)
    assert _payload(dashboard_after)["metrics"]["repositories_count"] == 1


def test_chat_session_soft_delete_hides_from_list(client: TestClient, db_session):
    headers, user_id = _register_and_login(client)

    create_repo = client.post(
        "/v1/repositories",
        json={"repo_id": "e2e/session-repo", "local_path": "/tmp/session", "default_branch": "main"},
        headers=headers,
    )
    assert create_repo.status_code == 201
    repo_id = _payload(create_repo)["id"]

    session_id = f"sess-{uuid.uuid4().hex[:12]}"
    db_session.add(
        ChatSession(
            id=session_id,
            user_id=user_id,
            repository_id=repo_id,
            session_title="Smoke session",
            session_mode="ASK",
        )
    )
    db_session.flush()

    listed = client.get("/v1/chat/sessions", headers=headers)
    assert listed.status_code == 200
    items = _payload(listed).get("items", [])
    assert any(item["id"] == session_id for item in items)

    deleted = client.delete(f"/v1/chat/sessions/{session_id}", headers=headers)
    assert deleted.status_code == 200, deleted.text

    listed_after = client.get("/v1/chat/sessions", headers=headers)
    items_after = _payload(listed_after).get("items", [])
    assert not any(item["id"] == session_id for item in items_after)

    missing = client.get(f"/v1/chat/sessions/{session_id}", headers=headers)
    assert missing.status_code == 404


def test_admin_metrics_requires_admin_role(client: TestClient, admin_headers, auth_headers):
    ok = client.get("/v1/admin/system-metrics", headers=admin_headers)
    assert ok.status_code == 200

    forbidden = client.get("/v1/admin/system-metrics", headers=auth_headers)
    assert forbidden.status_code == 403
