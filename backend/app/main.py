from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

# Import app first to apply Windows multiprocessing patch before RQ imports
import app as app_pkg  # noqa: F401

from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import text as sa_text
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.repositories import router as repositories_router
from app.api.v1.webhooks import router as webhooks_router
from app.core.api_response import error_response, success_response
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.rate_limiter import get_rate_limiter
from app.core.context import set_request_context, clear_request_context
from app.core.logging_config import configure_structured_logging
from app.db.schema import ensure_app_schema
from app.observability.metrics import runtime_metrics
from app.services.cache_service import get_cache_service


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan: replaces deprecated @app.on_event("startup") / ("shutdown")
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler — startup and shutdown logic."""
    # ── Startup ────────────────────────────────────────────────────────────
    configure_structured_logging(use_json=settings.log_format == "json")
    settings.validate_runtime_configuration()

    logger.info("startup - ensuring database schema")
    ensure_app_schema()
    logger.info("startup - schema ready")

    # Pre-warm the shared HTTP client and cache service
    try:
        cache = get_cache_service()
        cache.health_check()
        logger.info("startup - cache service healthy")
    except Exception as exc:
        logger.warning("startup - cache service unavailable error=%s", exc)

    logger.info("startup - application ready")

    yield  # ── application runs ──

    # ── Shutdown ───────────────────────────────────────────────────────────
    logger.info("shutdown - cleaning up resources")

    # Close the shared HTTP client if it was created
    try:
        from app.core.http_client import get_http_client, _safe_close_client
        if get_http_client.cache_info().currsize > 0:
            _safe_close_client(get_http_client())
            get_http_client.cache_clear()
    except Exception as exc:
        logger.warning("shutdown - http client cleanup error=%s", exc)

    # Clear embedding provider cache
    try:
        from app.rag.embeddings.provider import get_embedding_provider
        get_embedding_provider.cache_clear()
    except Exception as exc:
        logger.warning("shutdown - embedding provider cleanup error=%s", exc)

    logger.info("shutdown - complete")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    rate_limiter = get_rate_limiter()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins_list or ["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=settings.cors_allow_methods_list,
        allow_headers=settings.cors_allow_headers_list,
    )

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())[:12]
        correlation_id = request.headers.get("x-correlation-id") or request_id
        
        try:
            user_id = request.headers.get("x-user-id")
            operation_name = f"{request.method} {request.url.path}"
            
            set_request_context(
                request_id=request_id,
                correlation_id=correlation_id,
                user_id=user_id,
                operation_name=operation_name,
            )
        except Exception as ctx_exc:
            logger.warning("middleware - failed to set context error=%s", ctx_exc)
        
        # Handle invalid JWT exceptions BEFORE rate limiting
        try:
            limited, retry_after_seconds, limiter_identity = rate_limiter.is_limited(request)
        except ValueError as exc:
            logger.warning(
                "request - invalid jwt request_id=%s method=%s path=%s error=%s",
                request_id,
                request.method,
                request.url.path,
                str(exc),
            )
            response = error_response(
                "Invalid or expired authentication token",
                status_code=401,
                error="Unauthorized",
            )
            response.headers["X-Request-Id"] = request_id
            response.headers["X-Correlation-Id"] = correlation_id
            return response
        
        if limited:
            runtime_metrics.increment("http_requests_rate_limited_total", path=request.url.path, method=request.method)
            response = error_response(
                "Rate limit exceeded. Please retry shortly.",
                status_code=429,
                error="Too Many Requests",
            )
            response.headers["Retry-After"] = str(retry_after_seconds or settings.rate_limit_window_seconds)
            response.headers["X-Request-Id"] = request_id
            response.headers["X-Correlation-Id"] = correlation_id
            response.headers["X-RateLimit-Identity"] = limiter_identity
            return response

        started = time.perf_counter()
        runtime_metrics.increment("http_requests_total", path=request.url.path, method=request.method)
        
        is_polling = request.url.path.startswith("/v1/index/progress")
        log_level = logging.DEBUG if is_polling else logging.INFO
        
        logger.log(
            log_level,
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
        response.headers["X-Correlation-Id"] = correlation_id
        
        try:
            clear_request_context()
        except Exception as cleanup_exc:
            logger.warning("middleware - failed to clear context error=%s", cleanup_exc)
        
        logger.log(
            log_level,
            "request - response sent request_id=%s method=%s path=%s status=%s elapsed_ms=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    # ── Exception handlers ─────────────────────────────────────────────────

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.warning(
            "app_exception - path=%s status=%s error_code=%s detail=%s",
            request.url.path,
            exc.status_code,
            exc.error_code,
            exc.message,
        )
        return error_response(
            exc.message,
            status_code=exc.status_code,
            error=exc.error_code,
            details=exc.details,
        )

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

    # ── Health probes ──────────────────────────────────────────────────────

    @app.get("/health", tags=["monitoring"])
    def health_check() -> dict:
        """Health check endpoint for container orchestration and monitoring."""
        logger.debug("health_check - request")
        return success_response({"status": "healthy", "version": "0.1.0"})
    
    @app.get("/live", tags=["monitoring"])
    def liveness_check() -> dict:
        """Kubernetes liveness probe endpoint."""
        return {"status": "alive"}
    
    @app.get("/ready", tags=["monitoring"])
    def readiness_check() -> dict:
        """Kubernetes readiness probe endpoint."""
        from app.db.database import SessionLocal
        try:
            with SessionLocal() as session:
                session.execute(sa_text("SELECT 1"))
            
            cache_service = get_cache_service()
            cache_service.health_check()
            
            return {"status": "ready"}
        except Exception as exc:
            logger.warning("readiness_check - failed error=%s", exc)
            raise HTTPException(status_code=503, detail="Service not ready")

    # ── Routers ────────────────────────────────────────────────────────────

    app.include_router(auth_router, prefix="/v1")
    app.include_router(admin_router, prefix="/v1")
    app.include_router(dashboard_router, prefix="/v1")
    app.include_router(chat_router, prefix="/v1/chat")
    app.include_router(repositories_router, prefix="/v1")
    app.include_router(webhooks_router, prefix="/v1")
    return app


app = create_app()
