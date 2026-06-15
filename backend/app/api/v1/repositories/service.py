from __future__ import annotations

import json
import logging
import threading
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.repository_cache import normalize_repo_path, repository_cache_dir
from app.db.database import SessionLocal
from app.queues.indexing_queue import enqueue_indexing_job
from app.services.indexing_service import IndexingService
from app.core.exceptions import DatabaseException, ServiceException, ValidationException, DuplicateException


logger = logging.getLogger(__name__)


class IndexingAlreadyRunningError(ServiceException):
    def __init__(self, message="Indexing already in progress for this repository"):
        super().__init__(message, status_code=409, error_code="INDEXING_IN_PROGRESS")


class DuplicateCommitIndexingError(ServiceException):
    def __init__(self, message="This commit has already been indexed or is being indexed."):
        super().__init__(message, status_code=409, error_code="DUPLICATE_COMMIT")


def _is_sqlite_session(session: Session) -> bool:
    bind = getattr(session, "bind", None)
    dialect = getattr(getattr(bind, "dialect", None), "name", None)
    return bool(dialect and str(dialect).lower() == "sqlite")


def _timestamp_sql(*, sqlite: bool) -> str:
    return "CURRENT_TIMESTAMP" if sqlite else "NOW()"


def _start_local_indexing_thread(
    *,
    repo_id: str,
    repo_path: str | None,
    repo_url: str | None,
    repo_ref: str | None,
    commit_sha: str,
    repository_db_id: str,
    indexing_job_id: str,
    full_reindex: bool,
) -> None:
    worker = threading.Thread(
        target=trigger_repository_indexing_sync_wrapper,
        kwargs={
            "repo_id": repo_id,
            "repo_path": repo_path,
            "repo_url": repo_url,
            "repo_ref": repo_ref,
            "commit_sha": commit_sha,
            "repository_db_id": repository_db_id,
            "indexing_job_id": indexing_job_id,
            "full_reindex": bool(full_reindex),
        },
        daemon=True,
        name=f"indexing-{indexing_job_id[:8]}",
    )
    worker.start()


