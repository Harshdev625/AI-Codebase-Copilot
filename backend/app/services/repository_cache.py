"""Resolve on-disk locations for cloned repository workspaces."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from app.core.config import settings

_BACKEND_ROOT = Path(__file__).resolve().parents[2]

WORKING_COPY_COMMIT = "local-working-copy"


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


def resolve_git_commit(cache_path: Path, commit_sha: str | None) -> str | None:
    """Map placeholder indexing SHA to repository HEAD for git operations."""
    sha = (commit_sha or "").strip()
    if not sha or sha == WORKING_COPY_COMMIT:
        res = subprocess.run(
            ["git", "-C", str(cache_path), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
        )
        return res.stdout.strip() if res.returncode == 0 else None
    return sha


def read_workspace_file_bytes(cache_path: Path, relative_path: str) -> bytes | None:
    """Read a file directly from the on-disk workspace (working tree)."""
    normalized = relative_path.replace("\\", "/").lstrip("/")
    if not normalized or ".." in normalized.split("/"):
        return None
    try:
        file_path = (cache_path / normalized).resolve()
        root = cache_path.resolve()
        if not str(file_path).startswith(str(root)):
            return None
        if file_path.is_file():
            return file_path.read_bytes()
    except OSError:
        return None
    return None


def read_repository_file(
    cache_path: Path,
    relative_path: str,
    commit_sha: str | None = None,
) -> bytes | None:
    """Read file content via git show, falling back to the working tree."""
    resolved_commit = resolve_git_commit(cache_path, commit_sha)
    if resolved_commit:
        cmd = ["git", "-C", str(cache_path), "show", f"{resolved_commit}:{relative_path}"]
        res = subprocess.run(cmd, capture_output=True)
        if res.returncode == 0:
            return res.stdout
    return read_workspace_file_bytes(cache_path, relative_path)
