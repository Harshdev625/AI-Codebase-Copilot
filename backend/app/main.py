from __future__ import annotations

import logging
import time
import uuid

# Import app first to apply Windows multiprocessing patch before RQ imports
import app  # noqa: F401

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.repositories import router as repositories_router
from app.api.v1.webhooks import router as webhooks_router
from app.core.api_response import error_response
from app.core.config import settings
from app.core.rate_limiter import get_rate_limiter
from app.db.schema import ensure_app_schema
from app.observability.metrics import runtime_metrics


def _configure_logging() -> None:
    root = logging.getLogger()
    log_level = getattr(logging, str(settings.log_level).upper(), logging.INFO)
    if not root.handlers:
        logging.basicConfig(
            level=log_level,
            format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        )
    else:
        root.setLevel(log_level)

    # Third-party libraries can be very chatty at INFO (notably httpx/httpcore).
    # Keep them quiet unless the app is explicitly running in DEBUG.
    if log_level > logging.DEBUG:
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)


_configure_logging()
logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0")
    rate_limiter = get_rate_limiter()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins_list or ["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=settings.cors_allow_methods_list,
        allow_headers=settings.cors_allow_headers_list,
    )
    @app.on_event("startup")
    def on_startup() -> None:
        settings.validate_runtime_configuration()
        logger.info("startup - ensuring database schema")
        ensure_app_schema()
        logger.info("startup - schema ready")

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())[:12]
        limited, retry_after_seconds, limiter_identity = rate_limiter.is_limited(request)
        if limited:
            runtime_metrics.increment("http_requests_rate_limited_total", path=request.url.path, method=request.method)
            response = error_response(
                "Rate limit exceeded. Please retry shortly.",
                status_code=429,
                error="Too Many Requests",
            )
            response.headers["Retry-After"] = str(retry_after_seconds or settings.rate_limit_window_seconds)
            response.headers["X-Request-Id"] = request_id
            response.headers["X-RateLimit-Identity"] = limiter_identity
            return response

        started = time.perf_counter()
        runtime_metrics.increment("http_requests_total", path=request.url.path, method=request.method)
        logger.info(
            "request - request received request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
        )
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            runtime_metrics.increment("http_request_errors_total", path=request.url.path, method=request.method)
            runtime_metrics.observe_ms("http_request_latency_ms", elapsed_ms, path=request.url.path, method=request.method)
            logger.exception(
                "request - unhandled failure request_id=%s method=%s path=%s elapsed_ms=%s",
                request_id,
                request.method,
                request.url.path,
                elapsed_ms,
            )
            raise

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        runtime_metrics.observe_ms("http_request_latency_ms", elapsed_ms, path=request.url.path, method=request.method)
        runtime_metrics.increment(
            "http_responses_total",
            path=request.url.path,
            method=request.method,
            status=response.status_code,
        )
        response.headers["X-Request-Id"] = request_id
        logger.info(
            "request - response sent request_id=%s method=%s path=%s status=%s elapsed_ms=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logger.warning(
            "http_exception - path=%s status=%s detail=%s",
            request.url.path,
            exc.status_code,
            exc.detail,
        )
        detail = str(exc.detail) if exc.detail is not None else "HTTP request failed"
        return error_response(detail, status_code=exc.status_code, error=detail)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        detail = "Invalid request payload"
        errors = exc.errors()
        if errors:
            first = errors[0]
            location = ".".join(str(part) for part in first.get("loc", []))
            message = str(first.get("msg", "Invalid request payload"))
            detail = f"{location}: {message}" if location else message
        logger.warning("validation_error - path=%s detail=%s", request.url.path, detail)
        return error_response(detail, status_code=422, error="Validation Error")

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("unhandled_exception - path=%s error=%s", request.url.path, exc)
        return error_response("Internal server error", status_code=500, error="Internal Server Error")

    app.include_router(auth_router, prefix="/v1")
    app.include_router(admin_router, prefix="/v1")
    app.include_router(dashboard_router, prefix="/v1")
    app.include_router(chat_router, prefix="/v1/chat")
    app.include_router(repositories_router, prefix="/v1")
    app.include_router(webhooks_router, prefix="/v1")
    return app


app = create_app()
