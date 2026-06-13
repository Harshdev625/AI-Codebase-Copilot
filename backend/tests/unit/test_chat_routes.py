import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.models import ChatSession, User


def test_chat_get_sessions(client: TestClient, auth_headers):
    response = client.get("/v1/chat/sessions", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "items" in data["data"]
    assert isinstance(data["data"]["items"], list)


def test_chat_get_session_by_id_messages_404(client: TestClient, auth_headers):
    response = client.get("/v1/chat/sessions/nonexistent-id/messages", headers=auth_headers)
    assert response.status_code == 404


def test_chat_session_crud_and_metadata(client: TestClient, auth_headers, test_user, db_session):
    session_id = str(uuid.uuid4())
    chat = ChatSession(
        id=session_id,
        user_id=str(test_user["id"]),
        session_title="Studio test session",
        session_metadata={},
    )
    db_session.add(chat)
    db_session.commit()

    list_resp = client.get("/v1/chat/sessions", headers=auth_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()["data"]["items"]
    assert any(item["id"] == session_id for item in items)
    listed = next(item for item in items if item["id"] == session_id)
    assert listed["metadata"] == {}

    get_resp = client.get(f"/v1/chat/sessions/{session_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["session_title"] == "Studio test session"

    patch_resp = client.patch(
        f"/v1/chat/sessions/{session_id}",
        headers=auth_headers,
        json={"metadata": {"scope_paths": ["src/"]}},
    )
    assert patch_resp.status_code == 200
    patched = patch_resp.json()["data"]
    assert patched["metadata"]["scope_paths"] == ["src/"]

    get_again = client.get(f"/v1/chat/sessions/{session_id}", headers=auth_headers)
    assert get_again.json()["data"]["metadata"]["scope_paths"] == ["src/"]


def test_chat_query_streaming(client: TestClient, auth_headers):
    response = client.post(
        "/v1/chat",
        headers=auth_headers,
        json={
            "query": "Hello?",
            "stream": True,
            "session_id": None,
        },
    )
    assert response.status_code != 404


def test_chat_query_sync(client: TestClient, auth_headers):
    response = client.post(
        "/v1/chat",
        headers=auth_headers,
        json={
            "query": "Sync query",
            "stream": False,
            "session_id": None,
        },
    )
    assert response.status_code != 404
