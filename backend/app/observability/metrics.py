"""Prometheus-compatible metrics and observability for the AI Codebase Copilot backend.

This module provides metrics collection using both:
1. Prometheus Client library (when available) for standard metrics endpoints
2. RuntimeMetrics class (always available) for in-memory metric tracking

The design ensures the application works regardless of whether prometheus_client
is installed, with graceful degradation.
"""

import time
import threading
from fastapi import Request, Response

from app.core.config import settings
from app.core.logging_config import get_request_id


class RuntimeMetrics:
    """Application runtime metrics using in-memory storage.
    
    Provides detailed per-endpoint metrics with rolling window storage.
    This is the primary metrics system that always works, even without
    prometheus_client installed.
    """
    
    def __init__(self, max_samples_per_series: int = 500) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, int] = {}
        self._latencies: dict[str, list[float]] = {}
        self._max_samples = max_samples_per_series
    
    def increment(self, name: str, amount: int = 1, **tags: str) -> None:
        key = self._series_key(name, tags)
        with self._lock:
            self._counters[key] = self._counters.get(key, 0) + amount
    
    def observe_ms(self, name: str, value_ms: float, **tags: str) -> None:
        key = self._series_key(name, tags)
        with self._lock:
            if key not in self._latencies:
                self._latencies[key] = []
            self._latencies[key].append(value_ms)
            # Trim to max samples
            if len(self._latencies[key]) > self._max_samples:
                self._latencies[key] = self._latencies[key][-self._max_samples:]
    
    def get_metrics(self, name: str | None = None) -> dict:
        """Get metrics, optionally filtered by name."""
        with self._lock:
            if name:
                key = self._series_key(name, {})
                return {
                    "count": self._counters.get(key, 0),
                    "latencies": self._latencies.get(key, []),
                }
            return {
                k: {"count": v, "latencies": self._latencies.get(k, [])}
                for k, v in self._counters.items()
            }
    
    def timer(self, name: str, mode: str = "execution", **tags: str) -> "_TimerContext":
        """Context manager for timing code execution.
        
        Usage:
            with runtime_metrics.timer("my_metric"):
                # code to time
            # After exit, metric is recorded
        """
        return _TimerContext(self, name, mode, tags)
    
    def _series_key(self, name: str, tags: dict[str, str]) -> str:
        if not tags:
            return name
        parts = [name]
        for tag_name in sorted(tags):
            parts.append(f"{tag_name}={tags[tag_name]}")
        return "|".join(parts)


class _TimerContext:
    """Context manager for timing code execution with RuntimeMetrics."""
    
    def __init__(self, metrics: RuntimeMetrics, name: str, mode: str, tags: dict[str, str]) -> None:
        self._metrics = metrics
        self._name = name
        self._mode = mode
        self._tags = tags
        self._start_time: float | None = None
    
    def __enter__(self) -> None:
        self._start_time = time.perf_counter()
    
    def __exit__(self, *args: object) -> None:
        if self._start_time is not None:
            elapsed_ms = (time.perf_counter() - self._start_time) * 1000
            self._metrics.observe_ms(self._name, elapsed_ms, **self._tags)


# Global runtime metrics instance


# Global runtime metrics instance - always available
runtime_metrics = RuntimeMetrics()


# Prometheus Client metrics (optional - only available if prometheus_client is installed)
try:
    from prometheus_client import Counter, Histogram, Gauge  # type: ignore
    
    # Request counter
    api_requests_total = Counter(
        "api_requests_total",
        "Total number of API requests",
        ["method", "endpoint", "status_code"],
    )
    
    # Request latency histogram
    api_request_latency = Histogram(
        "api_request_latency_seconds",
        "Request latency in seconds",
        ["method", "endpoint"],
    )
    
    # Active requests gauge
    api_requests_in_progress = Gauge(
        "api_requests_in_progress",
        "Number of requests currently being processed",
    )
    
    # Application version gauge
    app_version = Gauge("app_version", "Application version")
    
    HAS_PROMETHEUS = True
except ImportError:
    # Fallback when prometheus_client is not installed
    api_requests_total = None  # type: ignore
    api_request_latency = None  # type: ignore
    api_requests_in_progress = None  # type: ignore
    app_version = None  # type: ignore
    HAS_PROMETHEUS = False


def track_request_metrics(request: Request, call_next):
    """Middleware to track request metrics using RuntimeMetrics.
    
    Records metrics using the always-available RuntimeMetrics instance.
    Also attempts to record Prometheus metrics if available.
    """
    start_time = time.time()
    runtime_metrics.increment("requests_total")
    
    try:
        response = call_next(request)
        duration_s = time.time() - start_time
        duration_ms = duration_s * 1000
        
        # Extract endpoint - normalize /api/v1/ paths
        endpoint = request.url.path
        if endpoint.startswith("/api"):
            endpoint = endpoint.replace("/api/", "/api/v1/")
        
        # Record RuntimeMetrics
        runtime_metrics.observe_ms("request_latency_seconds", duration_ms, endpoint=endpoint)
        runtime_metrics.increment("requests_by_endpoint", endpoint=endpoint)
        
        # Attempt to record Prometheus metrics if available
        if HAS_PROMETHEUS:
            api_requests_total.labels(
                method=request.method,
                endpoint=endpoint,
                status_code=response.status_code,
            ).inc()
            
            api_request_latency.labels(
                method=request.method,
                endpoint=endpoint,
            ).observe(duration_s)
        
        # Add metrics header for client awareness
        response.headers["X-Metrics-Enabled"] = str(HAS_PROMETHEUS).lower()
        response.headers["X-Request-Id"] = get_request_id() or "unknown"
        
        return response
    finally:
        pass


def setup_metrics_middleware(app):
    """Set up metrics middleware on the FastAPI application."""
    
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        # Increment in-progress tracking
        runtime_metrics.increment("requests_in_progress")
        
        # Track request ID from context
        from app.core.context import get_request_id
        request_id = get_request_id() or "unknown"
        request.state.request_id = request_id
        
        response = await call_next(request)
        
        # Decrement in-progress tracking and record completion
        runtime_metrics.increment("requests_completed")
        
        # Add metrics headers
        response.headers["X-Metrics-Enabled"] = str(HAS_PROMETHEUS).lower()
        response.headers["X-Request-Id"] = request.state.get("request_id", "unknown")
        
        return response


def get_prometheus_metrics_endpoint() -> dict:
    """Get metrics data suitable for Prometheus exposition format.
    
    Returns a dictionary that can be serialized to Prometheus format.
    Works whether or not prometheus_client is installed.
    """
    if HAS_PROMETHEUS:
        metrics_data = generate_latest()
        return {"format": "prometheus", "data": metrics_data}
    
    # Return RuntimeMetrics data in a structured format
    metrics = runtime_metrics.get_metrics()
    return {
        "format": "runtime",
        "data": metrics,
        "has_prometheus": HAS_PROMETHEUS,
    }


# Export for use in main.py
__all__ = [
    "api_requests_total",
    "api_request_latency", 
    "api_requests_in_progress",
    "app_version",
    "runtime_metrics",
    "track_request_metrics",
    "setup_metrics_middleware",
    "get_prometheus_metrics_endpoint",
    "RuntimeMetrics",
    "HAS_PROMETHEUS",
]