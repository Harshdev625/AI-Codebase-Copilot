"""Request context management for logging and tracing.

PHASE 2 FIX: Enterprise-grade logging with request ID propagation, correlation IDs,
and context variables for tracing requests through the entire stack.
"""

import contextvars
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# Context variables for request tracing
_request_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_id", default=None
)
_correlation_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)
_user_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "user_id", default=None
)
_operation_name: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "operation_name", default=None
)


def set_request_context(
    request_id: str,
    correlation_id: Optional[str] = None,
    user_id: Optional[str] = None,
    operation_name: Optional[str] = None,
) -> None:
    """Set request context for logging propagation.
    
    PHASE 2: Sets context variables that are automatically included in all logs
    within this request context, enabling tracing through the entire stack.
    
    Args:
        request_id: Unique request identifier
        correlation_id: Optional correlation ID linking related requests (e.g., retries)
        user_id: Optional authenticated user ID
        operation_name: Optional operation/handler name
    """
    _request_id.set(request_id)
    _correlation_id.set(correlation_id or request_id)
    _user_id.set(user_id)
    _operation_name.set(operation_name)
    
    logger.debug(
        "context_set - request_id=%s correlation_id=%s user_id=%s operation=%s",
        request_id,
        correlation_id or request_id,
        user_id or "anonymous",
        operation_name or "unknown",
    )


def get_request_context() -> dict:
    """Get current request context.
    
    PHASE 2: Returns all context variables for use in logging and tracing.
    
    Returns:
        Dictionary with current context (request_id, correlation_id, user_id, operation_name)
    """
    return {
        "request_id": _request_id.get(),
        "correlation_id": _correlation_id.get(),
        "user_id": _user_id.get(),
        "operation_name": _operation_name.get(),
    }


def get_request_id() -> Optional[str]:
    """Get current request ID from context."""
    return _request_id.get()


def get_correlation_id() -> Optional[str]:
    """Get current correlation ID from context."""
    return _correlation_id.get()


def get_user_id() -> Optional[str]:
    """Get current user ID from context."""
    return _user_id.get()


def get_operation_name() -> Optional[str]:
    """Get current operation name from context."""
    return _operation_name.get()


def clear_request_context() -> None:
    """Clear all request context variables."""
    _request_id.set(None)
    _correlation_id.set(None)
    _user_id.set(None)
    _operation_name.set(None)
