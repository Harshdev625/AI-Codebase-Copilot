"""Resolve on-disk locations for cloned repository workspaces."""

from __future__ import annotations

import re
from pathlib import Path

from app.core.config import settings

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def slugify_repo_id(repo_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", repo_id)


def repo_cache_root() -> Path:
    """Absolute path to the repo cache directory (always under backend root when relative)."""
    cache = Path(settings.repo_cache_dir)
    if cache.is_absolute():
        return cache.resolve()
    return (_BACKEND_ROOT / cache).resolve()


def repository_cache_dir(repo_id: str) -> Path:
    return repo_cache_root() / slugify_repo_id(repo_id)


def normalize_repo_path(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = str(value).strip()
    return stripped if stripped else None


def resolve_repository_workspace(repo_id: str, local_path: str | None = None) -> Path | None:
    """Return on-disk git workspace: cache clone first, then stored local_path."""
    cache = repository_cache_dir(repo_id)
    if cache.exists():
        return cache
    normalized = normalize_repo_path(local_path)
    if normalized:
        local = Path(normalized)
        if local.exists():
            return local.resolve()
    return None
