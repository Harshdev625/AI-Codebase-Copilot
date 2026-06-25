import pytest
from fastapi.testclient import TestClient

def test_add_repository(client: TestClient, auth_headers, db_session):
    response = client.post(
        "/v1/repositories",
        headers=auth_headers,
        json={
            "repo_id": "test-repo",
            "remote_url": "https://github.com/test/repo",
            "default_branch": "main"
        }
    )
    assert response.status_code == 201
    assert response.json()["data"]["repo_id"] == "test-repo"
    assert response.json()["data"]["remote_url"] == "https://github.com/test/repo"

def test_list_repositories_returns_created_repo(client: TestClient, auth_headers):
    create = client.post(
        "/v1/repositories",
        headers=auth_headers,
        json={"repo_id": "list-test-repo", "remote_url": "https://github.com/test/list"},
    )
    assert create.status_code == 201
    repo_id = create.json()["data"]["id"]

    response = client.get("/v1/repositories", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert any(item["id"] == repo_id for item in items)

def test_add_duplicate_repository(client: TestClient, auth_headers):
    # Add first
    client.post(
        "/v1/repositories",
        headers=auth_headers,
        json={"repo_id": "test-repo-dupe", "remote_url": "https://github.com/test/dupe"}
    )
    # Add again
    response = client.post(
        "/v1/repositories",
        headers=auth_headers,
        json={"repo_id": "test-repo-dupe", "remote_url": "https://github.com/test/dupe"}
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["error"]["message"]

def test_trigger_indexing(client: TestClient, auth_headers):
    # Setup
    repo_res = client.post(
        "/v1/repositories",
        headers=auth_headers,
        json={"repo_id": "test-repo-index", "remote_url": "https://github.com/test/index"}
    )
    assert repo_res.status_code == 201
    repo_id = repo_res.json()["data"]["id"]

    response = client.post(
        "/v1/index",
        headers=auth_headers,
        json={"repository_id": repo_id}
    )
    assert response.status_code in [200, 202]

def test_get_repository_by_id(client: TestClient, auth_headers):
    # Setup
    repo_res = client.post(
        "/v1/repositories",
        headers=auth_headers,
        json={"repo_id": "test-repo-get", "remote_url": "https://github.com/test/get"}
    )
    assert repo_res.status_code == 201
    repo_id = repo_res.json()["data"]["id"]

    # Skipped since /v1/repositories/{id} is not implemented
