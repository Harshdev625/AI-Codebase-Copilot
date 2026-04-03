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
from app.rag.embeddings.provider import get_embedding_provider, validate_embedding_dimension
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

    def _run_git(self, args: list[str], cwd: Path | None = None, timeout: int = 300) -> subprocess.CompletedProcess:
        """Run git command with timeout (default 5 minutes)."""
        try:
            return subprocess.run(
                ["git", *args],
                cwd=str(cwd) if cwd else None,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"Git command timed out after {timeout}s: {' '.join(args)}") from exc

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
        if repo_path:
            root = Path(repo_path)
            if not root.exists():
                raise FileNotFoundError(f"Repository path does not exist: {repo_path}")
            return root

        if not repo_url:
            raise ValueError("Provide either repo_path or repo_url")

        local_path_candidate = Path(repo_url)
        if local_path_candidate.exists():
            return local_path_candidate

        cache_root = self._cache_root()
        cache_root.mkdir(parents=True, exist_ok=True)

        target = cache_root / self._slugify_repo_id(repo_id)
        try:
            if (target / ".git").exists():
                self._run_git(["fetch", "--all", "--prune"], cwd=target)
                self._run_git(["reset", "--hard", "HEAD"], cwd=target)
                self._run_git(["clean", "-fd"], cwd=target)
                self._run_git(["pull", "--ff-only"], cwd=target)
            elif target.exists():
                shutil.rmtree(target)
                self._run_git(["clone", "--depth", "1", repo_url, str(target)])
            else:
                self._run_git(["clone", "--depth", "1", repo_url, str(target)])
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or "").strip()
            raise RuntimeError(f"Failed to prepare repository from repo_url: {stderr}") from exc

        if repo_ref:
            try:
                self._run_git(["fetch", "--all", "--tags"], cwd=target)
                self._run_git(["checkout", repo_ref], cwd=target)
            except subprocess.CalledProcessError:
                pass

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

    def __init__(self, session: Session) -> None:
        self.session = session
        self.embedder = get_embedding_provider()
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
        except Exception:
            # Non-critical update failure; rollback to avoid aborted transactions.
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
    ) -> int:
        root = self._resolve_repo_root(repo_id, repo_path=repo_path, repo_url=repo_url, repo_ref=repo_ref)
        cleanup_cached_repo = self._should_cleanup_cached_repo(root, repo_url=repo_url, repo_path=repo_path)
        started_at = time.perf_counter()
        self._active_indexing_job_id = indexing_job_id
        self._active_snapshot_id = snapshot_id
        self._active_started_at_perf = started_at
        self._active_repository_id = repository_id

        try:
            ignore_spec = self._load_gitignore_spec(root)
            self._update_progress(indexing_job_id, 0, 0, "Discovering files...", snapshot_id=snapshot_id)

            chunks: list[CodeChunk] = []
            file_list = list(self._iter_indexable_files(root, ignore_spec))
            total_files = len(file_list)
            self._active_total_files = total_files
            self._update_progress(indexing_job_id, 0, total_files, f"Found {total_files} files to index", snapshot_id=snapshot_id)

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
                    "total_chunks": len(chunks),
                    "stored_chunks": 0,
                },
            )

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
            return len(chunks)
        finally:
            if cleanup_cached_repo and root.exists():
                shutil.rmtree(root, ignore_errors=True)
            self._active_indexing_job_id = None
            self._active_snapshot_id = None
            self._active_total_files = None
            self._active_started_at_perf = None
            self._active_repository_id = None

    def _rebuild_repo_graph(self, repo_id: str, repository_id: str) -> None:
        try:
            rebuild_code_graph(self.session, repository_id, repo_id)
        except Exception:
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
            embeddings_by_id: dict[str, list[float]] = {}

            for chunk in batch:
                try:
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

        if qdrant_points:
            try:
                self.qdrant.ensure_collection()
                for start in range(0, len(qdrant_points), 64):
                    batch_points = qdrant_points[start : start + 64]
                    self.qdrant.upsert_points(batch_points)
            except RuntimeError as exc:
                logger.warning("Qdrant upsert failed; continuing without vectors: %s", exc)

