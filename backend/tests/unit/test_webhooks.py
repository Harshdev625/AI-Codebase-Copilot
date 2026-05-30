import json
import hmac
import hashlib
from unittest.mock import patch, MagicMock
from sqlalchemy import text

import pytest
from fastapi.testclient import TestClient
from fastapi import status

from app.main import app
from app.core.config import settings



def create_signature(secret: str, body: bytes) -> str:
    signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={signature}"

@pytest.fixture
def webhook_secret(monkeypatch):
    secret = "test_secret"
    monkeypatch.setattr(settings, "github_webhook_secret", secret)
    return secret

def test_webhook_unconfigured(monkeypatch, client):
    monkeypatch.setattr(settings, "github_webhook_secret", None)
    response = client.post("/v1/webhooks/github")
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

def test_webhook_invalid_signature(webhook_secret, client):
    body = b"{}"
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={"x-hub-signature-256": "sha256=invalid"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

def test_webhook_missing_event(webhook_secret, client):
    body = b"{}"
    signature = create_signature(webhook_secret, body)
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={"x-hub-signature-256": signature}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST

def test_webhook_invalid_json(webhook_secret, client):
    body = b"invalid json"
    signature = create_signature(webhook_secret, body)
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={
            "x-hub-signature-256": signature,
            "x-github-event": "push"
        }
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST

def test_webhook_ping(webhook_secret, client):
    body = json.dumps({"zen": "hello"}).encode("utf-8")
    signature = create_signature(webhook_secret, body)
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={
            "x-hub-signature-256": signature,
            "x-github-event": "ping"
        }
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["data"]["event"] == "ping"

@patch("app.api.v1.repositories.service.queue_repository_indexing")
def test_webhook_push_unmatched_repo(mock_queue, webhook_secret, db_session, client):
    payload = {
        "repository": {
            "clone_url": "https://github.com/unknown/repo.git",
            "full_name": "unknown/repo",
            "default_branch": "main"
        },
        "ref": "refs/heads/main",
        "after": "1234567890"
    }
    body = json.dumps(payload).encode("utf-8")
    signature = create_signature(webhook_secret, body)
    
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={
            "x-hub-signature-256": signature,
            "x-github-event": "push"
        }
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["data"]["skipped"] == 1
    mock_queue.assert_not_called()

@patch("app.api.v1.repositories.service.queue_repository_indexing")
def test_webhook_push_matched_repo(mock_queue, webhook_secret, db_session, client):
    from app.db.models import User, Repository
    user = User(id="test-webhook-user", email="webhook@example.com", password_hash="hash", role="user", is_active=True)
    db_session.add(user)
    repo = Repository(id="test-id", repo_id="test/webhook-push-repo", remote_url="https://github.com/test/webhook-push-repo", local_path="/tmp/repo", default_branch="main", owner_user_id="test-webhook-user")
    db_session.add(repo)
    db_session.flush()

    payload = {
        "repository": {
            "clone_url": "https://github.com/test/webhook-push-repo",
            "full_name": "test/webhook-push-repo",
            "default_branch": "main"
        },
        "ref": "refs/heads/main",
        "after": "1234567890"
    }
    body = json.dumps(payload).encode("utf-8")
    signature = create_signature(webhook_secret, body)
    
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={
            "x-hub-signature-256": signature,
            "x-github-event": "push"
        }
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["data"]["queued"] == 1
    mock_queue.assert_called_once()

@patch("app.api.v1.repositories.service.queue_repository_indexing")
def test_webhook_pull_request_merged(mock_queue, webhook_secret, db_session, client):
    from app.db.models import User, Repository
    user = User(id="test-webhook-user-2", email="webhook2@example.com", password_hash="hash", role="user", is_active=True)
    db_session.add(user)
    repo = Repository(id="test-id-pr", repo_id="test/repo-pr", remote_url="https://github.com/test/repo-pr", local_path="/tmp/repo", default_branch="main", owner_user_id="test-webhook-user-2")
    db_session.add(repo)
    db_session.flush()

    payload = {
        "action": "closed",
        "pull_request": {
            "merged": True,
            "base": {"ref": "main"},
            "head": {"sha": "headsha"},
            "merge_commit_sha": "mergesha"
        },
        "repository": {
            "clone_url": "https://github.com/test/repo-pr",
            "full_name": "test/repo-pr",
            "default_branch": "main"
        }
    }
    body = json.dumps(payload).encode("utf-8")
    signature = create_signature(webhook_secret, body)
    
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={
            "x-hub-signature-256": signature,
            "x-github-event": "pull_request"
        }
    )
    assert response.status_code == status.HTTP_200_OK
    print(response.json())
    assert response.json()["data"]["queued"] == 1
    mock_queue.assert_called_once()

def test_webhook_push_deleted_branch(webhook_secret, client):
    payload = {
        "deleted": True,
        "repository": {"clone_url": "https://github.com/test/repo"}
    }
    body = json.dumps(payload).encode("utf-8")
    signature = create_signature(webhook_secret, body)
    
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={
            "x-hub-signature-256": signature,
            "x-github-event": "push"
        }
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["data"]["skipped"] == 1

def test_webhook_push_empty_sha(webhook_secret, client):
    payload = {
        "after": "0000000000000000000000000000000000000000",
        "repository": {"clone_url": "https://github.com/test/repo"}
    }
    body = json.dumps(payload).encode("utf-8")
    signature = create_signature(webhook_secret, body)
    
    response = client.post(
        "/v1/webhooks/github",
        content=body,
        headers={
            "x-hub-signature-256": signature,
            "x-github-event": "push"
        }
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["data"]["skipped"] == 1
