"""Unit tests for the errors module - centralized exception handling."""

import pytest
from app.core.errors import (
    AuthenticationException,
    AuthorizationException,
    NotFoundException,
    ValidationException,
    DuplicateException,
    RateLimitException,
    ServiceException,
    AppException,
)


class TestAppExceptionBase:
    """Test base AppException class."""

    def test_base_exception_has_message(self):
        """Test that base exception stores message."""
        exc = AppException("Test message")
        assert exc.message == "Test message"

    def test_base_exception_has_status_code(self):
        """Test that base exception has default status code 500."""
        exc = AppException("Test message")
        assert exc.status_code == 500

    def test_base_exception_has_error_code(self):
        """Test that base exception generates error code from class name."""
        exc = AppException("Test message")
        assert exc.error_code == "AppException"

    def test_base_exception_to_dict(self):
        """Test that to_dict returns correct format."""
        exc = AppException("Test message", 400, "CUSTOM", {"key": "value"})
        result = exc.to_dict()
        assert result["message"] == "Test message"
        assert result["error_code"] == "CUSTOM"
        assert result["details"] == {"key": "value"}

    def test_base_exception_defaults(self):
        """Test base exception with minimal parameters."""
        exc = AppException("Test")
        assert exc.message == "Test"
        assert exc.status_code == 500
        assert exc.error_code == "AppException"
        assert exc.details == {}


class TestAuthenticationException:
    """Test AuthenticationException class."""

    def test_auth_exception_status_code(self):
        """Test 401 status code."""
        exc = AuthenticationException()
        assert exc.status_code == 401

    def test_auth_exception_error_code(self):
        """Test AUTHENTICATION_ERROR error code."""
        exc = AuthenticationException()
        assert exc.error_code == "AUTHENTICATION_ERROR"

    def test_auth_exception_message(self):
        """Test default message."""
        exc = AuthenticationException()
        assert "authentication" in exc.message.lower()

    def test_auth_exception_custom_message(self):
        """Test custom message."""
        exc = AuthenticationException("Invalid credentials")
        assert exc.message == "Invalid credentials"

    def test_auth_exception_to_dict(self):
        """Test to_dict method."""
        exc = AuthenticationException("Invalid credentials")
        result = exc.to_dict()
        assert result["message"] == "Invalid credentials"
        assert result["error_code"] == "AUTHENTICATION_ERROR"
        assert result["details"] == {}


class TestAuthorizationException:
    """Test AuthorizationException class."""

    def test_authz_exception_status_code(self):
        """Test 403 status code."""
        exc = AuthorizationException()
        assert exc.status_code == 403

    def test_authz_exception_error_code(self):
        """Test AUTHORIZATION_ERROR error code."""
        exc = AuthorizationException()
        assert exc.error_code == "AUTHORIZATION_ERROR"

    def test_authz_exception_default_message(self):
        """Test default message contains permissions."""
        exc = AuthorizationException()
        assert "permission" in exc.message.lower()

    def test_authz_exception_custom_message(self):
        """Test custom message."""
        exc = AuthorizationException("Custom authz error")
        assert exc.message == "Custom authz error"


class TestNotFoundException:
    """Test NotFoundException class."""

    def test_not_found_status_code(self):
        """Test 404 status code."""
        exc = NotFoundException("User", "user-123")
        assert exc.status_code == 404

    def test_not_found_error_code(self):
        """Test NOT_FOUND error code."""
        exc = NotFoundException("User", "user-123")
        assert exc.error_code == "NOT_FOUND"

    def test_not_found_message_format(self):
        """Test message format includes resource and identifier."""
        exc = NotFoundException("User", "user-123")
        assert "User" in exc.message
        assert "user-123" in exc.message

    def test_not_found_to_dict(self):
        """Test to_dict method includes details."""
        exc = NotFoundException("Repository", "my-repo")
        result = exc.to_dict()
        assert result["details"]["resource"] == "Repository"
        assert result["details"]["identifier"] == "my-repo"


