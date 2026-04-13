from __future__ import annotations

from collections import defaultdict, deque
import logging
import threading
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.repositories import router as repositories_router
from app.core.api_response import error_response
from app.core.config import settings
from app.db.schema import ensure_app_schema


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

_RATE_LIMIT_LOCK = threading.Lock()
_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return str(request.client.host)
    return "unknown"


def _is_rate_limited(request: Request) -> bool:
    path = request.url.path
    if any(path.startswith(exempt) for exempt in settings.rate_limit_exempt_paths_list):
        return False
    if not path.startswith("/v1"):
        return False

    now = time.time()
    window = float(settings.rate_limit_window_seconds)
    max_requests = int(settings.rate_limit_requests_per_window)
    key = f"{_client_ip(request)}:{request.method}:{path}"

    with _RATE_LIMIT_LOCK:
        queue = _RATE_LIMIT_BUCKETS[key]
        while queue and (now - queue[0]) > window:
            queue.popleft()
        if len(queue) >= max_requests:
            return True
        queue.append(now)
    return False


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins_list or ["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=settings.cors_allow_methods_list,
        allow_headers=settings.cors_allow_headers_list,
    )
    @app.on_event("startup")
    def on_startup() -> None:
        logger.info("startup - ensuring database schema")
        ensure_app_schema()
        logger.info("startup - schema ready")

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())[:12]
        if _is_rate_limited(request):
            response = error_response(
                "Rate limit exceeded. Please retry shortly.",
                status_code=429,
                error="Too Many Requests",
            )
            response.headers["Retry-After"] = str(settings.rate_limit_window_seconds)
            response.headers["X-Request-Id"] = request_id
            return response

        started = time.perf_counter()
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
            logger.exception(
                "request - unhandled failure request_id=%s method=%s path=%s elapsed_ms=%s",
                request_id,
                request.method,
                request.url.path,
                elapsed_ms,
            )
            raise

        elapsed_ms = int((time.perf_counter() - started) * 1000)
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
        return error_response(detail, status_code=exc.status_code)

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
    return app


app = create_app()
