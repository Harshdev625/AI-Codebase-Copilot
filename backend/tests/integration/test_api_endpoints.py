"""Integration tests for API endpoints (live backend required)."""
import time
import uuid
import json
import os
import httpx
import pytest


_RUN_LIVE = os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").strip().lower() in {"1", "true", "yes"}
BASE = os.getenv("LIVE_API_BASE_URL", "http://127.0.0.1:8000/v1")

pytestmark = pytest.mark.live_integration


def pretty_response(r):
    """Pretty print response for debugging."""
    print(f"{r.status_code} {r.url}")
    try:
        print(json.dumps(r.json(), indent=2))
    except Exception:
        print(r.text[:1000])


def _payload(response):
    body = response.json()
    if isinstance(body, dict) and "success" in body and "data" in body:
        return body["data"]
    return body


def _access_token(login_response) -> str:
    data = _payload(login_response)
    token = data.get("access_token") if isinstance(data, dict) else None
    assert token, f"Login response missing access_token: {login_response.text}"
    return token


@pytest.fixture
def api_client():
    """Create HTTP client for API tests."""
    client = httpx.Client(timeout=10.0)
    if not _RUN_LIVE:
        client.close()
        pytest.fail(
            "Live integration tests require RUN_LIVE_INTEGRATION_TESTS=1. "
            "Run with: RUN_LIVE_INTEGRATION_TESTS=1 pytest -m live_integration"
        )

    try:
        health = client.get("http://127.0.0.1:8000/docs")
    except httpx.HTTPError:
        client.close()
        pytest.fail("Integration backend is not running on 127.0.0.1:8000")

    if health.status_code >= 500:
        client.close()
        pytest.fail("Integration backend is unavailable")

    try:
        yield client
    finally:
        client.close()


@pytest.fixture
def authenticated_user(api_client):
    """Register and authenticate a test user."""
    email = f"test+{uuid.uuid4().hex[:8]}@example.com"
    password = "password123"

    r = api_client.post(f"{BASE}/auth/register", json={"email": email, "password": password})
    assert r.status_code in (200, 201), f"Register failed: {r.text}"

    r = api_client.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"

    token = _access_token(r)
    return {"email": email, "password": password, "token": token}


def test_auth_flow(api_client):
    """Test user registration and login flow."""
    email = f"smoke+{uuid.uuid4().hex[:8]}@example.com"
    password = "password123"

    r = api_client.post(f"{BASE}/auth/register", json={"email": email, "password": password})
    assert r.status_code in (200, 201)

    r = api_client.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200

    token = _access_token(r)
    headers = {"Authorization": f"Bearer {token}"}
    r = api_client.get(f"{BASE}/auth/me", headers=headers)
    assert r.status_code == 200
    assert _payload(r).get("email") == email


def test_repository_management(api_client, authenticated_user):
    """Test repository addition and listing."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    repo_id = f"test-repo-{uuid.uuid4().hex[:8]}"

    r = api_client.post(
        f"{BASE}/repositories",
        json={
            "repo_id": repo_id,
            "remote_url": "https://github.com/octocat/Hello-World.git",
            "default_branch": "main",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201)
    repo = _payload(r)
    assert repo.get("repo_id") == repo_id

    r = api_client.get(f"{BASE}/repositories", headers=headers)
    assert r.status_code == 200
    repos = _payload(r)
    assert len(repos.get("items", [])) > 0
    assert "pagination" in repos


def test_index_endpoint(api_client, authenticated_user):
    """Test indexing endpoint response format."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    repo_id = f"index-test-repo-{uuid.uuid4().hex[:8]}"

    r = api_client.post(
        f"{BASE}/repositories",
        json={
            "repo_id": repo_id,
            "remote_url": "https://github.com/octocat/Hello-World.git",
            "default_branch": "main",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201)
    repo_db_id = _payload(r).get("id")

    r = api_client.post(
        f"{BASE}/index",
        json={"repository_id": repo_db_id, "commit_sha": "master"},
        headers=headers,
        timeout=30.0,
    )
    assert r.status_code == 202
    response = _payload(r)
    assert "indexing_job_id" in response
    job_id = response["indexing_job_id"]

    for _ in range(10):
        time.sleep(2)
        r_poll = api_client.get(f"{BASE}/index/progress/{job_id}", headers=headers)
        if r_poll.status_code == 200:
            poll_data = _payload(r_poll)
            if poll_data.get("job_status") in ("completed", "failed"):
                assert poll_data.get("job_status") == "completed"
                assert poll_data.get("stats", {}).get("total_files", 0) > 0
                return

    pytest.fail("Indexing job did not complete in time")