def get_repositories_for_user(
    session: Session,
    *,
    user_id: str,
    limit: int | None = None,
    offset: int = 0,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"user_id": user_id, "offset": max(0, offset)}
    pagination_sql = ""
    if limit is not None:
        params["limit"] = max(1, limit)
        pagination_sql = " LIMIT :limit OFFSET :offset"

    rows = session.execute(
        text(
            f"""
            SELECT
              r.id,
              r.owner_user_id,
              r.repo_id,
              r.remote_url,
              r.local_path,
              r.default_branch,
              r.created_at,
              (
                SELECT ij.status
                FROM indexing_jobs ij
                WHERE ij.repository_id = r.id
                ORDER BY ij.created_at DESC
                LIMIT 1
              ) AS latest_job_status,
              (
                SELECT ij.stats
                FROM indexing_jobs ij
                WHERE ij.repository_id = r.id
                ORDER BY ij.created_at DESC
                LIMIT 1
              ) AS latest_job_stats,
              (
                SELECT COUNT(*)
                FROM code_chunks cc
                WHERE cc.repository_id = r.id
              ) AS latest_indexed_chunks
            FROM repositories r
            WHERE r.owner_user_id = :user_id AND r.is_deleted = false
            ORDER BY r.created_at DESC
            {pagination_sql}
            """
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]


def add_repository_for_user(
    session: Session,
    *,
    owner_user_id: str,
    repo_id: str,
    remote_url: str | None,
    local_path: str | None,
    default_branch: str,
) -> dict[str, Any]:
    repository_id = str(uuid.uuid4())
    try:
        session.execute(
            text(
                """
                INSERT INTO repositories (id, owner_user_id, repo_id, remote_url, local_path, default_branch, retain_snapshots_mode, retain_snapshot_count)
                VALUES (:id, :owner_user_id, :repo_id, :remote_url, :local_path, :default_branch, 'LAST_N', 20)
                """
            ),
            {
                "id": repository_id,
                "owner_user_id": owner_user_id,
                "repo_id": repo_id,
                "remote_url": remote_url,
                "local_path": local_path,
                "default_branch": default_branch,
            },
        )
        session.commit()
    except Exception as exc:
        logger.exception("add_repository_for_user - database insert failed repo_id=%s owner_user_id=%s", repo_id, owner_user_id)
        session.rollback()
        raise DuplicateException("Repository", repo_id) from exc

    row = session.execute(
        text(
            """
            SELECT id, owner_user_id, repo_id, remote_url, local_path, default_branch, created_at,
                   NULL as latest_job_status,
                   NULL as latest_job_stats
            FROM repositories
            WHERE id = :id
            """
        ),
        {"id": repository_id},
    ).mappings().first()
    return dict(row) if row else {}


def queue_repository_indexing(
    session: Session,
    *,
    repository_row: dict[str, Any],
    commit_sha: str,
    repo_path: str | None = None,
    repo_url: str | None = None,
    repo_ref: str | None = None,
    source: str = "manual",
    prevent_duplicate_commit: bool = False,
    full_reindex: bool = False,
) -> dict[str, str]:
    repository_db_id = str(repository_row["id"])
    effective_repo_id = str(repository_row.get("repo_id") or repository_row["id"])
    effective_repo_path = normalize_repo_path(repo_path or repository_row.get("local_path"))
    effective_repo_url = repo_url or repository_row.get("remote_url")
    effective_repo_ref = repo_ref or repository_row.get("default_branch") or "main"
    normalized_commit = str(commit_sha or "local-working-copy").strip()[:80] or "local-working-copy"
    is_sqlite = _is_sqlite_session(session)
    timestamp_sql = _timestamp_sql(sqlite=is_sqlite)
    stats_value_sql = ":stats" if is_sqlite else "CAST(:stats AS JSONB)"

    if prevent_duplicate_commit:
        existing_commit = session.execute(
            text(
                """
                SELECT id, status
                FROM indexing_jobs
                WHERE repository_id = :repository_id
                  AND commit_sha = :commit_sha
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {
                "repository_id": repository_db_id,
                "commit_sha": normalized_commit,
            },
        ).mappings().first()
        if existing_commit and str(existing_commit.get("status") or "").lower() in {"pending", "running", "completed"}:
            raise DuplicateCommitIndexingError(
                f"Commit {normalized_commit} already has an indexing job"
            )

    active_job = session.execute(
        text(
            """
            SELECT id
            FROM indexing_jobs
            WHERE repository_id = :repository_id
              AND status IN ('pending', 'running')
            LIMIT 1
            """
        ),
        {"repository_id": repository_db_id},
    ).mappings().first()
    if active_job:
        raise IndexingAlreadyRunningError("Indexing already in progress for this repository")

    indexing_job_id = str(uuid.uuid4())
    trigger_type = "MANUAL"
    priority = 5
    if str(source).upper() in {"MANUAL", "GIT_PULL", "ACT_PATCH", "SCHEDULED"}:
        trigger_type = str(source).upper()
        if trigger_type == "ACT_PATCH":
            priority = 1
        elif trigger_type == "SCHEDULED":
            priority = 9

    errors_val_sql = ":errors" if is_sqlite else "CAST(:errors AS JSONB)"

    try:
        session.execute(
            text(
                f"""
                INSERT INTO indexing_jobs (
                    id, repository_id, status, message, commit_sha, stats, 
                    trigger_type, priority, files_indexed, files_skipped, chunks_created, errors,
                    started_at, updated_at, created_at
                )
                VALUES (
                    :id, :repository_id, 'pending', :message, :commit_sha, {stats_value_sql}, 
                    :trigger_type, :priority, 0, 0, 0, {errors_val_sql},
                    {timestamp_sql}, {timestamp_sql}, {timestamp_sql}
                )
                """
            ),
            {
                "id": indexing_job_id,
                "repository_id": repository_db_id,
                "message": f"Indexing queued ({source})",
                "commit_sha": normalized_commit,
                "stats": "{}",
                "trigger_type": trigger_type,
                "priority": priority,
                "errors": "[]",
            },
        )
        session.commit()
    except Exception as exc:
        logger.exception("queue_repository_indexing - failed to insert job record")
        session.rollback()
        raise DatabaseException("Failed to create indexing job record") from exc

    # SQLite-backed tests/dev paths run synchronously to avoid Redis worker requirements
    # and preserve deterministic behavior expected by handler-level tests.
    if is_sqlite:
        trigger_repository_indexing_sync_wrapper(
            repo_id=effective_repo_id,
            repo_path=effective_repo_path,
            repo_url=effective_repo_url,
            repo_ref=effective_repo_ref,
            commit_sha=normalized_commit,
            repository_db_id=repository_db_id,
            indexing_job_id=indexing_job_id,
            full_reindex=bool(full_reindex),
        )
        logger.info(
            "indexing_queue - sqlite inline execution repository_id=%s job_id=%s",
            repository_db_id,
            indexing_job_id,
        )
        return {
            "indexing_job_id": indexing_job_id,
        }

    # In local/dev environments, execute indexing in-process when worker infra is not
    # guaranteed to be running so progress can move beyond pending.
    if settings.indexing_local_fallback_enabled and not settings.is_production_like:
        _start_local_indexing_thread(
            repo_id=effective_repo_id,
            repo_path=effective_repo_path,
            repo_url=effective_repo_url,
            repo_ref=effective_repo_ref,
            commit_sha=normalized_commit,
            repository_db_id=repository_db_id,
            indexing_job_id=indexing_job_id,
            full_reindex=bool(full_reindex),
        )
        logger.info(
            "indexing_queue - local fallback dispatch repository_id=%s job_id=%s",
            repository_db_id,
            indexing_job_id,
        )
        return {
            "indexing_job_id": indexing_job_id,
        }

    try:
        enqueue_indexing_job(
            repo_id=effective_repo_id,
            repo_path=effective_repo_path,
            repo_url=effective_repo_url,
            repo_ref=effective_repo_ref,
            commit_sha=normalized_commit,
            repository_db_id=repository_db_id,
            indexing_job_id=indexing_job_id,
            full_reindex=bool(full_reindex),
        )
        logger.info(
            "indexing_queue - enqueued job_id=%s repository_id=%s source=%s",
            indexing_job_id,
            repository_db_id,
            source,
        )
    except Exception as exc:
        logger.exception(
            "indexing_queue - enqueue failed repository_id=%s job_id=%s detail=%s",
            repository_db_id,
            indexing_job_id,
            exc,
        )
        try:
            session.execute(
                text(
                    f"""
                    UPDATE indexing_jobs
                    SET status = 'failed', message = :message, finished_at = {timestamp_sql}, updated_at = {timestamp_sql}
                    WHERE id = :id
                    """
                ),
                {
                    "id": indexing_job_id,
                    "message": "Queue enqueue failed. Verify Redis/worker availability.",
                },
            )
            session.commit()
        except Exception as db_exc:
            logger.error("Failed to mark job as failed after enqueue error: %s", db_exc)
            session.rollback()
        raise ServiceException("Failed to enqueue indexing job") from exc

    return {
        "indexing_job_id": indexing_job_id,
    }

def trigger_repository_indexing_sync_wrapper(**kwargs):
    """Synchronous wrapper to run the async indexing task."""
    import asyncio
    try:
        asyncio.run(trigger_repository_indexing(**kwargs))
    except Exception as e:
        logger.exception("Sync wrapper caught exception from async indexing: %s", e)
        # The async function already handles logging and DB state updates on failure.
        # We just need to prevent the worker thread from crashing.
        pass

async def trigger_repository_indexing(
    repo_id: str,
    repo_path: str | None,
    repo_url: str | None,
    repo_ref: str | None,
    commit_sha: str,
    repository_db_id: str | None,
    indexing_job_id: str | None,
    full_reindex: bool = False,
) -> None:
    """Background task to run indexing."""
    try:
        from app.api.v1 import repositories as repositories_module

        session_local_factory = getattr(repositories_module, "SessionLocal", SessionLocal)
    except Exception:
        session_local_factory = SessionLocal

    db = session_local_factory()
    try:
        is_sqlite = _is_sqlite_session(db)
        timestamp_sql = _timestamp_sql(sqlite=is_sqlite)
        logger.info(
            "indexing_task - start repo_id=%s repository_id=%s job_id=%s",
            repo_id,
            repository_db_id,
            indexing_job_id,
        )
        if repository_db_id is not None and indexing_job_id is not None:
            db.execute(
                text(
                    f"""
                    UPDATE indexing_jobs SET status = 'running', message = 'Indexing started', updated_at = {timestamp_sql}
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id},
            )
            db.commit()

        total = await IndexingService(db).index_repository(
            repo_id=repo_id,
            repository_id=repository_db_id,
            repo_path=repo_path,
            repo_url=repo_url,
            repo_ref=repo_ref,
            commit_sha=commit_sha,
            indexing_job_id=indexing_job_id,
            full_reindex=bool(full_reindex),
        )

        if repository_db_id is not None and indexing_job_id is not None:
            msg = f"Indexed {total} new chunks" if total > 0 else "Index up to date (no new changes)"
            db.execute(
                text(
                    f"""
                    UPDATE indexing_jobs
                    SET status = 'completed', message = :message, finished_at = {timestamp_sql}
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id, "message": msg},
            )
            db.commit()
            logger.info(
                "indexing_task - completed repository_id=%s indexed_chunks=%s",
                repository_db_id,
                total,
            )

    except Exception as exc:
        db.rollback()
        error_message = str(exc).strip() or "Indexing failed due to an unknown error"
        logger.exception(
            "indexing_task - failed repo_id=%s detail=%s",
            repo_id,
            error_message,
        )
        if repository_db_id is not None and indexing_job_id is not None:
            try:
                db.execute(
                    text(
                        f"""
                        UPDATE indexing_jobs
                        SET status = 'failed', message = :message, finished_at = {timestamp_sql}
                        WHERE id = :id
                        """
                    ),
                    {"id": indexing_job_id, "message": error_message},
                )
                db.commit()
            except Exception as db_exc:
                logger.error("Failed to mark job as failed after task error: %s", db_exc)
                db.rollback()
    finally:
        db.close()


def get_index_job_progress(session: Session, *, indexing_job_id: str, user_id: str) -> dict[str, Any]:
    row = session.execute(
        text(
            """
            SELECT ij.id, ij.status, ij.message, ij.stats, ij.started_at, ij.updated_at, ij.repository_id
            FROM indexing_jobs ij
            JOIN repositories r ON r.id = ij.repository_id
            WHERE ij.id = :id AND r.owner_user_id = :user_id
            LIMIT 1
            """
        ),
        {"id": indexing_job_id, "user_id": user_id},
    ).mappings().first()
    if not row:
        return {}

    stats = row.get("stats") or {}
    if isinstance(stats, str):
        try:
            stats = json.loads(stats)
        except Exception:
            stats = {}
    if not isinstance(stats, dict):
        stats = {}

    started_at = row.get("started_at")
    return {
        "indexing_job_id": str(row.get("id")),
        "repository_id": str(row.get("repository_id") or ""),
        "job_status": str(row.get("status") or "pending"),
        "message": str(row.get("message") or "Indexing in progress..."),
        "stats": stats,
        "total_files": int(stats.get("total_files") or 0),
        "processed_files": int(stats.get("processed_files") or 0),
        "percentage": int(stats.get("percentage") or 0),
        "current_file": stats.get("current_file"),
        "eta_seconds": stats.get("eta_seconds"),
        "stage_timings": stats.get("stage_timings") or {},
        "current_stage": stats.get("current_stage"),
        "started_at": started_at.isoformat() if started_at else None,
    }


def get_repository_insights(session: Session, repository_id: str) -> dict[str, Any]:
    # 1. Total, indexed, skipped counts
    counts_row = session.execute(
        text(
            """
            SELECT
              COUNT(*) as total,
              SUM(CASE WHEN status = 'INDEXED' THEN 1 ELSE 0 END) as indexed,
              SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) as skipped
            FROM repository_files
            WHERE repository_id = :rid
            """
        ),
        {"rid": repository_id}
    ).mappings().first()
    
    files_total = counts_row["total"] or 0
    files_indexed = counts_row["indexed"] or 0
    files_skipped = counts_row["skipped"] or 0

    # 2. Skip reason breakdown
    skip_rows = session.execute(
        text(
            """
            SELECT skip_reason, COUNT(*) as count
            FROM repository_files
            WHERE repository_id = :rid AND status = 'SKIPPED' AND skip_reason IS NOT NULL
            GROUP BY skip_reason
            """
        ),
        {"rid": repository_id}
    ).mappings().all()
    skip_reason_breakdown = {r["skip_reason"]: r["count"] for r in skip_rows}

    # 3. Language breakdown
    lang_rows = session.execute(
        text(
            """
            SELECT language, COUNT(*) as count
            FROM repository_files
            WHERE repository_id = :rid AND status = 'INDEXED' AND language IS NOT NULL
            GROUP BY language
            """
        ),
        {"rid": repository_id}
    ).mappings().all()
    
    extension_to_language = {
        "py": "python",
        "js": "javascript",
        "ts": "typescript",
        "tsx": "typescript",
        "jsx": "javascript",
        "md": "markdown",
        "json": "json",
        "html": "html",
        "css": "css",
        "go": "go",
        "java": "java",
        "cpp": "cpp",
        "c": "c",
        "h": "c",
        "hpp": "cpp",
        "rs": "rust",
        "rb": "ruby",
        "php": "php",
        "txt": "text",
        "sh": "shell",
        "yaml": "yaml",
        "yml": "yaml",
        "toml": "toml",
        "ini": "ini",
        "sql": "sql"
    }
    language_breakdown = {}
    for r in lang_rows:
        lang_ext = r["language"].lower()
        lang_name = extension_to_language.get(lang_ext, lang_ext)
        language_breakdown[lang_name] = language_breakdown.get(lang_name, 0) + r["count"]

    # 4. Largest files
    large_rows = session.execute(
        text(
            """
            SELECT path, size_bytes
            FROM repository_files
            WHERE repository_id = :rid AND size_bytes IS NOT NULL
            ORDER BY size_bytes DESC
            LIMIT 10
            """
        ),
        {"rid": repository_id}
    ).mappings().all()
    largest_files = [{"path": r["path"], "size_bytes": r["size_bytes"]} for r in large_rows]

    # 5. Indexing health
    # Latest job
    latest_job = session.execute(
        text(
            """
            SELECT status, message, created_at
            FROM indexing_jobs
            WHERE repository_id = :rid
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"rid": repository_id}
    ).mappings().first()

    # Total failed jobs
    failed_count = session.execute(
        text(
            """
            SELECT COUNT(*) as count
            FROM indexing_jobs
            WHERE repository_id = :rid AND status = 'failed'
            """
        ),
        {"rid": repository_id}
    ).mappings().first()["count"] or 0

    # Recent error logs from all failed jobs
    recent_errors = []
    failed_jobs = session.execute(
        text(
            """
            SELECT id, message, created_at
            FROM indexing_jobs
            WHERE repository_id = :rid AND status = 'failed'
            ORDER BY created_at DESC
            LIMIT 5
            """
        ),
        {"rid": repository_id}
    ).mappings().all()
    for job in failed_jobs:
        recent_errors.append({
            "job_id": job["id"],
            "message": job["message"],
            "created_at": str(job["created_at"])
        })

    indexing_health = {
        "latest_job_status": latest_job["status"] if latest_job else None,
        "latest_job_message": latest_job["message"] if latest_job else None,
        "total_failed_jobs": failed_count,
        "recent_errors": recent_errors
    }

    # 6. Additional exact counts
    chunk_count = session.execute(
        text(
            """
            SELECT COUNT(*) as count
            FROM code_chunks
            WHERE repository_id = :rid
            """
        ),
        {"rid": repository_id}
    ).mappings().first()["count"] or 0

    snapshot_count = session.execute(
        text(
            """
            SELECT COUNT(*) as count
            FROM repository_snapshots
            WHERE repository_id = :rid
            """
        ),
        {"rid": repository_id}
    ).mappings().first()["count"] or 0

    patch_count = session.execute(
        text(
            """
            SELECT COUNT(*) as count
            FROM act_patch_drafts
            WHERE repository_id = :rid
            """
        ),
        {"rid": repository_id}
    ).mappings().first()["count"] or 0

    active_sessions = session.execute(
        text(
            """
            SELECT COUNT(*) as count
            FROM chat_sessions
            WHERE repository_id = :rid AND is_archived = FALSE
            """
        ),
        {"rid": repository_id}
    ).mappings().first()["count"] or 0

    latest_commit = session.execute(
        text(
            """
            SELECT commit_sha, created_at, finished_at
            FROM indexing_jobs
            WHERE repository_id = :rid AND status = 'completed'
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"rid": repository_id}
    ).mappings().first()

    latest_commit_sha = latest_commit["commit_sha"] if latest_commit else None
    
    indexing_duration = None
    if latest_commit and latest_commit["finished_at"] and latest_commit["created_at"]:
        duration_delta = latest_commit["finished_at"] - latest_commit["created_at"]
        indexing_duration = int(duration_delta.total_seconds())

    return {
        "files_total": files_total,
        "files_indexed": files_indexed,
        "files_skipped": files_skipped,
        "skip_reason_breakdown": skip_reason_breakdown,
        "language_breakdown": language_breakdown,
        "largest_files": largest_files,
        "indexing_health": indexing_health,
        "chunk_count": chunk_count,
        "snapshot_count": snapshot_count,
        "patch_count": patch_count,
        "active_sessions": active_sessions,
        "latest_commit": latest_commit_sha,
        "indexing_duration_seconds": indexing_duration
    }

def soft_delete_repository(session: Session, *, repository_id: str, user_id: str) -> None:
    is_sqlite = _is_sqlite_session(session)
    timestamp_sql = _timestamp_sql(sqlite=is_sqlite)
    session.execute(
        text(
            f"""
            UPDATE repositories
            SET is_deleted = true, updated_at = {timestamp_sql}
            WHERE id = :id AND owner_user_id = :user_id
            """
        ),
        {"id": repository_id, "user_id": user_id},
    )
    session.commit()
