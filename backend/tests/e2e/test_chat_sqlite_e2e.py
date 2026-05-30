from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

def _payload(response):
    body = response.json()
    if isinstance(body, dict) and "success" in body and "data" in body:
        return body["data"]
    return body

def test_chat_returns_409_when_no_index(client: TestClient):
    # Register
    r = client.post(
        "/v1/auth/register",
        json={"email": "e2e@example.com", "password": "password123"},
    )
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"

    # Login
    r = client.post(
        "/v1/auth/login",
        json={"email": "e2e@example.com", "password": "password123"},
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    login_data = r.json()
    token = login_data.get("data", {}).get("access_token") or login_data.get("access_token")
    assert token, f"No token in response: {login_data}"
    headers = {"Authorization": f"Bearer {token}"}

    # Add repository
    r = client.post(
        "/v1/repositories",
        json={"repo_id": "e2e/repo", "local_path": "/tmp/repo", "default_branch": "main"},
        headers=headers,
    )
    assert r.status_code == 201, f"Add repo failed: {r.status_code} {r.text}"
    repo_data = r.json()
    repo = repo_data.get("data", repo_data)

    # Chat should return 409 (no index available in SQLite test)
    r = client.post(
        "/v1/chat",
        json={"repository_id": repo.get("id"), "query": "What is this repo?"},
        headers=headers,
    )
    assert r.status_code == 409, f"Chat failed: expected 409, got {r.status_code} {r.text}"
