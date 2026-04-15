from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque
from functools import lru_cache

from fastapi import Request

from app.core.config import settings
from app.core.security import decode_access_token


logger = logging.getLogger(__name__)

try:
    import redis
except Exception:  # pragma: no cover
    redis = None


class RateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._memory_buckets: dict[str, deque[float]] = defaultdict(deque)
        self._redis = self._build_redis_client()

    def is_limited(self, request: Request) -> tuple[bool, int, str]:
        path = request.url.path
        if not path.startswith("/v1"):
            return False, 0, "none"
        if any(path.startswith(exempt) for exempt in settings.rate_limit_exempt_paths_list):
            return False, 0, "none"

        identity = self._identity_for_request(request)
        now = time.time()
        window_seconds = int(settings.rate_limit_window_seconds)
        limit = int(settings.rate_limit_requests_per_window)

        tags = f"{request.method}:{path}"
        if self._redis is not None:
            allowed, retry_after = self._check_redis(identity, tags, now, window_seconds, limit)
            return (not allowed), retry_after, identity

        allowed, retry_after = self._check_memory(identity, tags, now, window_seconds, limit)
        return (not allowed), retry_after, identity

    def _check_redis(
        self,
        identity: str,
        tags: str,
        now: float,
        window_seconds: int,
        limit: int,
    ) -> tuple[bool, int]:
        assert self._redis is not None
        bucket = int(now // window_seconds)
        redis_key = f"rl:{identity}:{tags}:{bucket}"
        try:
            current = int(self._redis.incr(redis_key))
            if current == 1:
                self._redis.expire(redis_key, window_seconds + 2)
        except Exception:
            logger.exception("rate_limiter - redis check failed, falling back to memory")
            self._redis = None
            return self._check_memory(identity, tags, now, window_seconds, limit)

        if current <= limit:
            return True, 0

        retry_after = max(1, int(((bucket + 1) * window_seconds) - now))
        return False, retry_after

    def _check_memory(
        self,
        identity: str,
        tags: str,
        now: float,
        window_seconds: int,
        limit: int,
    ) -> tuple[bool, int]:
        key = f"{identity}:{tags}"
        with self._lock:
            queue = self._memory_buckets[key]
            while queue and (now - queue[0]) > window_seconds:
                queue.popleft()
            if len(queue) >= limit:
                retry_after = max(1, int(window_seconds - (now - queue[0]))) if queue else window_seconds
                return False, retry_after
            queue.append(now)
        return True, 0

    def _identity_for_request(self, request: Request) -> str:
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            if token:
                try:
                    payload = decode_access_token(token)
                    subject = str(payload.get("sub") or "").strip()
                    if subject:
                        return f"user:{subject}"
                except Exception:
                    pass

        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
            if ip:
                return f"ip:{ip}"

        if request.client and request.client.host:
            return f"ip:{request.client.host}"
        return "ip:unknown"

    def _build_redis_client(self):
        if redis is None:
            return None
        try:
            return redis.Redis.from_url(settings.redis_dsn, decode_responses=True)
        except Exception:
            logger.exception("rate_limiter - redis client init failed")
            return None


@lru_cache
def get_rate_limiter() -> RateLimiter:
    return RateLimiter()
