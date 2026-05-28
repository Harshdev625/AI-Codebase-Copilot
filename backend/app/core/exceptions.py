"""Defines custom, application-specific exceptions for consistent error handling."""

from typing import Any, Dict, Optional


class AppException(Exception):
    """Base class for all application-specific exceptions."""

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
        return {
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details,
        }


class DatabaseException(AppException):
    """Raised for database-related errors."""

    def __init__(self, message: str = "A database error occurred.", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, error_code="DB_ERROR", details=details)


class ServiceException(AppException):
    """Raised for generic service-layer errors."""

    def __init__(self, message: str = "A service error occurred.", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, error_code="SERVICE_ERROR", details=details)


class NotFoundException(AppException):
    """Raised when a resource is not found."""

    def __init__(self, resource: str, identifier: Any):
        message = f"{resource} with identifier '{identifier}' not found."
        super().__init__(
            message,
            status_code=404,
            error_code="NOT_FOUND",
            details={"resource": resource, "identifier": str(identifier)},
        )


class DuplicateException(AppException):
    """Raised when a duplicate resource is created."""

    def __init__(self, resource: str, identifier: Any):
        message = f"{resource} with identifier '{identifier}' already exists."
        super().__init__(
            message,
            status_code=409,
            error_code="DUPLICATE",
            details={"resource": resource, "identifier": str(identifier)},
        )


class ValidationException(AppException):
    """Raised for data validation errors."""

    def __init__(self, message: str = "Validation failed.", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=422, error_code="VALIDATION_ERROR", details=details)


class AuthenticationException(AppException):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Authentication failed."):
        super().__init__(message, status_code=401, error_code="AUTHENTICATION_ERROR")


class AuthorizationException(AppException):
    """Raised when authorization fails."""

    def __init__(self, message: str = "Not authorized."):
        super().__init__(message, status_code=403, error_code="AUTHORIZATION_ERROR")


class ExternalServiceError(AppException):
    """Raised when an external service call fails."""

    def __init__(self, service_name: str, underlying_error: str):
        message = f"Error communicating with external service: {service_name}."
        super().__init__(
            message,
            status_code=503,
            error_code="EXTERNAL_SERVICE_ERROR",
            details={"service": service_name, "error": underlying_error},
        )


class CircuitBreakerOpen(AppException):
    """Raised when a circuit breaker is open."""

    def __init__(self, service_name: str):
        message = (
            f"Circuit breaker is open for service: {service_name}. "
            "The service is temporarily unavailable."
        )
        super().__init__(
            message,
            status_code=503,
            error_code="CIRCUIT_BREAKER_OPEN",
            details={"service": service_name},
        )


class NoContextError(AppException):
    """Raised when no context is available for a query."""

    def __init__(self, message: str = "No context available for this LLM.", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, error_code="NO_CONTEXT", details=details)


class LLMRequestError(AppException):
    """Raised when LLM requests fail."""

    def __init__(self, message: str = "Language model request failed.", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=503, error_code="LLM_ERROR", details=details)


class WorkflowError(AppException):
    """Raised when the workflow execution fails."""

    def __init__(self, message: str = "Workflow execution failed.", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, error_code="WORKFLOW_ERROR", details=details)
