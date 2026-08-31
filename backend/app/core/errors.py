"""Centralized exception handling for consistent API error responses."""

from typing import Any, Dict, Optional


class AppException(Exception):
    """Base class for all application-specific exceptions.

    Ensures consistent error format across all endpoints.
    """

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API response."""
        return {
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details,
        }


class AuthenticationException(AppException):
    """Raised for authentication-related errors."""

    def __init__(self, message: str = "Authentication failed."):
        super().__init__(
            message=message,
            status_code=401,
            error_code="AUTHENTICATION_ERROR",
        )


class AuthorizationException(AppException):
    """Raised for authorization/permission-related errors."""

    def __init__(self, message: str = "Insufficient permissions."):
        super().__init__(
            message=message,
            status_code=403,
            error_code="AUTHORIZATION_ERROR",
        )


class NotFoundException(AppException):
    """Raised when a resource is not found."""

    def __init__(self, resource: str, identifier: Any):
        message = f"{resource} with identifier '{identifier}' not found."
        super().__init__(
            message=message,
            status_code=404,
            error_code="NOT_FOUND",
            details={"resource": resource, "identifier": str(identifier)},
        )


class ValidationException(AppException):
    """Raised for validation errors."""

    def __init__(self, message: str = "Validation error.", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=422,
            error_code="VALIDATION_ERROR",
            details=details,
        )


class DuplicateException(AppException):
    """Raised when a duplicate resource is created."""

    def __init__(self, resource: str, identifier: Any):
        message = f"{resource} with identifier '{identifier}' already exists."
        super().__init__(
            message=message,
            status_code=409,
            error_code="DUPLICATE_ERROR",
            details={"resource": resource, "identifier": str(identifier)},
        )


class RateLimitException(AppException):
    """Raised when rate limit is exceeded."""

    def __init__(self, message: str = "Rate limit exceeded.", retry_after: int = 60):
        super().__init__(
            message=message,
            status_code=429,
            error_code="RATE_LIMIT_ERROR",
            details={"retry_after": retry_after},
        )


class ServiceException(AppException):
    """Raised for generic service-layer errors."""

    def __init__(self, message: str = "A service error occurred.", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=500,
            error_code="SERVICE_ERROR",
            details=details,
        )