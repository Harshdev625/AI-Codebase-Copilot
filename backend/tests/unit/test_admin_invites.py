"""Tests for admin invite token flow."""

import pytest
from fastapi.testclient import TestClient

from app.services.admin_invite_service import generate_invite_token, hash_invite_token


def test_admin_create_and_register_with_invite(client: TestClient, admin_headers, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.admin_registration_secret_key", "")

    create = client.post(
        "/v1/admin/invites",
        json={"email": "invited-admin@example.com", "expires_in_hours": 24},
        headers=admin_headers,
    )
    assert create.status_code == 201
    invite = create.json()["data"]
    assert invite["email"] == "invited-admin@example.com"
    assert invite["invite_token"]

    register = client.post(
        "/v1/auth/admin/register",
        json={
            "email": "invited-admin@example.com",
            "password": "Password123!",
            "full_name": "Invited Admin",
            "invite_token": invite["invite_token"],
        },
    )
    assert register.status_code == 201
    assert register.json()["data"]["role"] == "ADMIN"

    list_resp = client.get("/v1/admin/invites", headers=admin_headers)
    assert list_resp.status_code == 200
    statuses = {row["email"]: row["status"] for row in list_resp.json()["data"]}
    assert statuses.get("invited-admin@example.com") == "consumed"


def test_admin_register_invite_wrong_email(client: TestClient, admin_headers, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.admin_registration_secret_key", "")

    create = client.post(
        "/v1/admin/invites",
        json={"email": "right@example.com"},
        headers=admin_headers,
    )
    token = create.json()["data"]["invite_token"]

    register = client.post(
        "/v1/auth/admin/register",
        json={
            "email": "wrong@example.com",
            "password": "Password123!",
            "full_name": "Wrong",
            "invite_token": token,
        },
    )
    assert register.status_code == 403


def test_admin_revoke_invite(client: TestClient, admin_headers):
    create = client.post(
        "/v1/admin/invites",
        json={"email": "revoke-me@example.com"},
        headers=admin_headers,
    )
    invite_id = create.json()["data"]["id"]
    token = create.json()["data"]["invite_token"]

    revoke = client.delete(f"/v1/admin/invites/{invite_id}", headers=admin_headers)
    assert revoke.status_code == 200

    register = client.post(
        "/v1/auth/admin/register",
        json={
            "email": "revoke-me@example.com",
            "password": "Password123!",
            "full_name": "Revoked",
            "invite_token": token,
        },
    )
    assert register.status_code == 403


def test_hash_invite_token_is_stable():
    token = "sample-token"
    assert hash_invite_token(token) == hash_invite_token(token)
    assert len(generate_invite_token()) > 20
