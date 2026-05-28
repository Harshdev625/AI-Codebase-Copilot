"""Integration tests for API endpoints."""
import uuid
import json
import os
import httpx
import pytest
import asyncio


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

    # Register
    r = api_client.post(f"{BASE}/auth/register", json={"email": email, "password": password})
    assert r.status_code in (200, 201), f"Register failed: {r.text}"

    # Login
    r = api_client.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"

    token = r.json().get("access_token")
    return {"email": email, "password": password, "token": token}


def test_auth_flow(api_client):
    """Test user registration and login flow."""
    email = f"smoke+{uuid.uuid4().hex[:8]}@example.com"
    password = "password123"

    # Register
    r = api_client.post(f"{BASE}/auth/register", json={"email": email, "password": password})
    assert r.status_code in (200, 201)

    # Login
    r = api_client.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    assert "access_token" in r.json()

    # Get current user
    token = r.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    r = api_client.get(f"{BASE}/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json().get("email") == email


def test_project_creation(api_client, authenticated_user):
    """Test project creation."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create project
    r = api_client.post(
        f"{BASE}/projects",
        json={"name": "test-project", "description": "A test project"},
        headers=headers,
    )
    assert r.status_code == 201
    project = _payload(r)
    assert project.get("name") == "test-project"
    assert "id" in project

    # List projects
    r = api_client.get(f"{BASE}/projects", headers=headers)
    assert r.status_code == 200
    projects = _payload(r)
    assert len(projects.get("items", [])) > 0
    assert "pagination" in projects


@pytest.mark.asyncio
async def test_repository_management(api_client, authenticated_user):
    """Test repository addition and listing."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create project first
    r = await api_client.post(
        f"{BASE}/projects",
        json={"name": "repo-test-project", "description": "For repo tests"},
        headers=headers,
    )
    project_id = _payload(r).get("id")
    assert project_id

    repo_id = f"test-repo-{uuid.uuid4().hex[:8]}"

    # Add repository
    r = await api_client.post(
        f"{BASE}/projects/{project_id}/repositories",
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

    # List repositories
    r = await api_client.get(f"{BASE}/projects/{project_id}/repositories", headers=headers)
    assert r.status_code == 200
    repos = _payload(r)
    assert len(repos.get("items", [])) > 0
    assert "pagination" in repos


@pytest.mark.asyncio
async def test_index_endpoint(api_client, authenticated_user):
    """Test indexing endpoint response format."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create project and repository
    r = await api_client.post(
        f"{BASE}/projects",
        json={"name": "index-test-project", "description": "For indexing tests"},
        headers=headers,
    )
    project_id = _payload(r).get("id")

    repo_id = f"index-test-repo-{uuid.uuid4().hex[:8]}"

    r = await api_client.post(
        f"{BASE}/projects/{project_id}/repositories",
        json={
            "repo_id": repo_id,
            "remote_url": "https://github.com/octocat/Hello-World.git",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201)
    repo_db_id = _payload(r).get("id")

    # Call index endpoint
    r = await api_client.post(
        f"{BASE}/repositories/{repo_db_id}/index",
        json={"commit_sha": "master"},
        headers=headers,
        timeout=30.0,  # Indexing might take a while
    )
    assert r.status_code == 202  # Accepted for background task
    response = r.json()
    if isinstance(response, dict) and "success" in response and "data" in response:
        response = response["data"]
    
    assert "indexing_job_id" in response
    job_id = response["indexing_job_id"]

    # Poll for completion
    for _ in range(10):
        await asyncio.sleep(2)
        r_poll = await api_client.get(f"{BASE}/index/{job_id}", headers=headers)
        if r_poll.status_code == 200:
            poll_data = _payload(r_poll)
            if poll_data.get("job_status") in ("completed", "failed"):
                assert poll_data.get("job_status") == "completed"
                assert poll_data.get("stats", {}).get("total_files", 0) > 0
                return
    
    pytest.fail("Indexing job did not complete in time")
