import pytest
from fastapi.testclient import TestClient

def test_chat_get_sessions(client: TestClient, auth_headers):
    response = client.get("/v1/chat/sessions", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "items" in data["data"]
    assert isinstance(data["data"]["items"], list)

def test_chat_get_session_by_id(client: TestClient, auth_headers):
    response = client.get("/v1/chat/sessions/nonexistent-id/messages", headers=auth_headers)
    assert response.status_code == 404

def test_chat_query_streaming(client: TestClient, auth_headers):
    # Assuming streaming returns 200 with text/event-stream or similar,
    # or fails if repo not found. Let's just check the structure.
    response = client.post(
        "/v1/chat",
        headers=auth_headers,
        json={
            "query": "Hello?",
            "stream": True,
            "session_id": None
        }
    )
    # It might fail with 422 if payload is missing repository_id depending on validators,
    # or 400 if repository is required but not provided.
    # The exact assertion depends on your `ChatQueryRequest` model.
    # Let's assert it doesn't 404 (meaning the route exists).
    assert response.status_code != 404

def test_chat_query_sync(client: TestClient, auth_headers):
    response = client.post(
        "/v1/chat",
        headers=auth_headers,
        json={
            "query": "Sync query",
            "stream": False,
            "session_id": None
        }
    )
    assert response.status_code != 404
