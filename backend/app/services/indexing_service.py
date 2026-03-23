from __future__ import annotations

import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path

from pathspec import PathSpec
from pathspec.patterns import GitWildMatchPattern
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.domain_models import CodeChunk
from app.rag.chunking.ast_chunker import chunk_python_file
from app.rag.embeddings.provider import get_embedding_provider, validate_embedding_dimension
from app.services.qdrant_service import QdrantService


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
                    if file_path.stat().st_size > settings.max_index_file_size_bytes:
                        continue
                    yield file_path

    def __init__(self, session: Session) -> None:
        self.session = session
        self.embedder = get_embedding_provider()
        self.qdrant = QdrantService()

    def _update_progress(self, indexing_job_id: str | None, current: int, total: int, message: str = "") -> None:
        """Update indexing job progress in database."""
        if not indexing_job_id:
            return
        try:
            self.session.execute(
                text(
                    """
                    UPDATE indexing_jobs
                    SET message = :message, updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id, "message": message or f"Processing: {current}/{total} files"},
            )
            self.session.commit()
        except Exception:
            # Non-critical update failure; rollback to avoid aborted transactions.
            self.session.rollback()

    def index_repository(
        self,
        repo_id: str,
        commit_sha: str,
        repo_path: str | None = None,
        repo_url: str | None = None,
        repo_ref: str | None = None,
        indexing_job_id: str | None = None,
    ) -> int:
        root = self._resolve_repo_root(repo_id, repo_path=repo_path, repo_url=repo_url, repo_ref=repo_ref)
        cleanup_cached_repo = self._should_cleanup_cached_repo(root, repo_url=repo_url, repo_path=repo_path)

        try:
            ignore_spec = self._load_gitignore_spec(root)
            self._update_progress(indexing_job_id, 0, 0, "Discovering files...")

            chunks: list[CodeChunk] = []
            file_list = list(self._iter_indexable_files(root, ignore_spec))
            total_files = len(file_list)
            self._update_progress(indexing_job_id, 0, total_files, f"Found {total_files} files to index")

            for idx, file_path in enumerate(file_list, 1):
                try:
                    source = file_path.read_text(encoding="utf-8", errors="ignore")
                    if file_path.suffix == ".py":
                        chunks.extend(chunk_python_file(repo_id, commit_sha, file_path, source))
                    else:
                        chunks.extend(self.generic_chunk_file(repo_id, commit_sha, file_path, source))

                    if idx % 10 == 0 or idx == total_files:
                        self._update_progress(indexing_job_id, idx, total_files, f"Indexed {idx}/{total_files} files ({len(chunks)} chunks)")
                except Exception as exc:
                    self._update_progress(indexing_job_id, idx, total_files, f"Error in {file_path.name}: {str(exc)[:100]}")
                    continue

            self._update_progress(indexing_job_id, total_files, total_files, f"Storing {len(chunks)} chunks...")
            self._upsert_chunks(chunks)
            return len(chunks)
        finally:
            if cleanup_cached_repo and root.exists():
                shutil.rmtree(root, ignore_errors=True)

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
        """Store chunks in PostgreSQL WITHOUT embeddings.
        
        Embeddings are generated separately in a non-blocking way.
        This ensures chunks are persisted for lexical search immediately.
        """
        if not chunks:
            return

        # Single SQL that works with NULL embedding values.
        # Embedding is optional — chunks can be searched lexically without vectors.
        stmt = text(
            """
            INSERT INTO code_chunks (
              id, repo_id, commit_sha, path, language, symbol,
              chunk_type, start_line, end_line, content, metadata, embedding
            ) VALUES (
              :id, :repo_id, :commit_sha, :path, :language, :symbol,
              :chunk_type, :start_line, :end_line, :content, CAST(:metadata AS jsonb),
              NULL
            )
            ON CONFLICT (id) DO UPDATE SET
              commit_sha = EXCLUDED.commit_sha,
              content    = EXCLUDED.content,
              metadata   = EXCLUDED.metadata
            """
        )

        # Store all chunks without embeddings (blocking insert only)
        stored_count = 0
        for chunk in chunks:
            try:
                self.session.execute(
                    stmt,
                    {
                        "id": chunk.id,
                        "repo_id": chunk.repo_id,
                        "commit_sha": chunk.commit_sha,
                        "path": chunk.path,
                        "language": chunk.language,
                        "symbol": chunk.symbol,
                        "chunk_type": chunk.chunk_type,
                        "start_line": chunk.start_line,
                        "end_line": chunk.end_line,
                        "content": chunk.content,
                        "metadata": "{}",
                    },
                )
                stored_count += 1
            except Exception:
                # Roll back this failed insert and keep going with the rest.
                self.session.rollback()
                continue

        try:
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

    def generate_embeddings_for_chunks(self, repo_id: str, chunk_ids: list[str] | None = None) -> dict[str, list[float]]:
        """Generate embeddings for chunks in a non-blocking way.
        
        This is called separately after chunks are stored, allowing the indexing job
        to complete quickly. Embeddings are optional for lexical search.
        
        Returns: dict mapping chunk_id -> embedding_vector
        """
        generated = {}
        
        if not chunk_ids:
            # Get chunks without embeddings
            chunks = self.session.execute(
                text("SELECT id, content FROM code_chunks WHERE repo_id = :repo_id AND embedding IS NULL LIMIT 100"),
                {"repo_id": repo_id},
            ).fetchall()
        else:
            chunks = self.session.execute(
                text("SELECT id, content FROM code_chunks WHERE id IN :ids"),
                {"ids": chunk_ids},
            ).fetchall()
        
        for chunk_id, content in chunks:
            try:
                embedding_list = self.embedder.embed_text(content)
                validate_embedding_dimension(embedding_list)
                vector_literal = "[" + ",".join(f"{v:.8f}" for v in embedding_list) + "]"
                
                self.session.execute(
                    text("UPDATE code_chunks SET embedding = CAST(:embedding AS vector) WHERE id = :id"),
                    {"id": chunk_id, "embedding": vector_literal},
                )
                generated[chunk_id] = embedding_list
            except Exception:
                # Skip failed embeddings; chunk remains searchable lexically
                continue
        
        try:
            self.session.commit()
        except Exception:
            self.session.rollback()
        
        return generated
