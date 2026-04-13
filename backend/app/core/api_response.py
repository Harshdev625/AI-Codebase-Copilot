from __future__ import annotations

import logging
from http import HTTPStatus
from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


logger = logging.getLogger(__name__)


def success_response(data: Any, status_code: int = 200) -> JSONResponse:
    logger.debug("api_response_success - status_code=%s", status_code)
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data": jsonable_encoder(data),
            "error": None,
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
        },
    )


def error_response(message: str, status_code: int, *, error: str | None = None) -> JSONResponse:
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
            "error": error_name,
            "status": status_code,
            "message": message,
        },
    )
