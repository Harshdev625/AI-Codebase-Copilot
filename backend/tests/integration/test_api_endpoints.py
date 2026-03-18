"""Integration tests for API endpoints."""
import uuid
import json
import httpx
import pytest


BASE = "http://127.0.0.1:8000/v1"


def pretty_response(r):
    """Pretty print response for debugging."""
    print(f"{r.status_code} {r.url}")
    try:
        print(json.dumps(r.json(), indent=2))
    except Exception:
        print(r.text[:1000])


@pytest.fixture
def api_client():
    """Create HTTP client for API tests."""
    client = httpx.Client(timeout=10.0)
    try:
        health = client.get("http://127.0.0.1:8000/docs")
    except httpx.HTTPError:
        client.close()
        pytest.skip("Integration backend is not running on 127.0.0.1:8000")

    if health.status_code >= 500:
        client.close()
        pytest.skip("Integration backend is unavailable")

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
    project = r.json()
    assert project.get("name") == "test-project"
    assert "id" in project

    # List projects
    r = api_client.get(f"{BASE}/projects", headers=headers)
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) > 0


def test_repository_management(api_client, authenticated_user):
    """Test repository addition and listing."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create project first
    r = api_client.post(
        f"{BASE}/projects",
        json={"name": "repo-test-project", "description": "For repo tests"},
        headers=headers,
    )
    project_id = r.json().get("id")
    assert project_id

    # Add repository
    r = api_client.post(
        f"{BASE}/projects/{project_id}/repositories",
        json={
            "repo_id": "test-repo",
            "remote_url": "https://github.com/octocat/Hello-World.git",
            "default_branch": "main",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201)
    repo = r.json()
    assert repo.get("repo_id") == "test-repo"

    # List repositories
    r = api_client.get(f"{BASE}/projects/{project_id}/repositories", headers=headers)
    assert r.status_code == 200
    repos = r.json()
    assert len(repos) > 0


def test_index_endpoint(api_client, authenticated_user):
    """Test indexing endpoint response format."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create project and repository
    r = api_client.post(
        f"{BASE}/projects",
        json={"name": "index-test-project", "description": "For indexing tests"},
        headers=headers,
    )
    project_id = r.json().get("id")

    r = api_client.post(
        f"{BASE}/projects/{project_id}/repositories",
        json={
            "repo_id": "index-test-repo",
            "remote_url": "https://github.com/octocat/Hello-World.git",
        },
        headers=headers,
    )

    # Call index endpoint
    r = api_client.post(
        f"{BASE}/index",
        json={"repo_id": "index-test-repo"},
        headers=headers,
        timeout=15.0,  # Indexing might take a while
    )
    assert r.status_code == 202  # Accepted for background task
    response = r.json()
    assert "indexed_chunks" in response
    assert "snapshot_id" in response
    assert "status" in response
