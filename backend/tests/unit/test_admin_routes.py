import pytest
from fastapi.testclient import TestClient

def test_admin_get_users(client: TestClient, admin_headers):
    response = client.get("/v1/admin/users", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "items" in data["data"]
    assert isinstance(data["data"]["items"], list)

def test_admin_get_users_unauthorized(client: TestClient, auth_headers):
    # Regular user should be rejected
    response = client.get("/v1/admin/users", headers=auth_headers)
    assert response.status_code == 403

def test_admin_update_user_role(client: TestClient, admin_headers, test_user):
    response = client.post(
        f"/v1/admin/users/{test_user['id']}/role",
        headers=admin_headers,
        json={"role": "ADMIN"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["role"] == "ADMIN"

def test_admin_delete_user(client: TestClient, admin_headers, test_user):
    response = client.delete(
        f"/v1/admin/users/{test_user['id']}",
        headers=admin_headers
    )
    assert response.status_code == 200

    # Verify user is deleted
    response2 = client.get("/v1/admin/users", headers=admin_headers)
    assert not any(u["id"] == test_user["id"] for u in response2.json()["data"]["items"])

def test_admin_get_metrics(client: TestClient, admin_headers):
    response = client.get("/v1/admin/system-metrics", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "users_count" in data["data"]
    assert "repositories_count" in data["data"]
