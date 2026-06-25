"""Resolve on-disk locations for cloned repository workspaces."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from typing import Iterable

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


def normalize_repository_file_path(
    path: str,
    *,
    workspace: Path | None = None,
    local_path: str | None = None,
) -> str:
    """Convert indexed paths (often absolute on Windows) to repo-relative posix paths."""
    if not path or not str(path).strip():
        return path

    cleaned = str(path).strip().replace("\\", "/")
    is_windows_abs = bool(re.match(r"^[A-Za-z]:/", cleaned))

    roots: list[Path] = []
    for candidate in (workspace, Path(local_path) if local_path else None):
        if candidate is None:
            continue
        try:
            resolved = candidate.resolve()
            if resolved.exists():
                roots.append(resolved)
        except OSError:
            continue

    path_obj = Path(path)
    for root in roots:
        try:
            rel = path_obj.resolve().relative_to(root).as_posix()
            if rel and rel != ".":
                return rel
        except (ValueError, OSError):
            continue

    posix = path_obj.as_posix().replace("\\", "/")
    parts = [p for p in posix.split("/") if p and p != "."]
    for root in roots:
        for i in range(len(parts)):
            candidate = "/".join(parts[i:])
            if not candidate or ".." in candidate.split("/"):
                continue
            if (root / candidate).is_file():
                return candidate

    for root in roots:
        root_name = root.name
        if root_name and root_name in parts:
            idx = parts.index(root_name)
            tail = parts[idx + 1 :]
            if tail:
                return "/".join(tail)

    if is_windows_abs and len(parts) > 1:
        tail = "/".join(parts[1:])
        return tail.lstrip("/")

    return cleaned.lstrip("/")


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
    normalized = normalize_repository_file_path(relative_path, workspace=cache_path).replace("\\", "/").lstrip("/")
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


def find_workspace_files_by_basename(workspace: Path, basename: str, *, max_matches: int = 2) -> list[str]:
    """Find repo-relative paths whose final segment matches basename (case-insensitive)."""
    if not workspace.exists() or not basename or ".." in basename.split("/"):
        return []
    target = basename.replace("\\", "/").split("/")[-1].lower()
    if not target:
        return []
    matches: list[str] = []
    for dirpath, dirnames, filenames in os.walk(workspace):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "__pycache__"}]
        for filename in filenames:
            if filename.lower() != target:
                continue
            rel = Path(dirpath, filename).relative_to(workspace).as_posix()
            if rel and ".." not in rel.split("/"):
                matches.append(rel)
                if len(matches) >= max_matches:
                    return matches
    return matches


def resolve_act_file_paths(
    raw_paths: Iterable[str],
    workspace: Path | None,
    *,
    local_path: str | None = None,
) -> list[str]:
    """Normalize plan file hints to existing repo-relative paths."""
    resolved: list[str] = []
    seen: set[str] = set()
    roots: list[Path] = []
    for candidate in (workspace, Path(local_path) if local_path else None):
        if candidate is None:
            continue
        try:
            root = candidate.resolve()
            if root.exists():
                roots.append(root)
        except OSError:
            continue

    for raw in raw_paths:
        hint = str(raw or "").strip()
        if not hint:
            continue
        norm = normalize_repository_file_path(hint, workspace=workspace, local_path=local_path)
        chosen: str | None = None
        for root in roots:
            if norm and (root / norm.replace("\\", "/")).is_file():
                chosen = norm.replace("\\", "/").lstrip("/")
                break
        if not chosen and roots:
            basename = hint.replace("\\", "/").split("/")[-1]
            for root in roots:
                found = find_workspace_files_by_basename(root, basename, max_matches=1)
                if found:
                    chosen = found[0]
                    break
        if chosen and chosen not in seen:
            seen.add(chosen)
            resolved.append(chosen)
    return resolved
