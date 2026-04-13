from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from app.core.config import settings

try:
    import redis
except Exception:  # pragma: no cover
    redis = None


class CacheService:
    def __init__(self) -> None:
        self._client = _get_redis_client()

    def get_json(self, key: str) -> dict[str, Any] | None:
        if self._client is None:
            return None
        try:
            raw = self._client.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception:
            return None

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int | None = None) -> None:
        if self._client is None:
            return
        try:
            ttl = ttl_seconds if ttl_seconds is not None else settings.redis_cache_ttl_seconds
            self._client.set(key, json.dumps(value), ex=ttl)
        except Exception:
            return


@lru_cache
def _get_redis_client():
    if redis is None:
        return None
    try:
        return redis.Redis.from_url(settings.redis_dsn, decode_responses=True)
    except Exception:
        return None


@lru_cache
def get_cache_service() -> CacheService:
    return CacheService()