from __future__ import annotations

import json
import logging
import threading
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
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
              ) AS latest_job_stats
            FROM repositories r
            WHERE r.owner_user_id = :user_id
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
                INSERT INTO repositories (id, owner_user_id, repo_id, remote_url, local_path, default_branch)
                VALUES (:id, :owner_user_id, :repo_id, :remote_url, :local_path, :default_branch)
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
    effective_repo_path = repo_path or repository_row.get("local_path")
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
    try:
        session.execute(
            text(
                f"""
                INSERT INTO indexing_jobs (id, repository_id, status, message, commit_sha, stats, started_at, updated_at, created_at)
                VALUES (:id, :repository_id, 'pending', :message, :commit_sha, {stats_value_sql}, {timestamp_sql}, {timestamp_sql}, {timestamp_sql})
                """
            ),
            {
                "id": indexing_job_id,
                "repository_id": repository_db_id,
                "message": f"Indexing queued ({source})",
                "commit_sha": normalized_commit,
                "stats": "{}",
            },
        )
        session.commit()
    except Exception as exc:
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
            db.execute(
                text(
                    f"""
                    UPDATE indexing_jobs
                    SET status = 'completed', message = :message, finished_at = {timestamp_sql}
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id, "message": f"Indexed {total} chunks"},
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

    return {
        "indexing_job_id": str(row.get("id")),
        "job_status": str(row.get("status") or "pending"),
        "message": str(row.get("message") or "Indexing in progress..."),
        "stats": stats,
        "total_files": int(stats.get("total_files") or 0),
        "processed_files": int(stats.get("processed_files") or 0),
        "percentage": int(stats.get("percentage") or 0),
        "current_file": stats.get("current_file"),
        "eta_seconds": stats.get("eta_seconds"),
    }
