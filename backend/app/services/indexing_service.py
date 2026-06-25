from __future__ import annotations

import asyncio
import os
import re
import shutil
import subprocess
import time
import uuid
import logging
import json
import hashlib
from contextlib import nullcontext
import stat
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path
from typing import Callable

from pathspec import PathSpec
from pathspec.patterns import GitWildMatchPattern
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.utils import is_sqlite_session, get_jsonb_cast_sql
from app.services.repository_cache import normalize_repo_path, repo_cache_root, repository_cache_dir
from app.models.domain_models import CodeChunk
from app.rag.chunking.ast_chunker import chunk_python_file
from app.rag.chunking.tree_sitter_chunker import chunk_with_tree_sitter
from app.rag.embeddings.provider import embed_text_cached, get_embedding_provider, validate_embedding_dimension
from app.services.qdrant_service import QdrantService
from app.services.cache_service import get_cache_service
from app.services.indexing_helpers import upsert_file_records, create_snapshot
from app.core.exceptions import DatabaseException, ExternalServiceError, ValidationException
from app.core.resilience import retry


logger = logging.getLogger(__name__)


class IndexingService:
    """
    Service for handling the repository indexing process.
    Orchestrates cloning, file discovery, chunking, embedding, and storage.
    """
    SUPPORTED_SUFFIXES = {
        ".py", ".ts", ".js", ".tsx", ".jsx", ".md", ".json", 
        ".html", ".css", ".go", ".java", ".cpp", ".c", ".h", 
        ".hpp", ".rs", ".rb", ".php", ".txt", ".sh", ".yaml", ".yml",
        ".toml", ".ini", ".sql"
    }

    def __init__(self, session: Session) -> None:
        self.session = session
        self.qdrant = QdrantService()
        self.embedder = get_embedding_provider()
        self._prefer_cached_embeddings: bool = True
        self._active_indexing_job_id: str | None = None
        self._active_total_files: int | None = None
        self._active_started_at_perf: float | None = None
        self._active_repository_id: str | None = None
        # Counters accumulated during a single index_repository() call
        self._files_indexed: int = 0
        self._files_skipped: int = 0
        self._chunks_created: int = 0
        self._index_errors: list[dict] = []
        self._stage_timings: dict[str, dict[str, float | int | str | None]] = {}
        self._current_stage: str | None = None
        self._stage_started_at: float | None = None

    def _reset_stage_timings(self) -> None:
        self._stage_timings = {}
        self._current_stage = None
        self._stage_started_at = None

    def _transition_stage(self, stage: str | None) -> None:
        if not stage:
            return
        if stage == self._current_stage:
            return
        now_perf = time.perf_counter()
        now_epoch = time.time()
        if self._current_stage and self._stage_started_at is not None:
            elapsed = round(now_perf - self._stage_started_at, 2)
            prev = self._stage_timings.setdefault(self._current_stage, {})
            prev["duration_seconds"] = round(float(prev.get("duration_seconds") or 0) + elapsed, 2)
            prev["completed_at"] = now_epoch
        entry = self._stage_timings.setdefault(stage, {})
        if "started_at" not in entry:
            entry["started_at"] = now_epoch
        entry.setdefault("duration_seconds", 0)
        self._current_stage = stage
        self._stage_started_at = now_perf

    def _finalize_stage_timings(self) -> None:
        if self._current_stage and self._stage_started_at is not None:
            now_perf = time.perf_counter()
            now_epoch = time.time()
            elapsed = round(now_perf - self._stage_started_at, 2)
            entry = self._stage_timings.setdefault(self._current_stage, {})
            entry["duration_seconds"] = round(float(entry.get("duration_seconds") or 0) + elapsed, 2)
            entry["completed_at"] = now_epoch
        self._current_stage = None
        self._stage_started_at = None

    def _invalidate_remote_repo_cache(self, repo_id: str) -> None:
        """Remove cloned repo workspace so the next resolve performs a fresh clone."""
        target = repository_cache_dir(repo_id)
        if not target.exists():
            return
        self._kill_git_processes(target)
        self._force_delete_directory(target)
        logger.info("index_cache_invalidate - wiped remote cache repo_id=%s path=%s", repo_id, target)

    def _is_low_signal_file(self, file_path: Path
                            , repo_root: Path) -> bool:
        parts = file_path.relative_to(repo_root).parts
        low_signal_dirs = {"node_modules", "dist", "build", ".venv", "venv", ".git", "vendor", "__pycache__", "assets", "lottie"}
        if any(part.lower() in low_signal_dirs for part in parts):
            return True
            
        # Large JSON files and minified JS files provide very low semantic signal
        # and tend to break the LLM context window.
        suffix = file_path.suffix.lower()
        if suffix in {".map"}:
            return True
        if file_path.name.endswith(".min.js") or file_path.name.endswith(".min.css"):
            return True
            
        if suffix in {".json", ".js"}:
            try:
                # Skip JSON/JS files larger than 100KB as they are typically data/minified
                if file_path.stat().st_size > 100_000:
                    return True
            except OSError:
                pass
                
        return False

    def _slugify_repo_id(self, repo_id: str) -> str:
        return re.sub(r'[^a-zA-Z0-9_-]', '_', repo_id)

    def _kill_git_processes(self, target: Path) -> None:
        pass  # Implementation for Windows git process killing if necessary

    def _force_delete_directory(self, target: Path) -> None:
        if target.exists():
            shutil.rmtree(target, onerror=self._on_rm_error)

    def _cache_root(self) -> Path:
        return repo_cache_root()

    def _persist_repository_cache_path(self, repository_id: str, cache_path: Path) -> None:
        """Store clone location so file explorer / ACT can find files after indexing."""
        resolved = str(cache_path.resolve())
        updated_at_sql = "CURRENT_TIMESTAMP" if is_sqlite_session(self.session) else "NOW()"
        try:
            self.session.execute(
                text(
                    f"""
                    UPDATE repositories
                    SET local_path = :local_path,
                        updated_at = {updated_at_sql}
                    WHERE id = :repository_id
                      AND (local_path IS NULL OR TRIM(local_path) = '')
                    """
                ),
                {"local_path": resolved, "repository_id": repository_id},
            )
            self.session.commit()
            logger.info(
                "index_cache_persist - linked repository_id=%s cache_path=%s",
                repository_id,
                resolved,
            )
        except Exception as exc:
            logger.warning(
                "index_cache_persist - failed repository_id=%s path=%s error=%s",
                repository_id,
                resolved,
                exc,
            )
            self.session.rollback()

    async def _delete_dir_with_retry(self, target: Path, max_retries: int = 5, delay: float = 1.0) -> None:
        """Force delete a directory with retries and permission handling."""
        if not target.exists():
            raise RuntimeError(f"Failed to delete directory after multiple attempts: {target}")

        for attempt in range(max_retries):
            try:
                if target.is_dir():
                    shutil.rmtree(target, onerror=self._on_rm_error)
                else:
                    target.unlink()
                if not target.exists():
                    logger.info("index_cleanup_dir - successfully deleted %s on attempt %s", target, attempt + 1)
                    return
            except Exception as e:
                logger.warning("index_cleanup_dir - delete attempt %s failed for %s: %s", attempt + 1, target, e)
                await asyncio.sleep(delay)

    def _on_rm_error(self, func, path, exc_info):
        # Change permissions to read-write and try again
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass

    @retry(attempts=3, delay_seconds=2, backoff_factor=2, retryable_exceptions=(RuntimeError,))
    async def _run_git(self, args: list[str], cwd: Path | None = None, timeout: int = 300) -> subprocess.CompletedProcess:
        """Run git command with timeout and retry."""
        command_text = "git " + " ".join(args)
        logger.debug("index_git - running command=%s cwd=%s timeout=%s", command_text, cwd, timeout)
        try:
            # Using asyncio.to_thread to run the blocking subprocess call
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    ["git", *args],
                    cwd=str(cwd) if cwd else None,
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=timeout,
                )
            )
            logger.debug(
                "index_git - completed command=%s returncode=%s stdout=%s stderr=%s",
                command_text,
                result.returncode,
                (result.stdout or "").strip()[:300],
                (result.stderr or "").strip()[:300],
            )
            return result
        except subprocess.TimeoutExpired as exc:
            logger.exception("index_git - timeout command=%s", command_text)
            raise RuntimeError(f"Git command timed out after {timeout}s: {' '.join(args)}") from exc
        except subprocess.CalledProcessError as exc:
            logger.exception(
                "index_git - failed command=%s returncode=%s stdout=%s stderr=%s",
                command_text,
                exc.returncode,
                (exc.stdout or "").strip()[:300],
                (exc.stderr or "").strip()[:300],
            )
            raise RuntimeError(f"Git command failed: {self._format_process_error(exc, '')}") from exc

    def _format_process_error(self, exc: Exception, default_message: str) -> str:
        if isinstance(exc, subprocess.CalledProcessError):
            stderr = (exc.stderr or "").strip()
            stdout = (exc.stdout or "").strip()
            if stderr:
                return stderr
            if stdout:
                return stdout
            return f"git exited with code {exc.returncode}"

        message = str(exc).strip()
        if message:
            return message
        return default_message

    async def _resolve_repo_root(
        self,
        repo_id: str,
        repo_path: str | None,
        repo_url: str | None,
        repo_ref: str | None,
        repository_id: str | None = None,
    ) -> Path:
        logger.info(
            "index_resolve_repo - start repo_id=%s repo_path=%s repo_url=%s repo_ref=%s",
            repo_id,
            repo_path,
            repo_url,
            repo_ref,
        )
        if repo_path:
            normalized_path = normalize_repo_path(str(repo_path))
            if normalized_path:
                root = Path(normalized_path)
                if not root.exists():
                    raise ValidationException(f"Repository path does not exist: {normalized_path}")
                logger.info("index_resolve_repo - using local path repo_id=%s root=%s", repo_id, root)
                return root

        if not repo_url:
            raise ValidationException("Provide either repo_path or repo_url")

        local_path_candidate = Path(repo_url)
        if local_path_candidate.exists():
            logger.info("index_resolve_repo - repo_url resolved to local path repo_id=%s root=%s", repo_id, local_path_candidate)
            return local_path_candidate

        cache_root = self._cache_root()
        cache_root.mkdir(parents=True, exist_ok=True)

        target = repository_cache_dir(repo_id)
        meta_file = target / "cache_meta.json"
        
        is_valid_cache = False
        
        if target.exists() and meta_file.exists():
            try:
                with meta_file.open("r", encoding="utf-8") as f:
                    meta = json.load(f)
                
                # Verify URL and Branch
                if meta.get("repo_url") == repo_url and meta.get("branch") == repo_ref:
                    logger.info("index_resolve_repo - validating cache ancestry for %s", target)
                    # To verify ancestry, we fetch first
                    await self._run_git(["-C", str(target), "fetch", "origin", repo_ref, "--force"], timeout=600)
                    is_valid_cache = True
            except Exception as e:
                logger.warning("index_resolve_repo - cache validation failed %s", e)
        
        if not is_valid_cache:
            if target.exists():
                self._kill_git_processes(target)
                self._force_delete_directory(target)

            logger.info("index_clone - start repo_id=%s repo_url=%s target=%s ref=%s", repo_id, repo_url, target, repo_ref)
            clone_args = ["clone", repo_url, str(target)]
            try:
                await self._run_git(clone_args, timeout=600)
            except Exception as exc:
                detail = self._format_process_error(exc, "Repository clone failed")
                logger.error("index_clone - failure repo_id=%s detail=%s", repo_id, detail)
                raise ExternalServiceError(
                    service_name="Git",
                    underlying_error=f"Failed to clone repository: {detail}",
                ) from exc

        # Force state to exact branch
        try:
            if repo_ref:
                await self._run_git(["-C", str(target), "checkout", repo_ref], timeout=120)
                if is_valid_cache:
                    # Hard reset to ensure clean state and proper ancestry alignment
                    await self._run_git(["-C", str(target), "reset", "--hard", f"origin/{repo_ref}"], timeout=120)
            
            # Clean untracked files
            await self._run_git(["-C", str(target), "clean", "-fdx"], timeout=120)
    
            # Save meta
            target.mkdir(parents=True, exist_ok=True)
            with meta_file.open("w", encoding="utf-8") as f:
                json.dump({
                    "repository_id": repository_id or repo_id,
                    "repo_url": repo_url,
                    "branch": repo_ref,
                    "last_accessed_at": time.time()
                }, f)
                
            logger.info("index_clone - success repo_id=%s target=%s", repo_id, target)
        except Exception as exc:
            detail = self._format_process_error(exc, "Repository preparation failed")
            logger.error("index_clone - failure repo_id=%s detail=%s", repo_id, detail)
            raise ExternalServiceError(
                service_name="Git",
                underlying_error=f"Failed to prepare repository: {detail}"
            ) from exc

        logger.info("index_resolve_repo - ready repo_id=%s root=%s", repo_id, target)
        return target

    async def _iter_git_listed_files(self, repo_root: Path):
        try:
            result = await self._run_git(
                ["-C", str(repo_root), "ls-files", "--cached", "--others", "--exclude-standard", "-z"]
            )
        except (subprocess.CalledProcessError, RuntimeError):
            return

        for rel_path in result.stdout.split("\x00"):
            if not rel_path:
                continue
            file_path = repo_root / rel_path
            if file_path.is_file():
                yield file_path

    def _load_gitignore_spec(self, repo_root: Path) -> PathSpec:
        gitignore_path = repo_root / ".gitignore"
        patterns: list[str] = [".git/"]
        if gitignore_path.exists():
            with gitignore_path.open("r", encoding="utf-8") as f:
                for line in f:
                    stripped = line.strip()
                    if stripped and not stripped.startswith("#"):
                        patterns.append(stripped)
        return PathSpec.from_lines(GitWildMatchPattern, patterns)

    def _is_ignored(self, spec: PathSpec, repo_root: Path, path: Path, is_dir: bool = False) -> bool:
        rel_path = path.relative_to(repo_root).as_posix()
        if rel_path == ".":
            return False
        if is_dir:
            rel_path = f"{rel_path}/"
        return spec.match_file(rel_path)

    async def _iter_indexable_files(self, repo_root: Path, spec: PathSpec):
        git_files: list[Path] = []
        async for file_path in self._iter_git_listed_files(repo_root):
            git_files.append(file_path)

        if git_files:
            for file_path in git_files:
                yield file_path
            return

        if (repo_root / ".git").exists():
            logger.warning(
                "index_discover - git ls-files returned 0 files for %s; falling back to os.walk",
                repo_root,
            )

        for dirpath, dirnames, filenames in os.walk(repo_root):
            current_dir = Path(dirpath)
            dirnames[:] = [
                dirname
                for dirname in dirnames
                if not self._is_ignored(spec, repo_root, current_dir / dirname, is_dir=True)
            ]

            for filename in filenames:
                file_path = current_dir / filename
                if not self._is_ignored(spec, repo_root, file_path):
                    yield file_path

    def _get_previous_completed_commit(self, repository_id: str) -> str | None:
        try:
            return self.session.execute(
                text("SELECT latest_indexed_commit FROM repositories WHERE id = :id"),
                {"id": repository_id}
            ).scalar()
        except Exception:
            return None

    async def _git_commit_exists(self, repo_root: Path, commit_sha: str) -> bool:
        if not commit_sha:
            return False
        if not (repo_root / ".git").exists():
            return False
        try:
            await self._run_git(["-C", str(repo_root), "cat-file", "-e", f"{commit_sha}^{{commit}}"], timeout=60)
            return True
        except Exception:
            return False

    async def _collect_git_diff_paths(
        self,
        repo_root: Path,
        base_commit: str,
        target_commit: str,
    ) -> tuple[set[str], set[str]]:
        if not (repo_root / ".git").exists():
            raise ValidationException("Repository is not a git checkout; cannot run incremental diff")
        if not await self._git_commit_exists(repo_root, base_commit):
            raise ValidationException(f"Base commit not available locally: {base_commit}")
        if not await self._git_commit_exists(repo_root, target_commit):
            raise ValidationException(f"Target commit not available locally: {target_commit}")

        result = await self._run_git(
            [
                "-C",
                str(repo_root),
                "diff",
                "--name-status",
                "-z",
                f"{base_commit}..{target_commit}",
            ],
            timeout=180,
        )

        changed_paths: set[str] = set()
        deleted_paths: set[str] = set()
        
        for line in (result.stdout or "").splitlines():
            if not line.strip():
                continue
            parts = line.split("\t")
            status_token = parts[0].strip().upper() if parts else ""
            if status_token.startswith("R") and len(parts) >= 3:
                old_path = parts[1].strip().replace("\\", "/")
                new_path = parts[2].strip().replace("\\", "/")
                if old_path:
                    deleted_paths.add(old_path)
                if new_path:
                    changed_paths.add(new_path)
                continue

            if len(parts) < 2:
                continue
            rel_path = parts[-1].strip().replace("\\", "/")
            if not rel_path:
                continue
            if status_token.startswith("D"):
                deleted_paths.add(rel_path)
            else:
                changed_paths.add(rel_path)

        return changed_paths, deleted_paths

    def _filter_incremental_files(
        self,
        repo_root: Path,
        spec: PathSpec,
        changed_paths: set[str],
    ) -> list[Path]:
        files: list[Path] = []
        for rel_path in sorted(changed_paths):
            file_path = repo_root / rel_path
            if not file_path.exists() or not file_path.is_file():
                continue
            if self._is_ignored(spec, repo_root, file_path):
                continue
            files.append(file_path)
        return files

    async def _delete_qdrant_with_retry(
        self,
        operation_name: str,
        delete_func: Callable,
        *args,
        max_retries: int = 2,
        backoff_base: float = 1.0,
    ) -> None:
        """Delete from Qdrant with exponential backoff retry logic.

        PHASE 1 FIX: QdrantService methods are now sync, so we call them
        directly without ``await``.  The outer method remains ``async`` for
        compatibility with the async indexing pipeline.
        """
        for attempt in range(max_retries + 1):
            try:
                # PHASE 1 FIX: QdrantService methods are sync now
                delete_func(*args)
                logger.info("index_delete_qdrant_success - operation=%s", operation_name)
                return
            except Exception as exc:
                is_final_attempt = attempt == max_retries
            
                if is_final_attempt:
                    error_msg = f"Qdrant deletion failed after {max_retries + 1} attempts: {str(exc)}"
                    logger.error(
                        "index_delete_qdrant_failed - operation=%s attempt=%s error=%s",
                        operation_name,
                        attempt + 1,
                        str(exc),
                    )
                    raise RuntimeError(error_msg) from exc
                else:
                    # Exponential backoff for retry (only if not final attempt)
                    wait_time = backoff_base * (2 ** attempt)
                    logger.warning(
                        "index_delete_qdrant_retry - operation=%s attempt=%s error=%s wait_secs=%s",
                        operation_name,
                        attempt + 1,
                        str(exc),
                        wait_time,
                    )
                    await asyncio.sleep(wait_time)

    async def _delete_all_repository_chunks(self, repository_id: str) -> None:
        """Delete all code chunks for a repository from both Qdrant and PostgreSQL.
        H4 Fix: Use transactional pattern - Qdrant first with retry, then DB deletion.
        Phase 3 Fix: Ensure Qdrant collection exists before attempting deletion.
        """
        # Phase 3 FIX: Ensure collection exists before deletion to avoid 404 errors
        try:
            self.qdrant.ensure_collection()
        except Exception as exc:
            logger.warning("Failed to ensure Qdrant collection exists: %s", exc)
            # Continue anyway - if collection doesn't exist, there's nothing to delete
        
        # H4: Delete from Qdrant FIRST with retry logic
        # If Qdrant fails, exception is raised and DB deletion never happens
        await self._delete_qdrant_with_retry(
            f"repository_purge({repository_id})",
            self.qdrant.delete_points_by_repository,
            repository_id,
        )
        
        # H4: Only delete from DB if Qdrant succeeded
        try:
            self.session.execute(
                text("DELETE FROM code_chunks WHERE repository_id = :repository_id"),
                {"repository_id": repository_id},
            )
            self.session.commit()
            logger.info("index_delete_db_success - repository_id=%s", repository_id)
        except Exception as exc:
            self.session.rollback()
            logger.error("index_delete_db_failed - repository_id=%s error=%s", repository_id, str(exc))
            raise DatabaseException("Failed to delete repository chunks from database") from exc

    async def _delete_repository_chunks_for_paths(
        self,
        repository_id: str,
        repo_root: Path,
        relative_paths: set[str],
    ) -> None:
        """Delete code chunks for specific paths in a repository.
        H4 Fix: Two-phase commit - collect IDs, delete from Qdrant with retry, then from DB.
        Phase 3 Fix: Ensure Qdrant collection exists before attempting deletion.
        """
        if not relative_paths:
            return

        # Phase 3 FIX: Ensure collection exists before any Qdrant operations
        try:
            self.qdrant.ensure_collection()
        except Exception as exc:
            logger.warning("Failed to ensure Qdrant collection exists: %s", exc)
            # Continue anyway - if collection doesn't exist, there's nothing to delete

        stmt = text(
            """
            DELETE FROM code_chunks
            WHERE repository_id = :repository_id
              AND (
                path = :abs_path
                OR path = :rel_path
                OR path LIKE :unix_suffix
                OR path LIKE :win_suffix
              )
            """
        )
        query_ids_stmt = text(
            """
            SELECT id
            FROM code_chunks
            WHERE repository_id = :repository_id
              AND (
                path = :abs_path
                OR path = :rel_path
                OR path LIKE :unix_suffix
                OR path LIKE :win_suffix
              )
            """
        )
        point_ids: set[str] = set()

        try:
            # H4: PHASE 1 - Collect IDs to delete
            for rel in sorted(relative_paths):
                normalized_rel = rel.replace("\\", "/").lstrip("/")
                if not normalized_rel:
                    continue

                abs_path = str((repo_root / normalized_rel).resolve())
                windows_rel = normalized_rel.replace("/", "\\")
                params = {
                    "repository_id": repository_id,
                    "abs_path": abs_path,
                    "rel_path": normalized_rel,
                    "unix_suffix": f"%/{normalized_rel}",
                    "win_suffix": f"%\\{windows_rel}",
                }

                id_rows = self.session.execute(query_ids_stmt, params).mappings().all()
                for row in id_rows:
                    chunk_id = str(row.get("id") or "").strip()
                    if chunk_id:
                        point_ids.add(chunk_id)

        except Exception as exc:
            self.session.rollback()
            logger.error(
                "index_delete_collect_ids_failed - repository_id=%s count=%s error=%s",
                repository_id,
                len(relative_paths),
                str(exc),
            )
            raise DatabaseException("Failed to collect chunk IDs for deletion") from exc

        # H4: PHASE 2 - Delete from Qdrant FIRST with retry
        if point_ids:
            await self._delete_qdrant_with_retry(
                f"path_purge(repo={repository_id}, count={len(point_ids)})",
                self.qdrant.delete_points_by_ids,
                list(point_ids),
            )

        # H4: PHASE 3 - Delete from DB only if Qdrant succeeded
        try:
            for rel in sorted(relative_paths):
                normalized_rel = rel.replace("\\", "/").lstrip("/")
                if not normalized_rel:
                    continue

                abs_path = str((repo_root / normalized_rel).resolve())
                windows_rel = normalized_rel.replace("/", "\\")
                params = {
                    "repository_id": repository_id,
                    "abs_path": abs_path,
                    "rel_path": normalized_rel,
                    "unix_suffix": f"%/{normalized_rel}",
                    "win_suffix": f"%\\{windows_rel}",
                }

                self.session.execute(stmt, params)

            self.session.commit()
            logger.info(
                "index_delete_db_success - repository_id=%s path_count=%s point_count=%s",
                repository_id,
                len(relative_paths),
                len(point_ids),
            )
        except Exception as exc:
            self.session.rollback()
            logger.error(
                "index_delete_db_failed - repository_id=%s path_count=%s error=%s",
                repository_id,
                len(relative_paths),
                str(exc),
            )
            raise DatabaseException("Failed to delete chunks for specific paths") from exc

    def _count_repository_chunks(self, repository_id: str) -> int:
        try:
            count = self.session.execute(
                text("SELECT COUNT(*) FROM code_chunks WHERE repository_id = :repository_id"),
                {"repository_id": repository_id},
            ).scalar()
            return int(count or 0)
        except Exception:
            return 0

    def _count_indexed_repository_files(self, repository_id: str) -> int:
        try:
            count = self.session.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM repository_files
                    WHERE repository_id = :repository_id AND status = 'INDEXED'
                    """
                ),
                {"repository_id": repository_id},
            ).scalar()
            return int(count or 0)
        except Exception:
            return 0

    def _resolve_repair_file_list(
        self,
        repo_root: Path,
        repository_id: str,
        all_files: list[Path],
    ) -> list[Path]:
        """Re-chunk files whose metadata says INDEXED but vectors are missing."""
        try:
            rows = self.session.execute(
                text(
                    """
                    SELECT path
                    FROM repository_files
                    WHERE repository_id = :repository_id AND status = 'INDEXED'
                    """
                ),
                {"repository_id": repository_id},
            ).mappings().all()
        except Exception:
            return []

        indexed_paths = {str(row.get("path") or "").strip() for row in rows}
        indexed_paths.discard("")

        repair_files: list[Path] = []
        for file_path in all_files:
            try:
                rel = file_path.relative_to(repo_root).as_posix()
            except ValueError:
                continue
            if rel in indexed_paths:
                repair_files.append(file_path)

        return repair_files

    async def _delete_chunks_by_ids(self, chunk_ids: list[str]) -> None:
        if not chunk_ids:
            return
        unique_ids = sorted({str(cid).strip() for cid in chunk_ids if str(cid).strip()})
        if not unique_ids:
            return

        await self._delete_qdrant_with_retry(
            f"chunk_purge(count={len(unique_ids)})",
            self.qdrant.delete_points_by_ids,
            unique_ids,
        )

        try:
            for chunk_id in unique_ids:
                self.session.execute(
                    text("DELETE FROM code_chunks WHERE id = :id"),
                    {"id": chunk_id},
                )
            self.session.commit()
            logger.info("index_delete_by_ids - removed chunks=%s", len(unique_ids))
        except Exception as exc:
            self.session.rollback()
            raise DatabaseException("Failed to delete stale chunks from database") from exc

    async def _prune_repository_chunks_except(self, repository_id: str, keep_ids: set[str]) -> None:
        if not keep_ids:
            await self._delete_all_repository_chunks(repository_id)
            return
        rows = self.session.execute(
            text("SELECT id FROM code_chunks WHERE repository_id = :repository_id"),
            {"repository_id": repository_id},
        ).mappings().all()
        stale_ids = [str(row["id"]) for row in rows if str(row["id"]) not in keep_ids]
        await self._delete_chunks_by_ids(stale_ids)

    async def _prune_path_chunks_except(
        self,
        repository_id: str,
        repo_root: Path,
        relative_paths: set[str],
        keep_ids: set[str],
    ) -> None:
        if not relative_paths:
            return
        if not keep_ids:
            await self._delete_repository_chunks_for_paths(repository_id, repo_root, relative_paths)
            return

        query_ids_stmt = text(
            """
            SELECT id
            FROM code_chunks
            WHERE repository_id = :repository_id
              AND (
                path = :abs_path
                OR path = :rel_path
                OR path LIKE :unix_suffix
                OR path LIKE :win_suffix
              )
            """
        )
        stale_ids: list[str] = []
        for rel in sorted(relative_paths):
            normalized_rel = rel.replace("\\", "/").lstrip("/")
            if not normalized_rel:
                continue
            abs_path = str((repo_root / normalized_rel).resolve())
            windows_rel = normalized_rel.replace("/", "\\")
            params = {
                "repository_id": repository_id,
                "abs_path": abs_path,
                "rel_path": normalized_rel,
                "unix_suffix": f"%/{normalized_rel}",
                "win_suffix": f"%\\{windows_rel}",
            }
            id_rows = self.session.execute(query_ids_stmt, params).mappings().all()
            for row in id_rows:
                chunk_id = str(row.get("id") or "").strip()
                if chunk_id and chunk_id not in keep_ids:
                    stale_ids.append(chunk_id)

        await self._delete_chunks_by_ids(stale_ids)

    async def _apply_post_index_cleanup(
        self,
        *,
        repository_id: str,
        repo_root: Path,
        indexing_mode: str,
        changed_paths: set[str],
        deleted_paths: set[str],
        keep_ids: set[str],
    ) -> None:
        """Remove stale vectors only after new chunks were stored successfully."""
        if indexing_mode == "full":
            await self._prune_repository_chunks_except(repository_id, keep_ids)
            return

        if deleted_paths:
            await self._delete_repository_chunks_for_paths(repository_id, repo_root, deleted_paths)
        if changed_paths:
            await self._prune_path_chunks_except(repository_id, repo_root, changed_paths, keep_ids)

    async def _update_progress(
        self,
        indexing_job_id: str | None,
        current: int,
        total: int,
        message: str = "",
        current_file: str | None = None,
        elapsed_seconds: float | None = None,
        extra_stats: dict | None = None,
        stage: str | None = None,
    ) -> None:
        """Update indexing progress in indexing_jobs.stats.
        
        Stages and their percentage ranges:
        - discovery: 0-5% (Finding files)
        - parsing: 5-50% (Chunking files)  
        - embedding: 50-80% (Generating vectors)
        - storage: 80-95% (Inserting to DB)
        - graph: 95-100% (Building relationships)
        """
        if not indexing_job_id:
            return

        if stage:
            self._transition_stage(stage)

        # Stage-based percentage calculation
        stage_percentages = {
            "discovery": (0, 5),
            "parsing": (5, 50),
            "embedding": (50, 80),
            "storage": (50, 95),
            "finalize": (95, 100),
            "graph": (95, 100),
        }
        
        if stage and stage in stage_percentages:
            stage_start, stage_end = stage_percentages[stage]
            # Calculate percentage within the stage
            if total > 0:
                stage_progress = (current / total)
                percentage = int(stage_start + (stage_progress * (stage_end - stage_start)))
                percentage = min(percentage, stage_end - 1)  # Don't reach 100% until graph stage completes
            else:
                percentage = stage_start
        else:
            # Fallback to simple calculation if no stage provided
            percentage = int((current / total) * 100) if total > 0 else 0
            
        eta_seconds: int | None = None
        avg_seconds_per_file: float | None = None
        if elapsed_seconds is not None and current > 0:
            avg_seconds_per_file = elapsed_seconds / max(current, 1)
            remaining = max(total - current, 0)
            eta_seconds = int(avg_seconds_per_file * remaining)

        stats_payload = {
            "total_files": total,
            "processed_files": current,
            "percentage": percentage,
            "current_stage": stage or self._current_stage or "unknown",
            "current_file": current_file,
            "eta_seconds": eta_seconds,
            "avg_seconds_per_file": round(avg_seconds_per_file, 4) if avg_seconds_per_file is not None else None,
            "updated_at_epoch": time.time(),
            "stage_timings": dict(self._stage_timings),
        }
        if extra_stats:
            try:
                stats_payload.update(extra_stats)
            except Exception:
                pass
        is_sqlite = is_sqlite_session(self.session)
        stats_sql = get_jsonb_cast_sql("stats", is_sqlite)
        try:
            self.session.execute(
                text(
                    f"""
                    UPDATE indexing_jobs
                    SET message = :message,
                        stats = {stats_sql},
                        updated_at = NOW(),
                        status = CASE WHEN status = 'pending' THEN 'running' ELSE status END
                    WHERE id = :id
                    """
                ),
                {
                    "id": indexing_job_id,
                    "message": message or f"Processing: {current}/{total} files",
                    "stats": json.dumps(stats_payload),
                },
            )
            self.session.commit()
            logger.debug(
                "index_progress_update - success job_id=%s current=%s total=%s percentage=%s stage=%s",
                indexing_job_id,
                current,
                total,
                percentage,
                stage,
            )
        except Exception:
            # Non-critical update failure; rollback to avoid aborted transactions.
            logger.exception("index_progress_update - failed job_id=%s", indexing_job_id)
            self.session.rollback()

    async def index_repository(
        self,
        repo_id: str,
        repository_id: str | None,
        commit_sha: str,
        repo_path: str | None = None,
        repo_url: str | None = None,
        repo_ref: str | None = None,
        indexing_job_id: str | None = None,
        full_reindex: bool = False,
    ) -> int:
        
        # Acquire repository lock to prevent concurrent indexing of the same repo
        lock_manager = get_cache_service().repository_lock(repository_id or repo_id, lock_timeout=3600)
        with lock_manager:
            return await self._index_repository_locked(
                repo_id, repository_id, commit_sha, repo_path, repo_url, repo_ref, indexing_job_id, full_reindex
            )

    async def _index_repository_locked(
        self,
        repo_id: str,
        repository_id: str | None,
        commit_sha: str,
        repo_path: str | None = None,
        repo_url: str | None = None,
        repo_ref: str | None = None,
        indexing_job_id: str | None = None,
        full_reindex: bool = False,
    ) -> int:
        logger.info(
            "index_repository - start repo_id=%s repository_id=%s commit_sha=%s",
            repo_id,
            repository_id,
            commit_sha,
        )
        logger.info("indexing_start - repo_id=%s repository_id=%s full_reindex=%s", repo_id, repository_id, full_reindex)
        self._reset_stage_timings()
        effective_repo_url = repo_url
        effective_repo_path = normalize_repo_path(repo_path)
        if full_reindex and effective_repo_url and not effective_repo_path:
            self._invalidate_remote_repo_cache(repo_id)
        root = await self._resolve_repo_root(
            repo_id, 
            repo_path=effective_repo_path, 
            repo_url=effective_repo_url, 
            repo_ref=repo_ref, 
            repository_id=repository_id
        )
        cleanup_cached_repo = bool(effective_repo_url and not effective_repo_path)
        started_at = time.perf_counter()
        self._active_indexing_job_id = indexing_job_id
        self._active_started_at_perf = started_at
        self._active_repository_id = repository_id

        try:
            ignore_spec = self._load_gitignore_spec(root)
            logger.debug("index_repository - phase=discover repo_id=%s", repo_id)
            await self._update_progress(indexing_job_id, 0, 0, "Discovering files...", stage="discovery")

            chunks: list[CodeChunk] = []
            file_list: list[Path]
            changed_paths: set[str] = set()
            deleted_paths: set[str] = set()

            force_full_reindex = bool(full_reindex or settings.indexing_force_full_reindex)

            # Discover all valid files on disk
            all_files = [f async for f in self._iter_indexable_files(root, ignore_spec)]
            total_files = len(all_files)

            if repository_id and total_files == 0:
                existing_chunks = self._count_repository_chunks(str(repository_id))
                if existing_chunks > 0:
                    raise ValidationException(
                        "File discovery found 0 files, but indexed chunks still exist. "
                        "Verify the repository clone/path is intact, then retry. "
                        "Use full re-index if the workspace was moved."
                    )

            if force_full_reindex or not settings.indexing_incremental_enabled or not repository_id:
                indexing_mode = "full"
                mode_reason = "forced full reindex" if force_full_reindex else "incremental disabled"
            else:
                indexing_mode = "incremental"
                mode_reason = "hash-based incremental"

            changed_paths: set[str] = set()
            deleted_paths: set[str] = set()
            file_list = all_files
            
            # --- Persist file records and get incremental chunk list ---
            if repository_id:
                self._files_indexed, files_to_chunk, deleted_files = await upsert_file_records(
                    self.session,
                    repository_id=repository_id,
                    repo_root=root,
                    commit_sha=commit_sha,
                    file_list=file_list,
                    force_rechunk=(indexing_mode == "full")
                )
                self._files_skipped = total_files - len(files_to_chunk)
                file_list = files_to_chunk
                deleted_paths = set(deleted_files)
                changed_paths = {f.relative_to(root).as_posix() for f in files_to_chunk if f.exists()}

            if (
                indexing_mode == "incremental"
                and repository_id
                and not file_list
                and not deleted_paths
            ):
                chunk_count = self._count_repository_chunks(str(repository_id))
                indexed_file_count = self._count_indexed_repository_files(str(repository_id))
                if indexed_file_count > 0 and chunk_count == 0:
                    file_list = self._resolve_repair_file_list(root, str(repository_id), all_files)
                    if not file_list:
                        file_list = list(all_files)
                    changed_paths = {
                        f.relative_to(root).as_posix() for f in file_list if f.exists()
                    }
                    mode_reason = "index repair (vectors missing)"
                    indexing_mode = "repair"
                    logger.warning(
                        "index_repair - repository_id=%s indexed_files=%s chunks=%s files_to_rechunk=%s",
                        repository_id,
                        indexed_file_count,
                        chunk_count,
                        len(file_list),
                    )
                else:
                    await self._update_progress(
                        indexing_job_id,
                        total_files,
                        total_files,
                        "Index up to date (no file changes)",
                        elapsed_seconds=time.perf_counter() - started_at,
                        stage="finalize",
                        extra_stats={
                            "percentage": 100,
                            "indexing_mode": indexing_mode,
                            "total_files": total_files,
                            "stored_chunks": chunk_count,
                        },
                    )
                    return 0

            self._active_total_files = total_files
            logger.info(
                "index_repository - files discovered repo_id=%s mode=%s total_files=%s chunks_to_process=%s reason=%s",
                repo_id,
                indexing_mode,
                total_files,
                len(file_list),
                mode_reason,
            )
            logger.info(
                "indexing_progress - repo_id=%s stage=discover mode=%s total_files=%s",
                repo_id,
                indexing_mode,
                total_files,
            )
            await self._update_progress(
                indexing_job_id,
                0,
                total_files,
                f"{indexing_mode.title()} indexing selected: {total_files} files",
                stage="discovery",
                extra_stats={
                    "indexing_mode": indexing_mode,
                    "mode_reason": mode_reason,
                    "total_files": total_files,
                    "processed_files": 0,
                    "percentage": 0,
                    "stored_chunks": 0,
                },
            )

            if (
                indexing_mode == "incremental"
                and repository_id
                and not file_list
                and deleted_paths
            ):
                await self._apply_post_index_cleanup(
                    repository_id=str(repository_id),
                    repo_root=root,
                    indexing_mode=indexing_mode,
                    changed_paths=set(),
                    deleted_paths=deleted_paths,
                    keep_ids=set(),
                )
                await create_snapshot(
                    self.session,
                    repository_id=repository_id,
                    commit_sha=commit_sha,
                    files_count=self._files_indexed,
                    files_skipped=self._files_skipped,
                    chunks_count=0,
                )
                await self._update_progress(
                    indexing_job_id,
                    total_files,
                    total_files,
                    f"Removed index for {len(deleted_paths)} deleted file(s)",
                    elapsed_seconds=time.perf_counter() - started_at,
                    stage="finalize",
                    extra_stats={"percentage": 100, "stored_chunks": 0},
                )
                return 0

            def _chunk_single_file(file_path: Path) -> tuple[Path, list[CodeChunk], Exception | None]:
                try:
                    rel_path = file_path.relative_to(root).as_posix()
                    source = file_path.read_text(encoding="utf-8", errors="ignore")
                    if file_path.suffix == ".py":
                        try:
                            python_chunks = chunk_python_file(repo_id, commit_sha, rel_path, source)
                        except Exception:
                            python_chunks = []

                        if python_chunks:
                            return file_path, python_chunks, None

                        # Keep python files searchable even when AST parsing fails
                        # or when a file has no function/class definitions.
                        return file_path, self.generic_chunk_file(repo_id, commit_sha, rel_path, source, file_path.suffix), None
                    structured_chunks = chunk_with_tree_sitter(repo_id, commit_sha, rel_path, source, file_path)
                    if structured_chunks:
                        return file_path, structured_chunks, None
                    return file_path, self.generic_chunk_file(repo_id, commit_sha, rel_path, source, file_path.suffix), None
                except Exception as exc:
                    return file_path, [], exc

            processed = 0
            max_workers = max(1, min(4, (os.cpu_count() or 2)))
            logger.debug("index_repository - phase=chunk repo_id=%s workers=%s", repo_id, max_workers)
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_map = {executor.submit(_chunk_single_file, fp): fp for fp in file_list}
                pending = set(future_map.keys())
                last_progress_update = time.perf_counter()

                while pending:
                    done, pending = wait(pending, timeout=1.0, return_when=FIRST_COMPLETED)
                    now = time.perf_counter()
                    elapsed = now - started_at

                    if not done:
                        # Keep heartbeat fresh so polling clients can distinguish active work from stalled jobs.
                        if now - last_progress_update >= 10:
                            await self._update_progress(
                                indexing_job_id,
                                processed,
                                total_files,
                                f"Indexing in progress ({processed}/{total_files} files)",
                                elapsed_seconds=elapsed,
                                stage="parsing",
                            )
                            last_progress_update = now
                        continue

                    for future in done:
                        file_path = future_map[future]
                        _path, file_chunks, error = future.result()
                        if error is None:
                            chunks.extend(file_chunks)
                        processed += 1
                        elapsed = time.perf_counter() - started_at
                        if error is not None:
                            await self._update_progress(
                                indexing_job_id,
                                processed,
                                total_files,
                                f"Error in {file_path.name}: {str(error)[:100]}",
                                current_file=str(file_path),
                                elapsed_seconds=elapsed,
                                stage="parsing",
                            )
                            last_progress_update = time.perf_counter()
                            logger.warning("Indexing error for %s: %s", file_path, error)
                            continue

                        should_update = (
                            processed % 5 == 0
                            or processed == total_files
                            or (time.perf_counter() - last_progress_update) >= 2
                        )
                        if should_update:
                            logger.info(
                                "indexing_progress - repo_id=%s stage=chunk processed=%s total=%s chunks=%s",
                                repo_id,
                                processed,
                                total_files,
                                len(chunks),
                            )
                            await self._update_progress(
                                indexing_job_id,
                                processed,
                                total_files,
                                f"Indexed {processed}/{total_files} files ({len(chunks)} chunks)",
                                current_file=str(file_path),
                                elapsed_seconds=elapsed,
                                stage="parsing",
                            )
                            last_progress_update = time.perf_counter()

            await self._update_progress(
                indexing_job_id,
                total_files,
                total_files,
                f"Storing {len(chunks)} chunks...",
                elapsed_seconds=time.perf_counter() - started_at,
                stage="storage",
                extra_stats={
                    "indexing_mode": indexing_mode,
                    "total_chunks": len(chunks),
                    "stored_chunks": 0,
                },
            )
            logger.debug("index_repository - phase=store repo_id=%s chunks=%s", repo_id, len(chunks))
            logger.info("indexing_progress - repo_id=%s stage=store total_chunks=%s", repo_id, len(chunks))

            if repository_id:
                self._assign_repository_ids_and_chunk_ids(repository_id, chunks)

            await self._upsert_chunks(chunks)

            if repository_id and chunks:
                await self._apply_post_index_cleanup(
                    repository_id=str(repository_id),
                    repo_root=root,
                    indexing_mode="full" if indexing_mode in {"full", "repair"} else indexing_mode,
                    changed_paths=changed_paths,
                    deleted_paths=deleted_paths,
                    keep_ids={str(chunk.id) for chunk in chunks},
                )
            elif repository_id and deleted_paths and indexing_mode == "incremental":
                await self._apply_post_index_cleanup(
                    repository_id=str(repository_id),
                    repo_root=root,
                    indexing_mode=indexing_mode,
                    changed_paths=set(),
                    deleted_paths=deleted_paths,
                    keep_ids=set(),
                )

            logger.info(
                "Indexing completed repo_id=%s repository_id=%s files=%s chunks=%s",
                repo_id,
                repository_id,
                total_files,
                len(chunks),
            )
            logger.info("indexing_success - repo_id=%s repository_id=%s chunks=%s", repo_id, repository_id, len(chunks))

            # --- Create snapshot ---
            if repository_id:
                await self._update_progress(
                    indexing_job_id,
                    total_files,
                    total_files,
                    "Creating repository snapshot...",
                    elapsed_seconds=time.perf_counter() - started_at,
                    stage="finalize",
                    extra_stats={
                        "total_chunks": len(chunks),
                        "stored_chunks": len(chunks),
                    },
                )
                await create_snapshot(
                    self.session,
                    repository_id=repository_id,
                    commit_sha=commit_sha,
                    files_count=self._files_indexed,
                    files_skipped=self._files_skipped,
                    chunks_count=len(chunks),
                )

            self._finalize_stage_timings()
            msg = (
                f"Index repair complete ({len(chunks)} chunks)"
                if indexing_mode == "repair" and len(chunks) > 0
                else f"Indexing complete ({len(chunks)} new chunks)"
                if len(chunks) > 0
                else "Index up to date"
            )
            await self._update_progress(
                indexing_job_id,
                total_files,
                total_files,
                msg,
                elapsed_seconds=time.perf_counter() - started_at,
                stage="finalize",
                extra_stats={
                    "percentage": 100,
                    "total_chunks": len(chunks),
                    "stored_chunks": len(chunks),
                    "stage_timings": dict(self._stage_timings),
                },
            )

            if cleanup_cached_repo and settings.repo_cache_persist and repository_id:
                self._persist_repository_cache_path(repository_id, root)
                logger.info(
                    "index_cache_kept - repo_id=%s cache_path=%s persist=%s",
                    repo_id,
                    root,
                    settings.repo_cache_persist,
                )

            return len(chunks)
        except Exception as exc:
            logger.exception(
                "indexing_failure - repo_id=%s repository_id=%s detail=%s",
                repo_id,
                repository_id,
                self._format_process_error(exc, "indexing failed"),
            )
            raise
        finally:
            # Keep cloned repos on disk after indexing (REPO_CACHE_PERSIST=true) for
            # file explorer, patches, and diffs. Full re-index wipes cache at job start.
            should_delete = cleanup_cached_repo and not settings.repo_cache_persist
            if should_delete and root.exists():
                shutil.rmtree(root, ignore_errors=True)
                logger.info("index_cache_cleanup - removed ephemeral clone repo_id=%s", repo_id)
            self._active_indexing_job_id = None
            self._active_total_files = None
            self._active_started_at_perf = None
            self._active_repository_id = None
            self._files_indexed = 0
            self._files_skipped = 0
            self._chunks_created = 0
            self._index_errors = []
            logger.debug("index_repository - cleanup complete repo_id=%s", repo_id)

    def _assign_repository_ids_and_chunk_ids(self, repository_id: str, chunks: list[CodeChunk]) -> None:
        for chunk in chunks:
            chunk.repository_id = repository_id
            full_content_hash = hashlib.sha256((chunk.content or "").encode("utf-8", errors="ignore")).hexdigest()
            chunk.content_hash = full_content_hash
            short_hash = full_content_hash[:16]
            raw_key = (
                f"{repository_id}|{chunk.commit_sha}|{chunk.path}|{chunk.symbol}|{chunk.chunk_type}"
                f"|{chunk.start_line}|{chunk.end_line}|{short_hash}"
            )
            chunk.id = str(uuid.uuid5(uuid.NAMESPACE_OID, raw_key))

    def generic_chunk_file(
        self,
        repo_id: str,
        commit_sha: str,
        rel_path: str,
        source: str,
        file_suffix: str = "",
    ) -> list[CodeChunk]:
        # Simple chunking: split file into N-line chunks (e.g., 40 lines)
        chunks: list[CodeChunk] = []
        lines = source.splitlines()
        chunk_size = 40
        for i in range(0, len(lines), chunk_size):
            chunk_lines = lines[i:i+chunk_size]
            content = "\n".join(chunk_lines)
            
            # Prevent massive minified lines from breaking the LLM context window (e.g. minified JS/JSON)
            if len(content) > 15000:
                content = content[:15000] + "\n...[truncated]"
                
            start_line = i + 1
            end_line = min(i + chunk_size, len(lines))
            # Use UUID5 for deterministic, Qdrant-compatible IDs
            raw_key = f"{repo_id}|{rel_path}|{start_line}|{end_line}"
            chunk_id = str(uuid.uuid5(uuid.NAMESPACE_OID, raw_key))
            chunks.append(
                CodeChunk(
                    id=chunk_id,
                    repo_id=repo_id,
                    commit_sha=commit_sha,
                    path=rel_path,
                    language=file_suffix.lstrip("."),
                    symbol="",
                    chunk_type="generic",
                    start_line=start_line,
                    end_line=end_line,
                    content=content,
                )
            )
        return chunks

    async def _upsert_chunks(self, chunks: list[CodeChunk]) -> None:
        """Store chunks in PostgreSQL and upsert vectors when embeddings are available.

        Notes:
        - Inserts are committed in small batches to avoid holding a huge transaction.
        - Row-level failures use savepoints so one bad row does not erase prior work.
        - Progress heartbeat is updated during the storing phase to avoid false "stalled" marking.
        """
        if not chunks:
            return
        logger.info("index_store_chunks - start chunks=%s", len(chunks))

        indexing_job_id = self._active_indexing_job_id
        total_files = self._active_total_files
        elapsed_seconds = (
            (time.perf_counter() - self._active_started_at_perf)
            if self._active_started_at_perf is not None
            else None
        )

        is_sqlite = is_sqlite_session(self.session)
        metadata_sql = get_jsonb_cast_sql("metadata", is_sqlite)

        stmt_without_embedding = text(
            f"""
            INSERT INTO code_chunks (
                            id, repo_id, repository_id, commit_sha, path, language, symbol,
              chunk_type, start_line, end_line, content, metadata, embedding
            ) VALUES (
                            :id, :repo_id, :repository_id, :commit_sha, :path, :language, :symbol,
              :chunk_type, :start_line, :end_line, :content, {metadata_sql},
              NULL
            )
            ON CONFLICT (id) DO UPDATE SET
              commit_sha = EXCLUDED.commit_sha,
              content    = EXCLUDED.content,
              metadata   = EXCLUDED.metadata
            """
        )

        stmt_with_embedding = text(
            f"""
            INSERT INTO code_chunks (
                            id, repo_id, repository_id, commit_sha, path, language, symbol,
              chunk_type, start_line, end_line, content, metadata, embedding
            ) VALUES (
                            :id, :repo_id, :repository_id, :commit_sha, :path, :language, :symbol,
              :chunk_type, :start_line, :end_line, :content, {metadata_sql},
              CAST(:embedding AS vector)
            )
            ON CONFLICT (id) DO UPDATE SET
              commit_sha = EXCLUDED.commit_sha,
              content    = EXCLUDED.content,
              metadata   = EXCLUDED.metadata,
              embedding  = EXCLUDED.embedding
            """
        )

        qdrant_points: list[dict] = []
        total_chunks = len(chunks)
        stored_chunks = 0  # Chunks stored to PostgreSQL
        qdrant_chunks = 0  # Chunks successfully stored to Qdrant
        embeddings_skipped = 0  # Chunks without embeddings
        consecutive_embedding_failures = 0
        last_store_heartbeat = time.perf_counter()

        supports_begin = callable(getattr(self.session, "begin", None))
        supports_nested = callable(getattr(self.session, "begin_nested", None))

        for idx in range(0, len(chunks), 16):
            batch = chunks[idx : idx + 16]
            logger.debug("index_store_chunks - batch start offset=%s batch_size=%s", idx, len(batch))
            embeddings_by_id: dict[str, list[float]] = {}

            for chunk in batch:
                try:
                    if self._prefer_cached_embeddings:
                        embedding = embed_text_cached(chunk.content)
                    else:
                        embedding = self.embedder.embed_text(chunk.content)
                    validate_embedding_dimension(embedding)
                    embeddings_by_id[chunk.id] = embedding
                    consecutive_embedding_failures = 0
                except Exception as exc:
                    # Phase 3 FIX: Detailed error logging for embedding failures
                    error_msg = str(exc)
                    error_type = type(exc).__name__
                    logger.error(
                        "index_store_chunks - embedding failed repo_id=%s chunk_id=%s path=%s error_type=%s error=%s",
                        chunk.repo_id,
                        chunk.id,
                        chunk.path,
                        error_type,
                        error_msg,
                    )
                    # Log first occurrence with full context
                    if embeddings_skipped == 0:
                        logger.error(
                            "index_store_chunks - FIRST EMBEDDING FAILURE - This may indicate Ollama is not accessible. "
                            "Ensure Ollama is running at %s with model %s",
                            settings.ollama_base_url,
                            settings.ollama_embedding_model,
                        )
                    embeddings_skipped += 1
                    consecutive_embedding_failures += 1
                    
                    if consecutive_embedding_failures >= 5:
                        raise ExternalServiceError(
                            service_name="Ollama",
                            underlying_error="Aborting indexing due to multiple consecutive embedding failures. Please ensure Ollama is running."
                        ) from exc
                        
                    continue

            # Commit per batch so progress is durable and large transactions are avoided.
            batch_ctx = self.session.begin() if supports_begin else nullcontext()
            with batch_ctx:
                for chunk in batch:
                    embedding_vec = embeddings_by_id.get(chunk.id)
                    if embedding_vec is not None:
                        vector_literal = "[" + ",".join(f"{v:.8f}" for v in embedding_vec) + "]"
                        chunk.embedding = embedding_vec
                    else:
                        vector_literal = None

                    params = {
                        "id": chunk.id,
                        "repo_id": chunk.repo_id,
                        "repository_id": chunk.repository_id,
                        "commit_sha": chunk.commit_sha,
                        "path": chunk.path,
                        "language": chunk.language,
                        "symbol": chunk.symbol,
                        "chunk_type": chunk.chunk_type,
                        "start_line": chunk.start_line,
                        "end_line": chunk.end_line,
                        "content": chunk.content,
                        "metadata": "{}",
                    }

                    try:
                        if vector_literal is not None:
                            params["embedding"] = vector_literal
                            try:
                                nested_ctx = self.session.begin_nested() if supports_nested else nullcontext()
                                with nested_ctx:
                                    self.session.execute(stmt_with_embedding, params)
                            except Exception as exc:
                                # If vector insert fails (e.g., pgvector not installed), fall back to storing without embedding.
                                logger.warning(
                                    "index_store_chunks - vector insert failed repo_id=%s chunk_id=%s path=%s error=%s",
                                    chunk.repo_id,
                                    chunk.id,
                                    chunk.path,
                                    exc,
                                )
                                try:
                                    if not supports_nested:
                                        self.session.rollback()
                                    nested_ctx = self.session.begin_nested() if supports_nested else nullcontext()
                                    with nested_ctx:
                                        self.session.execute(stmt_without_embedding, params)
                                except Exception as exc:
                                    logger.warning(
                                        "index_store_chunks - row insert failed repo_id=%s chunk_id=%s path=%s error=%s",
                                        chunk.repo_id,
                                        chunk.id,
                                        chunk.path,
                                        exc,
                                    )
                                    if not supports_nested:
                                        self.session.rollback()
                                    continue
                            else:
                                qdrant_points.append(
                                    {
                                        "id": chunk.id,
                                        "vector": embedding_vec,
                                        "payload": {
                                            "repo_id": chunk.repo_id,
                                            "repository_id": chunk.repository_id,
                                            "path": chunk.path,
                                            "symbol": chunk.symbol,
                                            "chunk_type": chunk.chunk_type,
                                        },
                                    }
                                )
                        else:
                            try:
                                nested_ctx = self.session.begin_nested() if supports_nested else nullcontext()
                                with nested_ctx:
                                    self.session.execute(stmt_without_embedding, params)
                            except Exception as exc:
                                logger.warning(
                                    "index_store_chunks - row insert failed repo_id=%s chunk_id=%s path=%s error=%s",
                                    chunk.repo_id,
                                    chunk.id,
                                    chunk.path,
                                    exc,
                                )
                                if not supports_nested:
                                    self.session.rollback()
                                continue
                        stored_chunks += 1
                    except Exception as exc:
                        logger.warning(
                            "index_store_chunks - row store failed repo_id=%s chunk_id=%s path=%s error=%s",
                            chunk.repo_id,
                            chunk.id,
                            chunk.path,
                            exc,
                        )
                        # If we can't even store without embedding, skip this row.
                        if not supports_nested:
                            self.session.rollback()
                        continue

            if not supports_begin:
                try:
                    self.session.commit()
                except Exception:
                    self.session.rollback()
                    raise

            # Keep progress heartbeat fresh during storing.
            if indexing_job_id and (time.perf_counter() - last_store_heartbeat) >= 2:
                await self._update_progress(
                    indexing_job_id,
                    stored_chunks,
                    total_chunks,
                    f"Storing chunks... ({stored_chunks}/{total_chunks}, {len(qdrant_points)} with vectors)",
                    elapsed_seconds=elapsed_seconds,
                    stage="storage",
                    extra_stats={
                        "total_chunks": total_chunks,
                        "stored_chunks": stored_chunks,
                        "qdrant_chunks_queued": len(qdrant_points),
                        "embeddings_skipped": embeddings_skipped,
                    },
                )
                last_store_heartbeat = time.perf_counter()

        if stored_chunks == 0:
            raise DatabaseException(
                "Indexing produced chunks, but none were stored to PostgreSQL. "
                "Check that the backend is connected to the expected database and that schema initialization succeeded."
            )
        logger.info(
            "index_store_chunks - stored chunks=%s qdrant_points=%s embeddings_skipped=%s",
            stored_chunks,
            len(qdrant_points),
            embeddings_skipped,
        )

        if qdrant_points:
            try:
                # PHASE 1 FIX: QdrantService methods are now sync
                self.qdrant.ensure_collection()
                logger.debug("index_store_chunks - qdrant collection ensured")
                
                # Phase 3 FIX: Batch upsert with verification
                for start in range(0, len(qdrant_points), 64):
                    batch_points = qdrant_points[start : start + 64]
                    try:
                        self.qdrant.upsert_points(batch_points)
                        qdrant_chunks += len(batch_points)
                        logger.debug(
                            "index_store_chunks - qdrant batch upserted batch_size=%s total_qdrant=%s",
                            len(batch_points),
                            qdrant_chunks,
                        )
                    except ExternalServiceError as batch_exc:
                        logger.error(
                            "index_store_chunks - qdrant batch upsert failed batch_size=%s error=%s",
                            len(batch_points),
                            batch_exc,
                        )
                        raise
                
                logger.info(
                    "index_store_chunks - qdrant upsert completed qdrant_chunks=%s",
                    qdrant_chunks,
                )
            except ExternalServiceError as exc:
                logger.error(
                    "index_store_chunks - qdrant upsert failed total_points=%s error=%s",
                    len(qdrant_points),
                    exc,
                )
                # Phase 3 FIX: Don't silently fail - log mismatch and raise
                raise DatabaseException(
                    f"Failed to sync {len(qdrant_points)} chunks to Qdrant. "
                    f"Database has {stored_chunks} chunks but {qdrant_chunks} in Qdrant. "
                    f"Please retry indexing after verifying Qdrant is running."
                ) from exc
        else:
            logger.warning(
                "index_store_chunks - no chunks with embeddings to store in qdrant stored_chunks=%s embeddings_skipped=%s",
                stored_chunks,
                embeddings_skipped,
            )
            # Phase 3 FIX: Detailed diagnostic when ALL embeddings failed
            if stored_chunks > 0 and embeddings_skipped == stored_chunks:
                logger.error(
                    "index_store_chunks - CRITICAL: All embeddings failed! "
                    "This indicates Ollama embedding service is not accessible. "
                    "Current config: ollama_base_url=%s ollama_model=%s "
                    "If using Podman, ensure the container is running and network is accessible. "
                    "To debug: curl %s/api/models",
                    settings.ollama_base_url,
                    settings.ollama_embedding_model,
                    settings.ollama_base_url,
                )


    # NEW: File record + snapshot helpers added in Phase 1
    _PHASE1_MARKER = True
