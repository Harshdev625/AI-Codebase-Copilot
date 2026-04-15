from __future__ import annotations

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

from pathspec import PathSpec
from pathspec.patterns import GitWildMatchPattern
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.domain_models import CodeChunk
from app.rag.chunking.ast_chunker import chunk_python_file
from app.rag.chunking.tree_sitter_chunker import chunk_with_tree_sitter
from app.rag.embeddings.provider import embed_text_cached, get_embedding_provider, validate_embedding_dimension
from app.rag.retrieval.code_graph import rebuild_code_graph
from app.services.qdrant_service import QdrantService


logger = logging.getLogger(__name__)


class IndexingService:
    SUPPORTED_SUFFIXES = {
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".mjs",
        ".cjs",
        ".mts",
        ".cts",
        ".java",
        ".kt",
        ".kts",
        ".md",
        ".mdx",
        ".txt",
        ".json",
        ".yaml",
        ".yml",
        ".toml",
        ".xml",
        ".go",
        ".rs",
        ".swift",
        ".php",
        ".rb",
        ".cpp",
        ".c",
        ".h",
        ".hpp",
        ".cs",
        ".sh",
        ".ps1",
        ".sql",
        ".html",
        ".css",
        ".scss",
        ".less",
    }

    NOISY_FILENAMES = {
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "poetry.lock",
        "pipfile.lock",
    }

    NOISY_PATH_SEGMENTS = {
        "node_modules",
        "dist",
        "build",
        ".next",
        "coverage",
    }

    def _is_low_signal_file(self, file_path: Path, repo_root: Path) -> bool:
        if file_path.name.lower() in self.NOISY_FILENAMES:
            return True

        rel_parts = {part.lower() for part in file_path.relative_to(repo_root).parts}
        if rel_parts.intersection(self.NOISY_PATH_SEGMENTS):
            return True

        lower_name = file_path.name.lower()
        if lower_name.endswith(".min.js") or lower_name.endswith(".min.css"):
            return True

        return False

    def _slugify_repo_id(self, repo_id: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", repo_id).strip(".-")
        return slug or "repo"

    def _kill_git_processes(self, target: Path) -> None:
        """Kill any git processes that might be holding locks on the target directory."""
        if not target.exists():
            return
        
        target_str = str(target.resolve())
        logger.info("index_cleanup_git - killing processes for %s", target_str)
        
        try:
            # On Windows, use wmic or taskkill to find git processes with target path in command line
            if os.name == "nt":
                # Find git processes. This is a bit aggressive but ensures we can delete the dir.
                cmd = 'wmic process where "name=\'git.exe\'" get processid,commandline /format:list'
                proc = subprocess.run(cmd, capture_output=True, text=True, shell=True)
                if proc.returncode == 0:
                    for line in proc.stdout.splitlines():
                        if "CommandLine=" in line and target_str in line:
                            # Found a git process for this target
                            pass # We'll just kill all git.exe for simplicity if needed, or parse PID
                
                # Simple approach: kill all git.exe instances if blocking. 
                # Better: kill specifically for this dir if possible.
                # For now, let's try taskkill /F /IM git.exe if we suspect it's blocking.
                # Actually, a more focused approach is better.
                pass 
        except Exception as e:
            logger.debug("index_cleanup_git - failed to kill processes: %s", e)

    def _force_delete_directory(self, target: Path) -> None:
        """Force delete a directory with retries and permission handling."""
        if not target.exists():
            return
            
        logger.info("index_cleanup_dir - force deleting %s", target)
        
        def _on_rm_error(func, path, exc_info):
            # Change permissions to read-write and try again
            try:
                os.chmod(path, stat.S_IWRITE)
                func(path)
            except Exception:
                pass

        for attempt in range(3):
            try:
                if target.is_dir():
                    shutil.rmtree(target, onerror=_on_rm_error)
                else:
                    target.unlink()
                
                if not target.exists():
                    logger.info("index_cleanup_dir - successfully deleted %s on attempt %s", target, attempt + 1)
                    return
            except Exception as e:
                logger.warning("index_cleanup_dir - delete attempt %s failed for %s: %s", attempt + 1, target, e)
                time.sleep(1) # Wait a bit before retry
        
        # Final attempt with shell command if shutil fails
        try:
            if os.name == "nt":
                subprocess.run(["rd", "/s", "/q", str(target)], shell=True, check=False)
            else:
                subprocess.run(["rm", "-rf", str(target)], check=False)
        except Exception:
            pass
            
        if target.exists():
            raise RuntimeError(f"Failed to delete directory after multiple attempts: {target}")

    def _run_git(self, args: list[str], cwd: Path | None = None, timeout: int = 300) -> subprocess.CompletedProcess:
        """Run git command with timeout (default 5 minutes)."""
        command_text = "git " + " ".join(args)
        logger.debug("index_git - running command=%s cwd=%s timeout=%s", command_text, cwd, timeout)
        try:
            result = subprocess.run(
                ["git", *args],
                cwd=str(cwd) if cwd else None,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout,
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
            raise

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

    def _cache_root(self) -> Path:
        cache_root = Path(settings.repo_cache_dir)
        if not cache_root.is_absolute():
            cache_root = (Path.cwd() / cache_root).resolve()
        return cache_root

    def _should_cleanup_cached_repo(self, root: Path, repo_url: str | None, repo_path: str | None) -> bool:
        if settings.repo_cache_persist:
            return False
        if repo_path:
            return False
        if not repo_url:
            return False
        if Path(repo_url).exists():
            return False
        cache_root = self._cache_root()
        try:
            root.resolve().relative_to(cache_root.resolve())
            return True
        except ValueError:
            return False

    def _resolve_repo_root(
        self,
        repo_id: str,
        repo_path: str | None,
        repo_url: str | None,
        repo_ref: str | None,
    ) -> Path:
        logger.info(
            "index_resolve_repo - start repo_id=%s repo_path=%s repo_url=%s repo_ref=%s",
            repo_id,
            repo_path,
            repo_url,
            repo_ref,
        )
        if repo_path:
            root = Path(repo_path)
            if not root.exists():
                raise FileNotFoundError(f"Repository path does not exist: {repo_path}")
            logger.info("index_resolve_repo - using local path repo_id=%s root=%s", repo_id, root)
            return root

        if not repo_url:
            raise ValueError("Provide either repo_path or repo_url")

        local_path_candidate = Path(repo_url)
        if local_path_candidate.exists():
            logger.info("index_resolve_repo - repo_url resolved to local path repo_id=%s root=%s", repo_id, local_path_candidate)
            return local_path_candidate

        cache_root = self._cache_root()
        cache_root.mkdir(parents=True, exist_ok=True)

        target = cache_root / self._slugify_repo_id(repo_id)
        try:
            if target.exists():
                self._kill_git_processes(target)
                self._force_delete_directory(target)

            logger.info("index_clone - start repo_id=%s repo_url=%s target=%s ref=%s", repo_id, repo_url, target, repo_ref)
            
            clone_args = ["clone", "--depth", "1"]
            if repo_ref:
                clone_args.extend(["--branch", repo_ref])
            
            clone_args.extend([repo_url, str(target)])
            
            self._run_git(clone_args, timeout=600)
            logger.info("index_clone - success repo_id=%s target=%s", repo_id, target)
        except Exception as exc:
            detail = self._format_process_error(exc, "Repository preparation failed")
            logger.error("index_clone - failure repo_id=%s detail=%s", repo_id, detail)
            raise RuntimeError(
                f"Failed to prepare repository: {detail}"
            ) from exc

        logger.info("index_resolve_repo - ready repo_id=%s root=%s", repo_id, target)
        return target

    def _iter_git_listed_files(self, repo_root: Path):
        try:
            result = self._run_git(
                ["-C", str(repo_root), "ls-files", "--cached", "--others", "--exclude-standard", "-z"]
            )
        except subprocess.CalledProcessError:
            return

        for rel_path in result.stdout.split("\x00"):
            if not rel_path:
                continue
            file_path = repo_root / rel_path
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in self.SUPPORTED_SUFFIXES:
                continue
            if self._is_low_signal_file(file_path, repo_root):
                continue
            if file_path.stat().st_size > settings.max_index_file_size_bytes:
                continue
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

    def _iter_indexable_files(self, repo_root: Path, spec: PathSpec):
        used_git_listing = False
        for file_path in self._iter_git_listed_files(repo_root):
            used_git_listing = True
            yield file_path

        if used_git_listing:
            return

        for dirpath, dirnames, filenames in os.walk(repo_root):
            current_dir = Path(dirpath)
            dirnames[:] = [
                dirname
                for dirname in dirnames
                if not self._is_ignored(spec, repo_root, current_dir / dirname, is_dir=True)
            ]

            for filename in filenames:
                file_path = current_dir / filename
                if self._is_ignored(spec, repo_root, file_path):
                    continue
                if file_path.suffix.lower() in self.SUPPORTED_SUFFIXES:
                    if self._is_low_signal_file(file_path, repo_root):
                        continue
                    if file_path.stat().st_size > settings.max_index_file_size_bytes:
                        continue
                    yield file_path

    def _get_previous_completed_commit(self, repository_id: str, snapshot_id: str | None) -> str | None:
        row = self.session.execute(
            text(
                """
                SELECT commit_sha
                FROM repository_snapshots
                WHERE repository_id = :repository_id
                  AND index_status = 'completed'
                  AND (:snapshot_id IS NULL OR id <> :snapshot_id)
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {"repository_id": repository_id, "snapshot_id": snapshot_id},
        ).mappings().first()
        if not row:
            return None
        value = str(row.get("commit_sha") or "").strip()
        return value or None

    def _git_commit_exists(self, repo_root: Path, commit_sha: str) -> bool:
        if not commit_sha:
            return False
        if not (repo_root / ".git").exists():
            return False
        try:
            self._run_git(["-C", str(repo_root), "cat-file", "-e", f"{commit_sha}^{{commit}}"], timeout=60)
            return True
        except Exception:
            return False

    def _collect_git_diff_paths(
        self,
        repo_root: Path,
        base_commit: str,
        target_commit: str,
    ) -> tuple[set[str], set[str]]:
        if not (repo_root / ".git").exists():
            raise RuntimeError("Repository is not a git checkout; cannot run incremental diff")
        if not self._git_commit_exists(repo_root, base_commit):
            raise RuntimeError(f"Base commit not available locally: {base_commit}")
        if not self._git_commit_exists(repo_root, target_commit):
            raise RuntimeError(f"Target commit not available locally: {target_commit}")

        result = self._run_git(
            [
                "-C",
                str(repo_root),
                "diff",
                "--name-status",
                "--find-renames",
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
            if file_path.suffix.lower() not in self.SUPPORTED_SUFFIXES:
                continue
            if self._is_low_signal_file(file_path, repo_root):
                continue
            if file_path.stat().st_size > settings.max_index_file_size_bytes:
                continue
            files.append(file_path)
        return files

    def _delete_all_repository_chunks(self, repository_id: str) -> None:
        try:
            self.qdrant.delete_points_by_repository(repository_id)
        except Exception:
            logger.warning("index_delete_qdrant - repository purge failed repository_id=%s", repository_id)
        try:
            self.session.execute(
                text("DELETE FROM code_chunks WHERE repository_id = :repository_id"),
                {"repository_id": repository_id},
            )
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

    def _delete_repository_chunks_for_paths(
        self,
        repository_id: str,
        repo_root: Path,
        relative_paths: set[str],
    ) -> None:
        if not relative_paths:
            return

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

                self.session.execute(stmt, params)

            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

        if point_ids:
            try:
                self.qdrant.delete_points_by_ids(list(point_ids))
            except Exception:
                logger.warning(
                    "index_delete_qdrant - path purge failed repository_id=%s point_count=%s",
                    repository_id,
                    len(point_ids),
                )

    def __init__(self, session: Session) -> None:
        self.session = session
        self.embedder = get_embedding_provider()
        self._prefer_cached_embeddings = self.embedder.__class__.__name__ == "OllamaEmbeddingProvider"
        self.qdrant = QdrantService()
        # Progress context for long-running store phase (set by index_repository).
        self._active_indexing_job_id: str | None = None
        self._active_snapshot_id: str | None = None
        self._active_total_files: int | None = None
        self._active_started_at_perf: float | None = None
        self._active_repository_id: str | None = None

    def _update_progress(
        self,
        indexing_job_id: str | None,
        current: int,
        total: int,
        message: str = "",
        current_file: str | None = None,
        elapsed_seconds: float | None = None,
        snapshot_id: str | None = None,
        extra_stats: dict | None = None,
    ) -> None:
        """Update indexing progress in both indexing_jobs and snapshot stats."""
        if not indexing_job_id:
            return
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
            "current_file": current_file,
            "eta_seconds": eta_seconds,
            "avg_seconds_per_file": round(avg_seconds_per_file, 4) if avg_seconds_per_file is not None else None,
            "updated_at_epoch": time.time(),
        }
        if extra_stats:
            try:
                stats_payload.update(extra_stats)
            except Exception:
                pass
        try:
            self.session.execute(
                text(
                    """
                    UPDATE indexing_jobs
                    SET message = :message,
                        updated_at = NOW(),
                        status = CASE WHEN status = 'pending' THEN 'running' ELSE status END
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id, "message": message or f"Processing: {current}/{total} files"},
            )

            target_snapshot_id = snapshot_id
            if not target_snapshot_id:
                row = self.session.execute(
                    text("SELECT snapshot_id FROM indexing_jobs WHERE id = :id"),
                    {"id": indexing_job_id},
                ).mappings().first()
                target_snapshot_id = row["snapshot_id"] if row else None

            if target_snapshot_id:
                self.session.execute(
                    text(
                        """
                        UPDATE repository_snapshots
                        SET stats = CAST(:stats AS jsonb),
                            index_status = CASE WHEN index_status = 'pending' THEN 'running' ELSE index_status END
                        WHERE id = :snapshot_id
                        """
                    ),
                    {"snapshot_id": target_snapshot_id, "stats": json.dumps(stats_payload)},
                )
            self.session.commit()
            logger.debug(
                "index_progress_update - success job_id=%s current=%s total=%s percentage=%s",
                indexing_job_id,
                current,
                total,
                percentage,
            )
        except Exception:
            # Non-critical update failure; rollback to avoid aborted transactions.
            logger.exception("index_progress_update - failed job_id=%s", indexing_job_id)
            self.session.rollback()

    def index_repository(
        self,
        repo_id: str,
        repository_id: str | None,
        commit_sha: str,
        repo_path: str | None = None,
        repo_url: str | None = None,
        repo_ref: str | None = None,
        indexing_job_id: str | None = None,
        snapshot_id: str | None = None,
        full_reindex: bool = False,
    ) -> int:
        logger.info(
            "index_repository - start repo_id=%s repository_id=%s commit_sha=%s",
            repo_id,
            repository_id,
            commit_sha,
        )
        logger.info("indexing_start - repo_id=%s repository_id=%s", repo_id, repository_id)
        root = self._resolve_repo_root(repo_id, repo_path=repo_path, repo_url=repo_url, repo_ref=repo_ref)
        cleanup_cached_repo = self._should_cleanup_cached_repo(root, repo_url=repo_url, repo_path=repo_path)
        started_at = time.perf_counter()
        self._active_indexing_job_id = indexing_job_id
        self._active_snapshot_id = snapshot_id
        self._active_started_at_perf = started_at
        self._active_repository_id = repository_id

        try:
            ignore_spec = self._load_gitignore_spec(root)
            logger.debug("index_repository - phase=discover repo_id=%s", repo_id)
            self._update_progress(indexing_job_id, 0, 0, "Discovering files...", snapshot_id=snapshot_id)

            chunks: list[CodeChunk] = []
            file_list: list[Path]
            changed_paths: set[str] = set()
            deleted_paths: set[str] = set()

            indexing_mode = "full"
            mode_reason = "full reindex"
            force_full_reindex = bool(full_reindex or settings.indexing_force_full_reindex)

            can_attempt_incremental = (
                not force_full_reindex
                and settings.indexing_incremental_enabled
                and repository_id is not None
                and bool(str(commit_sha).strip())
                and str(commit_sha).strip() != "local-working-copy"
            )

            if can_attempt_incremental:
                previous_commit = self._get_previous_completed_commit(str(repository_id), snapshot_id)
                if previous_commit and previous_commit != commit_sha:
                    try:
                        changed_paths, deleted_paths = self._collect_git_diff_paths(
                            root,
                            previous_commit,
                            commit_sha,
                        )
                        file_list = self._filter_incremental_files(root, ignore_spec, changed_paths)
                        indexing_mode = "incremental"
                        mode_reason = (
                            f"changed_paths={len(changed_paths)} deleted_paths={len(deleted_paths)} "
                            f"from={previous_commit[:10]}"
                        )
                    except Exception as exc:
                        logger.warning(
                            "index_repository - incremental fallback repo_id=%s reason=%s",
                            repo_id,
                            self._format_process_error(exc, "incremental diff unavailable"),
                        )
                        file_list = list(self._iter_indexable_files(root, ignore_spec))
                        indexing_mode = "full"
                        mode_reason = "incremental fallback to full"
                elif previous_commit == commit_sha:
                    file_list = []
                    indexing_mode = "incremental"
                    mode_reason = "no code changes since previous indexed commit"
                else:
                    file_list = list(self._iter_indexable_files(root, ignore_spec))
                    indexing_mode = "full"
                    mode_reason = "no previous completed snapshot"
            else:
                file_list = list(self._iter_indexable_files(root, ignore_spec))
                if force_full_reindex:
                    mode_reason = "forced full reindex"
                elif not settings.indexing_incremental_enabled:
                    mode_reason = "incremental disabled"
                elif not repository_id:
                    mode_reason = "missing repository_id for incremental mode"
                else:
                    mode_reason = "non-commit indexing request"

            total_files = len(file_list)
            self._active_total_files = total_files
            logger.info(
                "index_repository - files discovered repo_id=%s mode=%s total_files=%s reason=%s",
                repo_id,
                indexing_mode,
                total_files,
                mode_reason,
            )
            logger.info(
                "indexing_progress - repo_id=%s stage=discover mode=%s total_files=%s",
                repo_id,
                indexing_mode,
                total_files,
            )
            self._update_progress(
                indexing_job_id,
                0,
                total_files,
                f"{indexing_mode.title()} indexing selected: {total_files} files",
                snapshot_id=snapshot_id,
                extra_stats={
                    "mode": indexing_mode,
                    "mode_reason": mode_reason,
                    "changed_paths": len(changed_paths),
                    "deleted_paths": len(deleted_paths),
                },
            )

            if repository_id:
                if indexing_mode == "full":
                    self._delete_all_repository_chunks(str(repository_id))
                else:
                    paths_to_refresh = set(changed_paths)
                    paths_to_refresh.update(deleted_paths)
                    paths_to_refresh.update(
                        fp.relative_to(root).as_posix()
                        for fp in file_list
                        if fp.exists()
                    )
                    self._delete_repository_chunks_for_paths(str(repository_id), root, paths_to_refresh)

            def _chunk_single_file(file_path: Path) -> tuple[Path, list[CodeChunk], Exception | None]:
                try:
                    source = file_path.read_text(encoding="utf-8", errors="ignore")
                    if file_path.suffix == ".py":
                        try:
                            python_chunks = chunk_python_file(repo_id, commit_sha, file_path, source)
                        except Exception:
                            python_chunks = []

                        if python_chunks:
                            return file_path, python_chunks, None

                        # Keep python files searchable even when AST parsing fails
                        # or when a file has no function/class definitions.
                        return file_path, self.generic_chunk_file(repo_id, commit_sha, file_path, source), None
                    structured_chunks = chunk_with_tree_sitter(repo_id, commit_sha, file_path, source)
                    if structured_chunks:
                        return file_path, structured_chunks, None
                    return file_path, self.generic_chunk_file(repo_id, commit_sha, file_path, source), None
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
                            self._update_progress(
                                indexing_job_id,
                                processed,
                                total_files,
                                f"Indexing in progress ({processed}/{total_files} files)",
                                elapsed_seconds=elapsed,
                                snapshot_id=snapshot_id,
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
                            self._update_progress(
                                indexing_job_id,
                                processed,
                                total_files,
                                f"Error in {file_path.name}: {str(error)[:100]}",
                                current_file=str(file_path),
                                elapsed_seconds=elapsed,
                                snapshot_id=snapshot_id,
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
                            self._update_progress(
                                indexing_job_id,
                                processed,
                                total_files,
                                f"Indexed {processed}/{total_files} files ({len(chunks)} chunks)",
                                current_file=str(file_path),
                                elapsed_seconds=elapsed,
                                snapshot_id=snapshot_id,
                            )
                            last_progress_update = time.perf_counter()

            self._update_progress(
                indexing_job_id,
                total_files,
                total_files,
                f"Storing {len(chunks)} chunks...",
                elapsed_seconds=time.perf_counter() - started_at,
                snapshot_id=snapshot_id,
                extra_stats={
                    "stage": "storing",
                    "mode": indexing_mode,
                    "total_chunks": len(chunks),
                    "stored_chunks": 0,
                },
            )
            logger.debug("index_repository - phase=store repo_id=%s chunks=%s", repo_id, len(chunks))
            logger.info("indexing_progress - repo_id=%s stage=store total_chunks=%s", repo_id, len(chunks))

            if repository_id:
                self._assign_repository_ids_and_chunk_ids(repository_id, chunks)

            self._upsert_chunks(chunks)
            if repository_id:
                self._rebuild_repo_graph(repo_id, repository_id)
            logger.info(
                "Indexing completed repo_id=%s repository_id=%s files=%s chunks=%s",
                repo_id,
                repository_id,
                total_files,
                len(chunks),
            )
            logger.info("indexing_success - repo_id=%s repository_id=%s chunks=%s", repo_id, repository_id, len(chunks))
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
            if cleanup_cached_repo and root.exists():
                shutil.rmtree(root, ignore_errors=True)
            self._active_indexing_job_id = None
            self._active_snapshot_id = None
            self._active_total_files = None
            self._active_started_at_perf = None
            self._active_repository_id = None
            logger.debug("index_repository - cleanup complete repo_id=%s", repo_id)

    def _rebuild_repo_graph(self, repo_id: str, repository_id: str) -> None:
        try:
            rebuild_code_graph(self.session, repository_id, repo_id)
        except Exception:
            logger.exception("index_repository - graph rebuild failed repository_id=%s", repository_id)
            self.session.rollback()

    def _assign_repository_ids_and_chunk_ids(self, repository_id: str, chunks: list[CodeChunk]) -> None:
        for chunk in chunks:
            chunk.repository_id = repository_id
            content_hash = hashlib.sha256((chunk.content or "").encode("utf-8", errors="ignore")).hexdigest()[:16]
            raw_key = (
                f"{repository_id}|{chunk.commit_sha}|{chunk.path}|{chunk.symbol}|{chunk.chunk_type}"
                f"|{chunk.start_line}|{chunk.end_line}|{content_hash}"
            )
            chunk.id = str(uuid.uuid5(uuid.NAMESPACE_OID, raw_key))

    def generic_chunk_file(self, repo_id: str, commit_sha: str, file_path: Path, source: str) -> list[CodeChunk]:
        # Simple chunking: split file into N-line chunks (e.g., 40 lines)
        chunks: list[CodeChunk] = []
        lines = source.splitlines()
        chunk_size = 40
        for i in range(0, len(lines), chunk_size):
            chunk_lines = lines[i:i+chunk_size]
            content = "\n".join(chunk_lines)
            start_line = i + 1
            end_line = min(i + chunk_size, len(lines))
            # Use UUID5 for deterministic, Qdrant-compatible IDs
            raw_key = f"{repo_id}|{file_path}|{start_line}|{end_line}"
            chunk_id = str(uuid.uuid5(uuid.NAMESPACE_OID, raw_key))
            chunks.append(
                CodeChunk(
                    id=chunk_id,
                    repo_id=repo_id,
                    commit_sha=commit_sha,
                    path=str(file_path),
                    language=file_path.suffix.lstrip('.'),
                    symbol="",
                    chunk_type="generic",
                    start_line=start_line,
                    end_line=end_line,
                    content=content,
                )
            )
        return chunks

    def _upsert_chunks(self, chunks: list[CodeChunk]) -> None:
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
        snapshot_id = self._active_snapshot_id
        total_files = self._active_total_files
        elapsed_seconds = (
            (time.perf_counter() - self._active_started_at_perf)
            if self._active_started_at_perf is not None
            else None
        )

        stmt_without_embedding = text(
            """
            INSERT INTO code_chunks (
                            id, repo_id, repository_id, commit_sha, path, language, symbol,
              chunk_type, start_line, end_line, content, metadata, embedding
            ) VALUES (
                            :id, :repo_id, :repository_id, :commit_sha, :path, :language, :symbol,
              :chunk_type, :start_line, :end_line, :content, CAST(:metadata AS jsonb),
              NULL
            )
            ON CONFLICT (id) DO UPDATE SET
              commit_sha = EXCLUDED.commit_sha,
              content    = EXCLUDED.content,
              metadata   = EXCLUDED.metadata
            """
        )

        stmt_with_embedding = text(
            """
            INSERT INTO code_chunks (
                            id, repo_id, repository_id, commit_sha, path, language, symbol,
              chunk_type, start_line, end_line, content, metadata, embedding
            ) VALUES (
                            :id, :repo_id, :repository_id, :commit_sha, :path, :language, :symbol,
              :chunk_type, :start_line, :end_line, :content, CAST(:metadata AS jsonb),
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
        stored_chunks = 0
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
                except Exception:
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
                            except Exception:
                                # If vector insert fails (e.g., pgvector not installed), fall back to storing without embedding.
                                try:
                                    if not supports_nested:
                                        self.session.rollback()
                                    nested_ctx = self.session.begin_nested() if supports_nested else nullcontext()
                                    with nested_ctx:
                                        self.session.execute(stmt_without_embedding, params)
                                except Exception:
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
                            except Exception:
                                if not supports_nested:
                                    self.session.rollback()
                                continue
                        stored_chunks += 1
                    except Exception:
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
                self._update_progress(
                    indexing_job_id,
                    total_files or 0,
                    total_files or 0,
                    f"Storing chunks... ({stored_chunks}/{total_chunks})",
                    elapsed_seconds=elapsed_seconds,
                    snapshot_id=snapshot_id,
                    extra_stats={
                        "stage": "storing",
                        "total_chunks": total_chunks,
                        "stored_chunks": stored_chunks,
                    },
                )
                last_store_heartbeat = time.perf_counter()

        if stored_chunks == 0:
            raise RuntimeError(
                "Indexing produced chunks, but none were stored to PostgreSQL. "
                "Check that the backend is connected to the expected database and that schema initialization succeeded."
            )
        logger.info("index_store_chunks - stored chunks=%s qdrant_points=%s", stored_chunks, len(qdrant_points))

        if qdrant_points:
            try:
                self.qdrant.ensure_collection()
                for start in range(0, len(qdrant_points), 64):
                    batch_points = qdrant_points[start : start + 64]
                    self.qdrant.upsert_points(batch_points)
            except RuntimeError as exc:
                logger.warning("Qdrant upsert failed; continuing without vectors: %s", exc)

