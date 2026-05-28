"""
Implements resilience patterns like retry and circuit breaker.

PHASE 1 FIX: Both `retry` and `CircuitBreaker` now auto-detect whether the
decorated function is sync or async.  Sync functions stay sync, async stay async.
Previously both always wrapped with `async def`, silently converting sync
functions to coroutine-returning functions and breaking every sync caller.
"""
import asyncio
import functools
import inspect
import logging
import time
from typing import Any, Callable, Dict, Type, Union

from app.core.exceptions import CircuitBreakerOpen, ExternalServiceError

logger = logging.getLogger(__name__)


def retry(
    attempts: int = 3,
    delay_seconds: float = 1.0,
    backoff_factor: float = 2.0,
    retryable_exceptions: Union[Type[Exception], tuple[Type[Exception], ...]] = (ExternalServiceError,),
):
    """
    A decorator for retrying a function with exponential backoff.

    PHASE 1 FIX: Now auto-detects sync vs async functions and wraps accordingly.
    """
    def decorator(func: Callable):
        if inspect.isasyncgenfunction(func):
            @functools.wraps(func)
            async def async_gen_wrapper(*args, **kwargs):
                last_exception = None
                current_delay = delay_seconds
                for attempt in range(attempts):
                    try:
                        async for item in func(*args, **kwargs):
                            yield item
                        return
                    except retryable_exceptions as e:
                        last_exception = e
                        logger.warning(
                            "retry - attempt %d/%d failed for %s error=%s. Retrying in %.2fs...",
                            attempt + 1,
                            attempts,
                            func.__name__,
                            e,
                            current_delay,
                        )
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff_factor
                
                logger.error(
                    "retry - all %d attempts failed for %s. Last error: %s",
                    attempts,
                    func.__name__,
                    last_exception,
                )
                raise last_exception from last_exception
            return async_gen_wrapper
        elif inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                last_exception = None
                current_delay = delay_seconds
                for attempt in range(attempts):
                    try:
                        return await func(*args, **kwargs)
                    except retryable_exceptions as e:
                        last_exception = e
                        logger.warning(
                            "retry - attempt %d/%d failed for %s error=%s. Retrying in %.2fs...",
                            attempt + 1,
                            attempts,
                            func.__name__,
                            e,
                            current_delay,
                        )
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff_factor
                
                logger.error(
                    "retry - all %d attempts failed for %s. Last error: %s",
                    attempts,
                    func.__name__,
                    last_exception,
                )
                raise last_exception from last_exception
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                last_exception = None
                current_delay = delay_seconds
                for attempt in range(attempts):
                    try:
                        return func(*args, **kwargs)
                    except retryable_exceptions as e:
                        last_exception = e
                        logger.warning(
                            "retry - attempt %d/%d failed for %s error=%s. Retrying in %.2fs...",
                            attempt + 1,
                            attempts,
                            func.__name__,
                            e,
                            current_delay,
                        )
                        time.sleep(current_delay)
                        current_delay *= backoff_factor
                
                logger.error(
                    "retry - all %d attempts failed for %s. Last error: %s",
                    attempts,
                    func.__name__,
                    last_exception,
                )
                raise last_exception from last_exception
            return sync_wrapper
    return decorator


class CircuitBreaker:
    """
    A simple in-memory circuit breaker implementation.

    PHASE 1 FIX: __call__ now auto-detects sync vs async (including generators) and wraps accordingly.
    """
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout_seconds: int = 30,
        name: str = "default",
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self._failure_count = 0
        self._state = "closed"  # "closed", "open", "half-open"
        self._last_failure_time = 0.0

    @property
    def state(self) -> str:
        if self._state == "open" and self._is_recovery_time_elapsed():
            self._state = "half-open"
        return self._state

    def _is_recovery_time_elapsed(self) -> bool:
        return time.monotonic() - self._last_failure_time > self.recovery_timeout_seconds

    def record_failure(self) -> None:
        self._failure_count += 1
        if self._failure_count >= self.failure_threshold:
            self._state = "open"
            self._last_failure_time = time.monotonic()
            logger.error("circuit_breaker - %s is now OPEN", self.name)

    def record_success(self) -> None:
        if self._state == "half-open":
            self.reset()
        self._failure_count = 0
        logger.debug("circuit_breaker - %s recorded success", self.name)

    def reset(self) -> None:
        self._state = "closed"
        self._failure_count = 0
        self._last_failure_time = 0.0
        logger.info("circuit_breaker - %s is now CLOSED", self.name)

    def __call__(self, func: Callable):
        if inspect.isasyncgenfunction(func):
            @functools.wraps(func)
            async def async_gen_wrapper(*args, **kwargs):
                if self.state == "open":
                    raise CircuitBreakerOpen(service_name=self.name)
                try:
                    async for item in func(*args, **kwargs):
                        yield item
                    self.record_success()
                except Exception as e:
                    self.record_failure()
                    raise e
            return async_gen_wrapper
        elif inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                if self.state == "open":
                    raise CircuitBreakerOpen(service_name=self.name)
                try:
                    result = await func(*args, **kwargs)
                    self.record_success()
                    return result
                except Exception as e:
                    self.record_failure()
                    raise e
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                if self.state == "open":
                    raise CircuitBreakerOpen(service_name=self.name)
                try:
                    result = func(*args, **kwargs)
                    self.record_success()
                    return result
                except Exception as e:
                    self.record_failure()
                    raise e
            return sync_wrapper

# Centralized registry for circuit breakers
_circuit_breakers: Dict[str, CircuitBreaker] = {}

def get_circuit_breaker(name: str, **kwargs) -> CircuitBreaker:
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name=name, **kwargs)
    return _circuit_breakers[name]


def circuit_breaker(
    failure_threshold: int = 5,
    recovery_timeout_seconds: int = 30,
    service_name: str = "default",
) -> CircuitBreaker:
    return get_circuit_breaker(
        service_name,
        failure_threshold=failure_threshold,
        recovery_timeout_seconds=recovery_timeout_seconds,
    )
