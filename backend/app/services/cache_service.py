from __future__ import annotations

import contextlib
import json
import logging
import time
import threading
from functools import lru_cache
from typing import Any, Callable, Generator

from app.core.config import settings
from app.core.exceptions import CircuitBreakerOpen, ExternalServiceError
from app.core.resilience import get_circuit_breaker
from app.observability.metrics import runtime_metrics

logger = logging.getLogger(__name__)

try:
    import redis
except Exception:  # pragma: no cover
    redis = None


# PHASE 3: Get a circuit breaker for Redis
redis_circuit_breaker = get_circuit_breaker("redis")

_fallback_locks = {}
_fallback_locks_lock = threading.Lock()


class CacheService:
    """Cache service with resilience patterns (PHASE 3)."""

    def __init__(self) -> None:
        self._client = _get_redis_client()

    @property
    def is_available(self) -> bool:
        """Check if the cache client is initialized and the circuit is not open."""
        return self._client is not None and redis_circuit_breaker.state != "open"

    def _run_with_circuit_breaker(self, func: Callable, *args, **kwargs):
        if redis_circuit_breaker.state == "open":
            raise CircuitBreakerOpen(service_name="Redis")
        try:
            result = func(*args, **kwargs)
            redis_circuit_breaker.record_success()
            return result
        except Exception:
            redis_circuit_breaker.record_failure()
            raise

    def get_json(self, key: str) -> dict[str, Any] | None:
        """Get JSON from cache. Returns None if key missing or cache unavailable."""
        if not self.is_available:
            logger.debug("cache_get - skipped (unavailable) key=%s", key)
            return None

        try:
            raw = self._run_with_circuit_breaker(self._client.get, key)

            if raw is None:
                logger.debug("cache_get - miss key=%s", key)
                return None
            logger.debug("cache_get - hit key=%s", key)
            return json.loads(raw)
        except (CircuitBreakerOpen, redis.exceptions.RedisError) as e:
            logger.error("cache_get - redis error key=%s error=%s", key, e)
            raise ExternalServiceError(service_name="Redis", underlying_error=str(e)) from e
        except json.JSONDecodeError as exc:
            logger.warning("cache_get - corrupted data key=%s error=%s", key, exc)
            # Attempt to delete corrupted entry
            try:
                self._client.delete(key)
            except Exception:
                pass
            return None

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int | None = None) -> bool:
        """Set JSON in cache. Returns True on success, raises ExternalServiceError on failure."""
        if not self.is_available:
            logger.debug("cache_set - skipped (unavailable) key=%s", key)
            return False

        try:
            ttl = ttl_seconds if ttl_seconds is not None else settings.redis_cache_ttl_seconds

            self._run_with_circuit_breaker(self._client.set, key, json.dumps(value), ex=ttl)

            logger.debug("cache_set - success key=%s ttl=%s", key, ttl)
            return True
        except (CircuitBreakerOpen, redis.exceptions.RedisError) as e:
            logger.error("cache_set - redis error key=%s error=%s", key, e)
            raise ExternalServiceError(service_name="Redis", underlying_error=str(e)) from e

    def health_check(self) -> bool:
        """Check if cache backend is healthy."""
        if self._client is None:
            return False
        try:
            return bool(self._run_with_circuit_breaker(self._client.ping))
        except (CircuitBreakerOpen, redis.exceptions.RedisError):
            return False

    @contextlib.contextmanager
    def repository_lock(self, repository_id: str, lock_timeout: int = 3600, acquire_timeout: int = 60) -> Generator[None, None, None]:
        """
        Acquire a distributed lock for a repository.
        Fails in production when Redis is down, but allows local threading coordination fallback in development.
        """
        runtime_metrics.increment("redis_lock_acquire_attempts", repository_id=repository_id)
        
        if not self.is_available:
            # Check production vs development fallback
            is_production = (settings.env == "production" or not settings.debug)
            if is_production:
                runtime_metrics.increment("redis_lock_acquire_error", repository_id=repository_id)
                raise ExternalServiceError("Redis", "Redis lock is unavailable in production mode.")
                
            logger.warning("cache_lock - redis unavailable, falling back to local threading lock for %s", repository_id)
            with _fallback_locks_lock:
                if repository_id not in _fallback_locks:
                    _fallback_locks[repository_id] = threading.Lock()
                local_lock = _fallback_locks[repository_id]
            
            acquired = local_lock.acquire(timeout=acquire_timeout)
            if not acquired:
                runtime_metrics.increment("redis_lock_acquire_error", repository_id=repository_id)
                raise ExternalServiceError("Redis", f"Could not acquire local fallback lock for repository {repository_id} within {acquire_timeout}s.")
            
            runtime_metrics.increment("redis_lock_acquire_success", repository_id=repository_id)
            start_time = time.perf_counter()
            try:
                yield
            finally:
                local_lock.release()
                duration_ms = (time.perf_counter() - start_time) * 1000.0
                runtime_metrics.observe_ms("redis_lock_hold_duration_ms", duration_ms, repository_id=repository_id)
            return

        lock_name = f"repo_lock:{repository_id}"
        lock = self._client.lock(lock_name, timeout=lock_timeout, blocking_timeout=acquire_timeout)
        
        try:
            acquired = self._run_with_circuit_breaker(lock.acquire)
        except Exception as e:
            runtime_metrics.increment("redis_lock_acquire_error", repository_id=repository_id)
            logger.error("cache_lock - lock acquire raised exception for %s: %s", repository_id, e)
            raise ExternalServiceError("Redis", f"Lock acquisition failed due to redis client exception: {e}") from e

        if not acquired:
            runtime_metrics.increment("redis_lock_acquire_error", repository_id=repository_id)
            raise ExternalServiceError("Redis", f"Could not acquire lock for repository {repository_id} within {acquire_timeout}s. Another job may be running.")

        runtime_metrics.increment("redis_lock_acquire_success", repository_id=repository_id)
        start_time = time.perf_counter()
        try:
            yield
        finally:
            try:
                self._run_with_circuit_breaker(lock.release)
            except (CircuitBreakerOpen, redis.exceptions.LockError, redis.exceptions.RedisError) as e:
                logger.warning("cache_lock - failed to release lock %s: %s", lock_name, e)
            finally:
                duration_ms = (time.perf_counter() - start_time) * 1000.0
                runtime_metrics.observe_ms("redis_lock_hold_duration_ms", duration_ms, repository_id=repository_id)


@lru_cache
def _get_redis_client():
    """Get or create Redis client. Returns None if Redis unavailable."""
    if redis is None:
        logger.warning("cache_client - redis library not available")
        return None

    attempts = 3
    delay = 1.0
    for attempt in range(attempts):
        try:
            logger.info(
                "cache_client - connecting to redis_host=%s redis_port=%s",
                settings.redis_host,
                settings.redis_port,
            )
            client = redis.Redis.from_url(
                settings.redis_dsn,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            client.ping()
            logger.info("cache_client - connection successful")
            return client
        except redis.exceptions.ConnectionError as exc:
            logger.warning("cache_client - connection failed error=%s", exc)
            if attempt < attempts - 1:
                time.sleep(delay)
                delay *= 2
                continue
            logger.error("cache_client - failed to connect to redis after retries")
            return None
        except Exception as exc:
            logger.error("cache_client - unexpected error during connection: %s", exc)
            return None


@lru_cache
def get_cache_service() -> CacheService:
    """Get or create global cache service instance."""
    return CacheService()