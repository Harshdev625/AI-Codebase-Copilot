import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

def test_auth_login_success(client: TestClient, db_session):
    from app.db.models import User
    from app.core.security import hash_password

    user = User(
        id="test-auth-1",
        email="login@example.com",
        password_hash=hash_password("password123"),
        full_name="Login User",
        role="USER",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/v1/auth/login",
        json={"email": "login@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()["data"]

def test_auth_login_invalid_password(client: TestClient, db_session):
    from app.db.models import User
    from app.core.security import hash_password

    user = User(
        id="test-auth-2",
        email="invalid@example.com",
        password_hash=hash_password("password123"),
        full_name="Invalid User",
        role="USER",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/v1/auth/login",
        json={"email": "invalid@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["error"]["message"]

def test_auth_login_nonexistent_user(client: TestClient):
    response = client.post(
        "/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "password123"}
    )
    assert response.status_code == 401

def test_auth_register_success(client: TestClient):
    response = client.post(
        "/v1/auth/register",
        json={"email": "newuser@example.com", "password": "Password123!", "full_name": "New User"}
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["email"] == "newuser@example.com"

def test_auth_register_duplicate(client: TestClient, test_user):
    # Try to register with an existing email
    response = client.post(
        "/v1/auth/register",
        json={"email": test_user["email"], "password": "Password123!", "full_name": "Dupe User"}
    )
    assert response.status_code == 409

def test_auth_me(client: TestClient, auth_headers, test_user):
    response = client.get("/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["data"]["email"] == test_user["email"]

def test_auth_me_unauthorized(client: TestClient):
    response = client.get("/v1/auth/me")
    assert response.status_code == 401

def test_auth_register_db_error(client: TestClient, db_session):
    with patch("sqlalchemy.orm.Session.commit", side_effect=Exception("DB Error")):
        response = client.post(
            "/v1/auth/register",
            json={"email": "newuser2@example.com", "password": "Password123!", "full_name": "New User 2"}
        )
        assert response.status_code == 500
        assert "Registration failed" in response.json()["error"]["message"]

def test_admin_register_disabled(client: TestClient, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.admin_registration_secret_key", "")
    response = client.post(
        "/v1/auth/admin/register",
        json={"email": "admin@example.com", "password": "Password123!", "full_name": "Admin", "admin_secret_key": "secret"}
    )
    assert response.status_code == 500
    assert "Admin registration is disabled" in response.json()["error"]["message"]

def test_admin_register_invalid_secret(client: TestClient, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.admin_registration_secret_key", "correct_secret")
    response = client.post(
        "/v1/auth/admin/register",
        json={"email": "admin@example.com", "password": "Password123!", "full_name": "Admin", "admin_secret_key": "wrong_secret"}
    )
    assert response.status_code == 403
    assert "Invalid admin secret key" in response.json()["error"]["message"]

def test_admin_register_success(client: TestClient, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.admin_registration_secret_key", "correct_secret")
    response = client.post(
        "/v1/auth/admin/register",
        json={"email": "adminnew@example.com", "password": "Password123!", "full_name": "Admin", "admin_secret_key": "correct_secret"}
    )
    assert response.status_code == 201
    assert response.json()["data"]["email"] == "adminnew@example.com"
    assert response.json()["data"]["role"] == "ADMIN"

def test_admin_register_duplicate(client: TestClient, monkeypatch, test_user):
    monkeypatch.setattr("app.core.config.settings.admin_registration_secret_key", "correct_secret")
    response = client.post(
        "/v1/auth/admin/register",
        json={"email": test_user["email"], "password": "Password123!", "full_name": "Admin", "admin_secret_key": "correct_secret"}
    )
    assert response.status_code == 409

def test_admin_register_db_error(client: TestClient, monkeypatch, db_session):
    monkeypatch.setattr("app.core.config.settings.admin_registration_secret_key", "correct_secret")
    with patch("sqlalchemy.orm.Session.commit", side_effect=Exception("DB Error")):
        response = client.post(
            "/v1/auth/admin/register",
            json={"email": "adminerr@example.com", "password": "Password123!", "full_name": "Admin", "admin_secret_key": "correct_secret"}
        )
        assert response.status_code == 500

def test_admin_register_alias(client: TestClient, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.admin_registration_secret_key", "correct_secret")
    response = client.post(
        "/v1/admin/auth/register",
        json={"email": "adminalias@example.com", "password": "Password123!", "full_name": "Admin", "admin_secret_key": "correct_secret"}
    )
    assert response.status_code == 201

def test_login_inactive_user(client: TestClient, db_session):
    from app.db.models import User
    from app.core.security import hash_password

    user = User(
        id="test-inactive",
        email="inactive@example.com",
        password_hash=hash_password("password123"),
        full_name="Inactive User",
        role="USER",
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/v1/auth/login",
        json={"email": "inactive@example.com", "password": "password123"}
    )
    assert response.status_code == 403
    assert "User is inactive" in response.json()["error"]["message"]

def test_admin_login_success(client: TestClient, db_session):
    from app.db.models import User
    from app.core.security import hash_password

    user = User(
        id="test-admin-login",
        email="adminlogin@example.com",
        password_hash=hash_password("password123"),
        full_name="Admin User",
        role="ADMIN",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/v1/auth/admin/login",
        json={"email": "adminlogin@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()["data"]

def test_admin_login_alias(client: TestClient, db_session):
    from app.db.models import User
    from app.core.security import hash_password

    user = User(
        id="test-admin-alias",
        email="adminalias2@example.com",
        password_hash=hash_password("password123"),
        full_name="Admin User",
        role="ADMIN",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/v1/admin/auth/login",
        json={"email": "adminalias2@example.com", "password": "password123"}
    )
    assert response.status_code == 200

def test_admin_login_invalid_password(client: TestClient, db_session):
    from app.db.models import User
    from app.core.security import hash_password

    user = User(
        id="test-admin-wrong",
        email="adminwrong@example.com",
        password_hash=hash_password("password123"),
        full_name="Admin User",
        role="ADMIN",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/v1/auth/admin/login",
        json={"email": "adminwrong@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_admin_login_non_admin(client: TestClient, test_user):
    response = client.post(
        "/v1/auth/admin/login",
        json={"email": test_user["email"], "password": "password123"} # test_user is USER role
    )
    assert response.status_code == 403
    assert "Admin account required" in response.json()["error"]["message"]

def test_admin_login_inactive(client: TestClient, db_session):
    from app.db.models import User
    from app.core.security import hash_password

    user = User(
        id="test-admin-inactive",
        email="admininactive@example.com",
        password_hash=hash_password("password123"),
        full_name="Admin User",
        role="ADMIN",
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/v1/auth/admin/login",
        json={"email": "admininactive@example.com", "password": "password123"}
    )
    assert response.status_code == 403
