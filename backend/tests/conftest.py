from __future__ import annotations

import os

import pytest


def _live_enabled() -> bool:
    return os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").strip().lower() in {"1", "true", "yes"}


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if _live_enabled():
        return

    kept: list[pytest.Item] = []
    deselected: list[pytest.Item] = []

    for item in items:
        if item.get_closest_marker("live_integration") is not None:
            deselected.append(item)
        else:
            kept.append(item)

    if deselected:
        config.hook.pytest_deselected(items=deselected)
        items[:] = kept
