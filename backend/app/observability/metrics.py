from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from typing import Iterator


class RuntimeMetrics:
    def __init__(self, *, max_samples_per_series: int = 500) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, int] = defaultdict(int)
        self._latencies: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=max_samples_per_series))

    def increment(self, name: str, amount: int = 1, **tags: str | int) -> None:
        key = self._series_key(name, tags)
        with self._lock:
            self._counters[key] += amount

    def observe_ms(self, name: str, value_ms: float, **tags: str | int) -> None:
        key = self._series_key(name, tags)
        with self._lock:
            self._latencies[key].append(max(0.0, float(value_ms)))

    @contextmanager
    def timer(self, name: str, **tags: str | int) -> Iterator[None]:
        started = time.perf_counter()
        try:
            yield
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            self.observe_ms(name, elapsed_ms, **tags)

    def snapshot(self) -> dict:
        with self._lock:
            counters = dict(self._counters)
            latencies = {key: list(values) for key, values in self._latencies.items()}

        latency_stats = {}
        for key, values in latencies.items():
            latency_stats[key] = self._summary(values)

        return {
            "counters": counters,
            "latencies": latency_stats,
        }

    def _series_key(self, name: str, tags: dict[str, str | int]) -> str:
        if not tags:
            return name
        parts = [name]
        for tag_name in sorted(tags):
            parts.append(f"{tag_name}={tags[tag_name]}")
        return "|".join(parts)

    def _summary(self, values: list[float]) -> dict[str, float | int]:
        if not values:
            return {
                "count": 0,
                "avg_ms": 0.0,
                "min_ms": 0.0,
                "max_ms": 0.0,
                "p50_ms": 0.0,
                "p95_ms": 0.0,
            }

        ordered = sorted(values)
        count = len(ordered)
        return {
            "count": count,
            "avg_ms": round(sum(ordered) / count, 3),
            "min_ms": round(ordered[0], 3),
            "max_ms": round(ordered[-1], 3),
            "p50_ms": round(self._percentile(ordered, 0.50), 3),
            "p95_ms": round(self._percentile(ordered, 0.95), 3),
        }

    def _percentile(self, ordered: list[float], percentile: float) -> float:
        if not ordered:
            return 0.0
        if len(ordered) == 1:
            return ordered[0]
        index = (len(ordered) - 1) * percentile
        lower = int(index)
        upper = min(lower + 1, len(ordered) - 1)
        fraction = index - lower
        return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


runtime_metrics = RuntimeMetrics()
