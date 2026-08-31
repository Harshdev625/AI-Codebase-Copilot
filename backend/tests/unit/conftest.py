"""Unit test fixtures and shared setup."""

import pytest
from unittest.mock import MagicMock, patch

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.security import create_access_token, hash_password, verify_password
from app.core.errors import (
    AuthenticationException,
    AuthorizationException,
    NotFoundException,
    ValidationException,
    DuplicateException,
    ServiceException,
    AppException,
)


@pytest.fixture
def sample_user_data():
    """Provide sample user data for tests."""
    return {
        "id": "user-123",
        "email": "test@example.com",
        "full_name": "Test User",
        "role": "USER",
    }


@pytest.fixture
def auth_exceptions():
    """Provide all exception types for testing."""
    return {
        "auth": AuthenticationException(),
        "authz": AuthorizationException(),
        "not_found": NotFoundException("User", "user-123"),
        "validation": ValidationException("Invalid field", {"field": "email"}),
        "duplicate": DuplicateException("Repository", "my-repo"),
        "service": ServiceException("Service error"),
        "app": AppException("Custom error", 400, "CUSTOM_ERROR", {"key": "value"}),
    }


@pytest.fixture
def token_data():
    """Provide token data for authentication tests."""
    return {
        "sub": "user-123",
        "role": "USER",
        "scopes": ["repository:read", "repository:write"],
    }


@pytest.fixture
def sample_token():
    """Create a sample access token for tests."""
    from app.core.security import create_access_token
    return create_access_token(token_data)


@pytest.fixture
def password_hash_fixture():
    """Provide a password hash for testing."""
    return hash_password("testpassword123")


@pytest.fixture
def exception_to_dict():
    """Test exception to_dict method."""
    exc = AuthenticationException("Test auth error")
    result = exc.to_dict()
    assert result["message"] == "Test auth error"
    assert result["error_code"] == "AUTHENTICATION_ERROR"
    assert result["details"] == {}
    return result