from __future__ import annotations

import logging
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.core.context import get_request_id


logger = logging.getLogger(__name__)


def success_response(data: Any, status_code: int = 200) -> JSONResponse:
    """Return a standardized success JSON response."""
    logger.debug("api_response_success - status_code=%s", status_code)
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data": jsonable_encoder(data),
            "error": None,
            "request_id": get_request_id(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def paginated_success_response(
    *,
    items: list[Any],
    total: int,
    limit: int,
    offset: int,
    status_code: int = 200,
) -> JSONResponse:
    """Return a standardized paginated success JSON response."""
    logger.debug(
        "api_response_paginated - status_code=%s total=%s limit=%s offset=%s",
        status_code,
        total,
        limit,
        offset,
    )
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data": {
                "items": jsonable_encoder(items),
                "pagination": {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "has_more": (offset + limit) < total,
                },
            },
            "error": None,
            "request_id": get_request_id(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def error_response(
    message: str,
    status_code: int,
    *,
    error: str | None = None,
    details: dict | None = None,
) -> JSONResponse:
    """Return a standardized error JSON response.

    PHASE 3 FIX: Now includes ``request_id`` and ``timestamp`` in every
    error response, matching the expected enterprise API response format.
    """
    error_name = error
    if error_name is None:
        try:
            error_name = HTTPStatus(status_code).phrase
        except ValueError:
            error_name = "Error"

    logger.debug(
        "api_response_error - status_code=%s error=%s message=%s",
        status_code,
        error_name,
        message,
    )
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": error_name,
                "message": message,
                "details": details,
            },
            "request_id": get_request_id(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
