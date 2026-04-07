from __future__ import annotations

import logging
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


def error_response(error: str, status_code: int) -> JSONResponse:
    logger.debug("api_response_error - status_code=%s error=%s", status_code, error)
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data": None,
            "error": error,
        },
    )
