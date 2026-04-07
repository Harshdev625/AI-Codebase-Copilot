from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from app.core.config import settings


logger = logging.getLogger(__name__)

try:
    import redis
except Exception:  # pragma: no cover
    redis = None


class CacheService:
    def __init__(self) -> None:
        self._client = _get_redis_client()

    def get_json(self, key: str) -> dict[str, Any] | None:
        if self._client is None:
            logger.debug("cache_get - skipped (redis unavailable) key=%s", key)
            return None
        try:
            raw = self._client.get(key)
            if raw is None:
                logger.debug("cache_get - miss key=%s", key)
                return None
            logger.debug("cache_get - hit key=%s", key)
            return json.loads(raw)
        except Exception:
            logger.exception("cache_get - failed key=%s", key)
            return None

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int | None = None) -> None:
        if self._client is None:
            logger.debug("cache_set - skipped (redis unavailable) key=%s", key)
            return
        try:
            ttl = ttl_seconds if ttl_seconds is not None else settings.redis_cache_ttl_seconds
            self._client.set(key, json.dumps(value), ex=ttl)
            logger.debug("cache_set - success key=%s ttl=%s", key, ttl)
        except Exception:
            logger.exception("cache_set - failed key=%s", key)
            return


@lru_cache
def _get_redis_client():
    if redis is None:
        return None
    try:
        logger.info("cache_client - connecting redis_dsn=%s", settings.redis_dsn)
        return redis.Redis.from_url(settings.redis_dsn, decode_responses=True)
    except Exception:
        logger.exception("cache_client - connection failed")
        return None


@lru_cache
def get_cache_service() -> CacheService:
    return CacheService()