class TestValidationException:
    """Test ValidationException class."""

    def test_validation_status_code(self):
        """Test 422 status code."""
        exc = ValidationException()
        assert exc.status_code == 422

    def test_validation_error_code(self):
        """Test VALIDATION_ERROR error code."""
        exc = ValidationException()
        assert exc.error_code == "VALIDATION_ERROR"

    def test_validation_with_default_message(self):
        """Test validation with default message."""
        exc = ValidationException()
        assert exc.message == "Validation error."

    def test_validation_with_custom_message_and_details(self):
        """Test validation with custom message and details."""
        exc = ValidationException("Invalid field", {"field": "email"})
        assert exc.message == "Invalid field"
        assert exc.details == {"field": "email"}

    def test_validation_custom_message(self):
        """Test custom message."""
        exc = ValidationException("Custom validation error", {"field": "name"})
        assert exc.message == "Custom validation error"


class TestDuplicateException:
    """Test DuplicateException class."""

    def test_duplicate_status_code(self):
        """Test 409 status code."""
        exc = DuplicateException("Repository", "my-repo")
        assert exc.status_code == 409

    def test_duplicate_error_code(self):
        """Test DUPLICATE_ERROR error code."""
        exc = DuplicateException("Repository", "my-repo")
        assert exc.error_code == "DUPLICATE_ERROR"

    def test_duplicate_message_format(self):
        """Test message format includes resource and identifier."""
        exc = DuplicateException("Repository", "my-repo")
        assert "Repository" in exc.message
        assert "my-repo" in exc.message
        assert "already exists" in exc.message

    def test_duplicate_to_dict(self):
        """Test to_dict method."""
        exc = DuplicateException("Repository", "my-repo")
        result = exc.to_dict()
        assert result["error_code"] == "DUPLICATE_ERROR"
        assert result["details"]["resource"] == "Repository"
        assert result["details"]["identifier"] == "my-repo"


class TestServiceException:
    """Test ServiceException class."""

    def test_service_status_code(self):
        """Test 500 status code."""
        exc = ServiceException()
        assert exc.status_code == 500

    def test_service_error_code(self):
        """Test SERVICE_ERROR error code."""
        exc = ServiceException()
        assert exc.error_code == "SERVICE_ERROR"

    def test_service_custom_message(self):
        """Test custom message."""
        exc = ServiceException("Custom service error")
        assert exc.message == "Custom service error"


class TestRateLimitException:
    """Test RateLimitException class."""

    def test_ratelimit_status_code(self):
        """Test 429 status code."""
        exc = RateLimitException()
        assert exc.status_code == 429

    def test_ratelimit_error_code(self):
        """Test RATE_LIMIT_ERROR error code."""
        exc = RateLimitException()
        assert exc.error_code == "RATE_LIMIT_ERROR"

    def test_ratelimit_message(self):
        """Test default message."""
        exc = RateLimitException()
        assert "rate limit" in exc.message.lower()

    def test_ratelimit_custom_retry_after(self):
        """Test custom retry_after parameter."""
        exc = RateLimitException(retry_after=120)
        assert exc.details["retry_after"] == 120


class TestExceptionHierarchy:
    """Test that all exceptions inherit from AppException."""

    def test_all_inherit_from_appexception(self):
        """Test inheritance chain."""
        from app.core.errors import (
            AuthenticationException,
            AuthorizationException,
            NotFoundException,
            ValidationException,
            DuplicateException,
            ServiceException,
        )
        
        assert issubclass(AuthenticationException, Exception)
        assert issubclass(AuthorizationException, Exception)
        assert issubclass(NotFoundException, Exception)
        assert issubclass(ValidationException, Exception)
        assert issubclass(DuplicateException, Exception)
        assert issubclass(ServiceException, Exception)