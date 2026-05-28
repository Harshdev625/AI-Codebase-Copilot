"""Enhanced logging with request context propagation.

PHASE 2 FIX: Structured logging filter that automatically includes request ID,
correlation ID, and user ID in all log records without requiring explicit
parameterization in every log call.
"""

import json
import logging
from typing import Any

from app.core.config import settings
from app.core.context import (
    get_correlation_id,
    get_operation_name,
    get_request_id,
    get_user_id,
)


class RequestContextFilter(logging.Filter):
    """Logging filter that adds request context to all log records.
    
    PHASE 2: Automatically injects request_id, correlation_id, user_id, and
    operation_name into every log record's extra fields, enabling JSON logging
    and distributed tracing without modifying every log call.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add request context to log record."""
        # Add context variables
        record.request_id = get_request_id() or "unknown"
        record.correlation_id = get_correlation_id() or "unknown"
        record.user_id = get_user_id() or "anonymous"
        record.operation_name = get_operation_name() or "unknown"
        return True


class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging.
    
    PHASE 2: Formats logs as JSON for easy parsing by log aggregation services
    (ELK, Datadog, Splunk, etc). Includes all context variables and structured data.
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format record as JSON."""
        log_obj: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "unknown"),
            "correlation_id": getattr(record, "correlation_id", "unknown"),
            "user_id": getattr(record, "user_id", "anonymous"),
            "operation_name": getattr(record, "operation_name", "unknown"),
        }

        # Add exception info if present
        if record.exc_info:
            log_obj["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else "Unknown",
                "message": str(record.exc_info[1]) if record.exc_info[1] else "",
            }

        # Add extra fields (passed via logger.info(..., extra={...}))
        if record.__dict__.get("extra_data"):
            log_obj["extra"] = record.__dict__["extra_data"]

        return json.dumps(log_obj)


def configure_structured_logging(use_json: bool = False) -> None:
    """Configure logging with context propagation and optional JSON formatting.

    This function should be called once at application startup.
    """
    # Get the root logger
    root_logger = logging.getLogger()
    
    # Ensure log level is set from settings
    log_level = getattr(logging, str(settings.log_level).upper(), logging.INFO)
    root_logger.setLevel(log_level)

    # Create the context filter
    context_filter = RequestContextFilter()
    
    # Determine the format
    if use_json:
        formatter: logging.Formatter = StructuredFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s - "
            "[%(request_id)s|%(correlation_id)s|%(user_id)s|%(operation_name)s] - %(message)s"
        )

    # If no handlers are configured, add a default one.
    # This is common in environments where logging is not pre-configured.
    if not root_logger.handlers:
        handler = logging.StreamHandler()
        root_logger.addHandler(handler)

    # Apply the filter and formatter to all existing handlers
    for handler in root_logger.handlers:
        # Add filter if it's not already there
        if not any(isinstance(f, RequestContextFilter) for f in handler.filters):
            handler.addFilter(context_filter)
        
        # Set the new formatter
        handler.setFormatter(formatter)

    # Quiet down chatty third-party libraries
    if log_level > logging.DEBUG:
        for lib in ["httpx", "httpcore", "urllib3", "asyncio"]:
            logging.getLogger(lib).setLevel(logging.WARNING)
