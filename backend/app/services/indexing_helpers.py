"""
indexing_helpers.py
--------------------
Phase 1 helper methods extracted for clean import into IndexingService.
Provides file-record persistence and snapshot creation.
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from pathlib import Path
from pathspec import PathSpec

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.utils import is_sqlite_session

logger = logging.getLogger(__name__)

GENERATED_PATTERNS: set[str] = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
    "Cargo.lock", "Gemfile.lock", "composer.lock", "go.sum",
}
GENERATED_DIRS: set[str] = {
    "dist", "build", "node_modules", ".venv", "venv",
    "__pycache__", "vendor", "assets",
}


def is_generated_file(file_path: Path, repo_root: Path) -> bool:
    parts = file_path.relative_to(repo_root).parts
    if any(part.lower() in GENERATED_DIRS for part in parts[:-1]):
        return True
    name_lower = file_path.name.lower()
    return (
        name_lower in GENERATED_PATTERNS
        or name_lower.endswith(".min.js")
        or name_lower.endswith(".min.css")
    )


def estimate_tokens(content: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(content) // 4)


async def upsert_file_records(
    session: Session,
    *,
    repository_id: str,
    repo_root: Path,
    commit_sha: str,
    file_list: list[Path],
    ignore_spec: PathSpec | None = None,
    force_rechunk: bool = False,
) -> tuple[int, list[Path], list[str]]:
    """
    Persist a row in repository_files for every discovered file.
    Uses INSERT ... ON CONFLICT DO UPDATE so repeated indexing is idempotent.
    Commits in batches of 500 rows.

    Returns the number of rows upserted, a list of files that need chunking, and a list of deleted relative paths.
    """
    is_sqlite = is_sqlite_session(session)
    ts_sql = "CURRENT_TIMESTAMP" if is_sqlite else "NOW()"
    BATCH_SIZE = 500
    upserted = 0

    files_to_chunk: list[Path] = []
    deleted_paths: list[str] = []
    
    # Pre-fetch existing hashes for incremental logic
    existing_hashes: dict[str, str] = {}
    existing_paths: set[str] = set()
    try:
        rows = session.execute(
            text("SELECT path, hash FROM repository_files WHERE repository_id = :rid AND status != 'DELETED'"),
            {"rid": repository_id}
        ).mappings().all()
        for r in rows:
            existing_hashes[r["path"]] = r["hash"]
            existing_paths.add(r["path"])
    except Exception:
        logger.warning("index_file_records - failed to pre-fetch hashes")

    from app.core.config import settings
    MAX_SIZE = settings.max_index_file_size_bytes

    SUPPORTED_SUFFIXES = {
        ".py", ".ts", ".js", ".tsx", ".jsx", ".md", ".json", 
        ".html", ".css", ".go", ".java", ".cpp", ".c", ".h", 
        ".hpp", ".rs", ".rb", ".php", ".txt", ".sh", ".yaml", ".yml",
        ".toml", ".ini", ".sql"
    }

    for batch_start in range(0, len(file_list), BATCH_SIZE):
        batch = file_list[batch_start: batch_start + BATCH_SIZE]
        for fp in batch:
            try:
                rel = fp.relative_to(repo_root).as_posix()
                extension = fp.suffix.lower() or None
                language = fp.suffix.lstrip(".").lower() or None
                file_id = str(uuid.uuid5(uuid.NAMESPACE_OID, f"{repository_id}|{rel}"))

                size_bytes: int | None = None
                line_count: int | None = None
                token_count: int | None = None
                content_hash: str | None = None
                
                skip_reason: str | None = None
                status = "INDEXED"

                try:
                    size_bytes = fp.stat().st_size
                except Exception:
                    pass

                # Classification rules in exact priority order
                name_lower = fp.name.lower()
                if ignore_spec and ignore_spec.match_file(rel):
                    skip_reason = "IGNORED_PATTERN"
                elif size_bytes == 0:
                    skip_reason = "EMPTY_FILE"
                elif (
                    name_lower in {".env", "secrets.yml", "private.key"}
                    or name_lower.endswith(".key")
                    or "secret" in name_lower
                ):
                    skip_reason = "SECRET_FILE"
                elif size_bytes is not None and size_bytes > MAX_SIZE:
                    skip_reason = "FILE_TOO_LARGE"
                elif extension in {".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp"}:
                    skip_reason = "IMAGE_FILE"
                elif extension in {".exe", ".dll", ".so", ".dylib", ".bin", ".pdf", ".zip", ".tar", ".gz"}:
                    skip_reason = "BINARY_FILE"
                elif extension not in SUPPORTED_SUFFIXES:
                    skip_reason = "UNSUPPORTED_EXTENSION"
                elif is_generated_file(fp, repo_root):
                    if extension in {".min.js", ".min.css", ".map"}:
                        skip_reason = "MINIFIED_FILE"
                    else:
                        skip_reason = "GENERATED_FILE"

                # If not skipped by metadata, read content and hash
                if skip_reason is None:
                    try:
                        raw = fp.read_text(encoding="utf-8", errors="ignore")
                        line_count = raw.count("\n") + 1
                        token_count = estimate_tokens(raw)
                        content_hash = hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()
                    except Exception:
                        skip_reason = "UNREADABLE_FILE"

                if skip_reason is not None:
                    status = "SKIPPED"
                
                # Incremental Check: If hash matches, we don't need to re-chunk
                needs_chunking = False
                if status == "INDEXED" and content_hash:
                    if force_rechunk:
                        needs_chunking = True
                    else:
                        old_hash = existing_hashes.get(rel)
                        if old_hash != content_hash:
                            needs_chunking = True
                
                if needs_chunking:
                    files_to_chunk.append(fp)

                session.execute(
                    text(
                        f"""
                        INSERT INTO repository_files
                          (id, repository_id, path, type, extension, language,
                           size_bytes, line_count, token_count, hash,
                           is_generated, status, skip_reason,
                           last_indexed_commit, created_at, updated_at)
                        VALUES
                          (:id, :repository_id, :path, 'FILE', :extension, :language,
                           :size_bytes, :line_count, :token_count, :hash,
                           :is_generated, :status, :skip_reason,
                           :commit_sha, {ts_sql}, {ts_sql})
                        ON CONFLICT (repository_id, path) DO UPDATE SET
                          extension           = EXCLUDED.extension,
                          language            = EXCLUDED.language,
                          size_bytes          = EXCLUDED.size_bytes,
                          line_count          = EXCLUDED.line_count,
                          token_count         = EXCLUDED.token_count,
                          hash                = EXCLUDED.hash,
                          is_generated        = EXCLUDED.is_generated,
                          status              = EXCLUDED.status,
                          skip_reason         = EXCLUDED.skip_reason,
                          last_indexed_commit = EXCLUDED.last_indexed_commit,
                          updated_at          = {ts_sql}
                        """
                    ),
                    {
                        "id": file_id,
                        "repository_id": repository_id,
                        "path": rel,
                        "extension": extension,
                        "language": language,
                        "size_bytes": size_bytes,
                        "line_count": line_count,
                        "token_count": token_count,
                        "hash": content_hash,
                        "is_generated": (skip_reason in {"GENERATED_FILE", "MINIFIED_FILE"}),
                        "status": status,
                        "skip_reason": skip_reason,
                        "commit_sha": commit_sha,
                    },
                )
                upserted += 1
            except Exception as exc:
                logger.warning(
                    "index_file_records - failed to upsert path=%s error=%s", fp, exc
                )

        try:
            session.commit()
        except Exception as exc:
            session.rollback()
            logger.error(
                "index_file_records - batch commit failed offset=%s error=%s",
                batch_start,
                exc,
            )

    current_paths = {fp.relative_to(repo_root).as_posix() for fp in file_list}
    deleted_paths = list(existing_paths - current_paths)
    
    if deleted_paths:
        try:
            for i in range(0, len(deleted_paths), BATCH_SIZE):
                batch_deleted = deleted_paths[i: i + BATCH_SIZE]
                session.execute(
                    text(
                        f"""
                        UPDATE repository_files
                        SET status = 'DELETED', updated_at = {ts_sql}
                        WHERE repository_id = :rid AND path IN :paths
                        """
                    ),
                    {"rid": repository_id, "paths": tuple(batch_deleted)}
                )
            session.commit()
        except Exception as exc:
            session.rollback()
            logger.warning("index_file_records - failed to mark files as DELETED error=%s", exc)

    logger.info(
        "index_file_records - complete repository_id=%s upserted=%s files_to_chunk=%s deleted=%s",
        repository_id,
        upserted,
        len(files_to_chunk),
        len(deleted_paths)
    )
    return upserted, files_to_chunk, deleted_paths


async def create_snapshot(
    session: Session,
    *,
    repository_id: str,
    commit_sha: str,
    files_count: int,
    files_skipped: int,
    chunks_count: int,
) -> str | None:
    """
    Create an immutable RepositorySnapshot row and its snapshot_files inventory.
    Also updates repositories.latest_indexed_commit.
    Non-fatal — a failure here does not abort the index run.
    """
    is_sqlite = is_sqlite_session(session)
    ts_sql = "CURRENT_TIMESTAMP" if is_sqlite else "NOW()"
    snapshot_id = str(uuid.uuid5(uuid.NAMESPACE_OID, f"{repository_id}|{commit_sha}"))
    try:
        # Check if snapshot already exists
        exists = session.execute(
            text("SELECT id FROM repository_snapshots WHERE repository_id = :rid AND commit_sha = :sha"),
            {"rid": repository_id, "sha": commit_sha}
        ).scalar()
        if exists:
            return exists

        session.execute(
            text(
                f"""
                INSERT INTO repository_snapshots
                  (id, repository_id, commit_sha, indexed_at,
                   files_count, chunks_count, files_skipped,
                   is_pinned, is_release, status, index_status, indexer_version, last_indexed_at)
                VALUES
                  (:id, :repository_id, :commit_sha, {ts_sql},
                   :files_count, :chunks_count, :files_skipped,
                   FALSE, FALSE, 'ACTIVE', 'COMPLETE', '1.0.0', {ts_sql})
                ON CONFLICT (repository_id, commit_sha) DO NOTHING
                """
            ),
            {
                "id": snapshot_id,
                "repository_id": repository_id,
                "commit_sha": commit_sha,
                "files_count": files_count,
                "chunks_count": chunks_count,
                "files_skipped": files_skipped,
            },
        )
        
        # Populate snapshot_files inventory
        files = session.execute(
            text(
                """
                SELECT path, hash, size_bytes, type, language, line_count
                FROM repository_files
                WHERE repository_id = :repository_id
                """
            ),
            {"repository_id": repository_id}
        ).mappings().all()

        if files:
            insert_data = []
            for f in files:
                content_hash = f["hash"]
                if not content_hash:
                    continue
                insert_data.append({
                    "snapshot_id": snapshot_id,
                    "path": f["path"],
                    "content_hash": content_hash,
                    "size_bytes": f["size_bytes"],
                    "file_type": f["type"] or "FILE",
                    "language": f["language"],
                    "line_count": f["line_count"]
                })
            
            if insert_data:
                session.execute(
                    text(
                        """
                        INSERT INTO snapshot_files
                          (snapshot_id, path, content_hash, size_bytes, file_type, language, line_count)
                        VALUES
                          (:snapshot_id, :path, :content_hash, :size_bytes, :file_type, :language, :line_count)
                        """
                    ),
                    insert_data
                )

        session.execute(
            text(
                f"""
                UPDATE repositories
                SET latest_indexed_commit = :commit_sha,
                    updated_at = {ts_sql}
                WHERE id = :repository_id
                """
            ),
            {"commit_sha": commit_sha, "repository_id": repository_id},
        )
        session.commit()
        logger.info(
            "index_snapshot - created repository_id=%s commit_sha=%s files=%s chunks=%s",
            repository_id,
            commit_sha,
            files_count,
            chunks_count,
        )
        return snapshot_id
    except Exception as exc:
        session.rollback()
        logger.exception("index_snapshot - failed to record snapshot")
        return None
