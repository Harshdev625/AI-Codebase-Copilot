"""Unit tests for role normalization."""

from app.core.roles import ROLE_ADMIN, ROLE_USER, normalize_role


def test_normalize_role_empty():
    assert normalize_role(None) == ""
    assert normalize_role("") == ""
    assert normalize_role("   ") == ""


def test_normalize_role_aliases():
    assert normalize_role("user") == ROLE_USER
    assert normalize_role("developer") == ROLE_USER
    assert normalize_role("member") == ROLE_USER
    assert normalize_role("admin") == ROLE_ADMIN


def test_normalize_role_canonical():
    assert normalize_role("USER") == ROLE_USER
    assert normalize_role("ADMIN") == ROLE_ADMIN


def test_normalize_role_passthrough():
    assert normalize_role("CUSTOM_ROLE") == "CUSTOM_ROLE"
