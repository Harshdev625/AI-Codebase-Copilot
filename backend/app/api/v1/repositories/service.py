from __future__ import annotations

import json
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.queues.indexing_queue import enqueue_indexing_job
from app.services.saas_service import record_indexing_usage
from app.services.indexing_service import IndexingService

logger = logging.getLogger(__name__)


class IndexingAlreadyRunningError(RuntimeError):
    pass


class DuplicateCommitIndexingError(RuntimeError):
    def __init__(self, *, snapshot_id: str, status: str) -> None:
        super().__init__(f"Commit already indexed or queued (snapshot_id={snapshot_id}, status={status})")
        self.snapshot_id = snapshot_id
        self.status = status

def get_projects_for_user(
    session: Session,
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
            SELECT p.id, p.name, p.description, p.created_by, p.created_at
            FROM projects p
            JOIN project_memberships pm ON pm.project_id = p.id
            WHERE pm.user_id = :user_id
            ORDER BY p.created_at DESC
            {pagination_sql}
            """
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]

def create_new_project(session: Session, user_id: str, name: str, description: str | None) -> dict[str, Any]:
    project_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())

    session.execute(
        text(
            """
            INSERT INTO projects (id, name, description, created_by)
            VALUES (:id, :name, :description, :created_by)
            """
        ),
        {
            "id": project_id,
            "name": name,
            "description": description,
            "created_by": user_id,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO project_memberships (id, project_id, user_id, membership_role)
            VALUES (:id, :project_id, :user_id, 'owner')
            """
        ),
        {
            "id": membership_id,
            "project_id": project_id,
            "user_id": user_id,
        },
    )
    session.commit()

    row = session.execute(
        text("SELECT id, name, description, created_by, created_at FROM projects WHERE id = :id"),
        {"id": project_id},
    ).mappings().first()
    return dict(row) if row else {}

def get_repositories_for_project(
    session: Session,
    project_id: str,
    limit: int | None = None,
    offset: int = 0,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"project_id": project_id, "offset": max(0, offset)}
    pagination_sql = ""
    if limit is not None:
        params["limit"] = max(1, limit)
        pagination_sql = " LIMIT :limit OFFSET :offset"

    rows = session.execute(
        text(
            f"""
            SELECT
                r.id,
                r.project_id,
                r.repo_id,
                r.remote_url,
                r.local_path,
                r.default_branch,
                r.created_at,
                (
                    SELECT rs.id
                    FROM repository_snapshots rs
                    WHERE rs.repository_id = r.id
                    ORDER BY rs.created_at DESC
                    LIMIT 1
                ) AS latest_snapshot_id,
                (
                    SELECT rs.index_status
                    FROM repository_snapshots rs
                    WHERE rs.repository_id = r.id
                    ORDER BY rs.created_at DESC
                    LIMIT 1
                ) AS latest_index_status,
                (
                    SELECT rs.stats
                    FROM repository_snapshots rs
                    WHERE rs.repository_id = r.id
                    ORDER BY rs.created_at DESC
                    LIMIT 1
                ) AS latest_index_stats,
                EXISTS (
                    SELECT 1
                    FROM repository_snapshots rs
                    WHERE rs.repository_id = r.id
                        AND rs.index_status = 'completed'
                ) AS has_completed_index,
                (
                    SELECT rs.stats
                    FROM repository_snapshots rs
                    WHERE rs.repository_id = r.id
                        AND rs.index_status = 'completed'
                    ORDER BY rs.created_at DESC
                    LIMIT 1
                ) AS latest_completed_index_stats
            FROM repositories r
            WHERE r.project_id = :project_id
            ORDER BY created_at DESC
            {pagination_sql}
            """
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]

def add_repository_to_project(
    session: Session, 
    project_id: str, 
    repo_id: str, 
    remote_url: str | None, 
    local_path: str | None, 
    default_branch: str
) -> dict[str, Any]:
    repository_id = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO repositories (id, project_id, repo_id, remote_url, local_path, default_branch)
            VALUES (:id, :project_id, :repo_id, :remote_url, :local_path, :default_branch)
            """
        ),
        {
            "id": repository_id,
            "project_id": project_id,
            "repo_id": repo_id,
            "remote_url": remote_url,
            "local_path": local_path,
            "default_branch": default_branch,
        },
    )
    session.commit()

    row = session.execute(
        text(
            """
            SELECT id, project_id, repo_id, remote_url, local_path, default_branch, created_at,
                   NULL as latest_snapshot_id,
                   NULL as latest_index_status,
                   NULL as latest_index_stats,
                   FALSE as has_completed_index,
                   NULL as latest_completed_index_stats
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
    initiated_by_user_id: str | None = None,
) -> dict[str, str]:
    repository_db_id = str(repository_row["id"])
    effective_repo_id = str(repository_row.get("repo_id") or repository_row["id"])
    effective_repo_path = repo_path or repository_row.get("local_path")
    effective_repo_url = repo_url or repository_row.get("remote_url")
    effective_repo_ref = repo_ref or repository_row.get("default_branch") or "main"
    normalized_commit = str(commit_sha or "local-working-copy").strip()[:80] or "local-working-copy"

    lock_sql = "SELECT id FROM repositories WHERE id = :repository_id"
    bind = getattr(session, "bind", None)
    dialect = getattr(getattr(bind, "dialect", None), "name", None)
    is_sqlite = bool(dialect and str(dialect).lower() == "sqlite")
    if dialect and str(dialect).lower() != "sqlite":
        lock_sql += " FOR UPDATE"
    session.execute(text(lock_sql), {"repository_id": repository_db_id})

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

    if prevent_duplicate_commit:
        duplicate_commit = session.execute(
            text(
                """
                SELECT rs.id AS snapshot_id, ij.status AS job_status
                FROM repository_snapshots rs
                JOIN indexing_jobs ij ON ij.snapshot_id = rs.id
                WHERE rs.repository_id = :repository_id
                  AND rs.commit_sha = :commit_sha
                  AND ij.status IN ('pending', 'running', 'completed')
                ORDER BY COALESCE(ij.updated_at, ij.started_at) DESC
                LIMIT 1
                """
            ),
            {"repository_id": repository_db_id, "commit_sha": normalized_commit},
        ).mappings().first()
        if duplicate_commit:
            raise DuplicateCommitIndexingError(
                snapshot_id=str(duplicate_commit["snapshot_id"]),
                status=str(duplicate_commit["job_status"]),
            )

    snapshot_id = str(uuid.uuid4())
    indexing_job_id = str(uuid.uuid4())
    supports_initiator_column = True
    try:
        session.execute(text("SELECT initiated_by_user_id FROM indexing_jobs LIMIT 1"))
    except Exception as exc:
        message = str(exc).lower()
        if "initiated_by_user_id" in message and (
            "no such column" in message or "has no column named" in message
        ):
            supports_initiator_column = False
        else:
            raise

    session.execute(
        text(
            """
            INSERT INTO repository_snapshots (id, repository_id, commit_sha, branch, index_status)
            VALUES (:id, :repository_id, :commit_sha, :branch, 'pending')
            """
        ),
        {
            "id": snapshot_id,
            "repository_id": repository_db_id,
            "commit_sha": normalized_commit,
            "branch": effective_repo_ref,
        },
    )
    if supports_initiator_column:
        session.execute(
            text(
                """
                INSERT INTO indexing_jobs (id, repository_id, snapshot_id, initiated_by_user_id, status, message, started_at)
                VALUES (:id, :repository_id, :snapshot_id, :initiated_by_user_id, 'pending', :message, NOW())
                """
            ),
            {
                "id": indexing_job_id,
                "repository_id": repository_db_id,
                "snapshot_id": snapshot_id,
                "initiated_by_user_id": initiated_by_user_id,
                "message": f"Indexing queued ({source})",
            },
        )
    else:
        session.execute(
            text(
                """
                INSERT INTO indexing_jobs (id, repository_id, snapshot_id, status, message, started_at)
                VALUES (:id, :repository_id, :snapshot_id, 'pending', :message, NOW())
                """
            ),
            {
                "id": indexing_job_id,
                "repository_id": repository_db_id,
                "snapshot_id": snapshot_id,
                "message": f"Indexing queued ({source})",
            },
        )
    session.commit()

    # SQLite-backed tests/dev paths run synchronously to avoid Redis worker requirements
    # and preserve deterministic behavior expected by handler-level tests.
    if is_sqlite:
        trigger_repository_indexing(
            repo_id=effective_repo_id,
            repo_path=effective_repo_path,
            repo_url=effective_repo_url,
            repo_ref=effective_repo_ref,
            commit_sha=normalized_commit,
            repository_db_id=repository_db_id,
            snapshot_id=snapshot_id,
            indexing_job_id=indexing_job_id,
            full_reindex=bool(full_reindex),
        )
        logger.info(
            "indexing_queue - sqlite inline execution repository_id=%s snapshot_id=%s",
            repository_db_id,
            snapshot_id,
        )
        return {
            "snapshot_id": snapshot_id,
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
            snapshot_id=snapshot_id,
            indexing_job_id=indexing_job_id,
            full_reindex=bool(full_reindex),
        )
        logger.info(
            "indexing_queue - enqueued job_id=%s repository_id=%s snapshot_id=%s source=%s",
            indexing_job_id,
            repository_db_id,
            snapshot_id,
            source,
        )
    except Exception as exc:
        logger.exception(
            "indexing_queue - enqueue failed repository_id=%s snapshot_id=%s detail=%s",
            repository_db_id,
            snapshot_id,
            exc,
        )
        session.execute(
            text(
                """
                UPDATE indexing_jobs
                SET status = 'failed', message = :message, finished_at = NOW(), updated_at = NOW()
                WHERE id = :id
                """
            ),
            {
                "id": indexing_job_id,
                "message": "Queue enqueue failed. Verify Redis/worker availability.",
            },
        )
        session.execute(
            text(
                """
                UPDATE repository_snapshots
                SET index_status = 'failed', stats = CAST(:stats AS jsonb), indexed_at = NOW()
                WHERE id = :id
                """
            ),
            {
                "id": snapshot_id,
                "stats": json.dumps({"error": "Queue enqueue failed"}),
            },
        )
        session.commit()
        raise

    return {
        "snapshot_id": snapshot_id,
        "indexing_job_id": indexing_job_id,
    }

def trigger_repository_indexing(
    repo_id: str,
    repo_path: str | None,
    repo_url: str | None,
    repo_ref: str | None,
    commit_sha: str,
    repository_db_id: str | None,
    snapshot_id: str | None,
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
        logger.info(
            "indexing_task - start repo_id=%s repository_id=%s snapshot_id=%s job_id=%s",
            repo_id,
            repository_db_id,
            snapshot_id,
            indexing_job_id,
        )
        if repository_db_id is not None and indexing_job_id is not None and snapshot_id is not None:
            db.execute(
                text(
                    """
                    UPDATE indexing_jobs SET status = 'running', message = 'Indexing started', updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id},
            )
            db.execute(
                text("UPDATE repository_snapshots SET index_status = 'running' WHERE id = :id"),
                {"id": snapshot_id},
            )
            db.commit()

            try:
                usage_owner = db.execute(
                    text(
                        """
                        SELECT
                          COALESCE(ij.initiated_by_user_id, p.created_by) AS user_id,
                          r.project_id,
                                                    CASE
                                                        WHEN (rs.stats->>'total_files') ~ '^[0-9]+$' THEN (rs.stats->>'total_files')::int
                                                        ELSE 0
                                                    END AS total_files
                        FROM indexing_jobs ij
                        JOIN repositories r ON r.id = ij.repository_id
                        JOIN projects p ON p.id = r.project_id
                        LEFT JOIN repository_snapshots rs ON rs.id = ij.snapshot_id
                        WHERE ij.id = :job_id
                        LIMIT 1
                        """
                    ),
                    {"job_id": indexing_job_id},
                ).mappings().first()
                if usage_owner and usage_owner.get("user_id"):
                    record_indexing_usage(
                        db,
                        user_id=str(usage_owner.get("user_id")),
                        project_id=str(usage_owner.get("project_id")) if usage_owner.get("project_id") else None,
                        indexed_chunks=int(total),
                        files_processed=int(usage_owner.get("total_files") or 0),
                    )
            except Exception:
                db.rollback()
                logger.exception(
                    "indexing_task - usage tracking failed repository_id=%s snapshot_id=%s",
                    repository_db_id,
                    snapshot_id,
                )

        total = IndexingService(db).index_repository(
            repo_id=repo_id,
            repository_id=repository_db_id,
            repo_path=repo_path,
            repo_url=repo_url,
            repo_ref=repo_ref,
            commit_sha=commit_sha,
            indexing_job_id=indexing_job_id,
            snapshot_id=snapshot_id,
            full_reindex=bool(full_reindex),
        )
        
        if repository_db_id is not None and indexing_job_id is not None and snapshot_id is not None:
            db.execute(
                text(
                    """
                    UPDATE indexing_jobs
                    SET status = 'completed', message = :message, finished_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id, "message": f"Indexed {total} chunks"},
            )
            db.execute(
                text(
                    """
                    UPDATE repository_snapshots
                    SET index_status = 'completed', stats = CAST(:stats AS jsonb), indexed_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": snapshot_id, "stats": json.dumps({"indexed_chunks": total})},
            )
            db.commit()
            logger.info(
                "indexing_task - completed repository_id=%s snapshot_id=%s indexed_chunks=%s",
                repository_db_id,
                snapshot_id,
                total,
            )

    except Exception as exc:
        db.rollback()
        error_message = str(exc).strip() or "Indexing failed due to an unknown error"
        logger.exception(
            "indexing_task - failed repo_id=%s snapshot_id=%s detail=%s",
            repo_id,
            snapshot_id,
            error_message,
        )
        if repository_db_id is not None and indexing_job_id is not None and snapshot_id is not None:
            db.execute(
                text(
                    """
                    UPDATE indexing_jobs
                    SET status = 'failed', message = :message, finished_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id, "message": error_message},
            )
            db.execute(
                text(
                    """
                    UPDATE repository_snapshots
                    SET index_status = 'failed',
                        stats = CAST(:stats AS jsonb),
                        indexed_at = NOW()
                    WHERE id = :id
                    """
                ),
                {
                    "id": snapshot_id,
                    "stats": json.dumps(
                        {
                            "error": "Indexing failed",
                            "error_detail": error_message[:300],
                        }
                    ),
                },
            )
            db.commit()
    finally:
        db.close()

def check_indexing_timeout_and_stalls(session: Session, snapshot_id: str) -> dict[str, Any]:
    """Check for hung indexing jobs and mark them as failed if they exceed timeouts."""
    refreshed = False
    row = session.execute(
        text(
            """
            SELECT rs.id, rs.index_status, rs.stats, ij.message, ij.status, ij.started_at, ij.updated_at
            FROM repository_snapshots rs
            LEFT JOIN indexing_jobs ij ON rs.id = ij.snapshot_id
            WHERE rs.id = :snapshot_id
            """
        ),
        {"snapshot_id": snapshot_id},
    ).mappings().first()

    if not row:
        return {}

    # Timeout handling
    if row["status"] == "running" and row["started_at"] is not None:
        started = row["started_at"]
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed_seconds = int((datetime.now(timezone.utc) - started).total_seconds())
        if elapsed_seconds > settings.indexing_timeout_seconds:
            logger.error("indexing_audit - timeout snapshot_id=%s elapsed_seconds=%s", snapshot_id, elapsed_seconds)
            session.execute(
                text(
                    """
                    UPDATE indexing_jobs
                    SET status = 'failed', message = :message, finished_at = NOW(), updated_at = NOW()
                    WHERE snapshot_id = :snapshot_id AND status = 'running'
                    """
                ),
                {"snapshot_id": snapshot_id, "message": "Indexing timed out"},
            )
            session.execute(
                text(
                    """
                    UPDATE repository_snapshots
                    SET index_status = 'failed', stats = CAST(:stats AS jsonb), indexed_at = NOW()
                    WHERE id = :snapshot_id
                    """
                ),
                {
                    "snapshot_id": snapshot_id,
                    "stats": json.dumps({"error": "Indexing timed out", "elapsed_seconds": elapsed_seconds}),
                },
            )
            session.commit()
            refreshed = True
            
    # Stall handling
    elif row["status"] == "running":
        heartbeat_at = row.get("updated_at") or row["started_at"]
        if heartbeat_at is not None:
            if heartbeat_at.tzinfo is None:
                heartbeat_at = heartbeat_at.replace(tzinfo=timezone.utc)
            stalled_seconds = int((datetime.now(timezone.utc) - heartbeat_at).total_seconds())
            if stalled_seconds > settings.indexing_stall_timeout_seconds:
                logger.error("indexing_audit - stalled snapshot_id=%s stalled_seconds=%s", snapshot_id, stalled_seconds)
                session.execute(
                    text(
                        """
                        UPDATE indexing_jobs
                        SET status = 'failed', message = :message, finished_at = NOW(), updated_at = NOW()
                        WHERE snapshot_id = :snapshot_id AND status = 'running'
                        """
                    ),
                    {"snapshot_id": snapshot_id, "message": "Indexing stalled"},
                )
                session.execute(
                    text(
                        """
                        UPDATE repository_snapshots
                        SET index_status = 'failed', stats = CAST(:stats AS jsonb), indexed_at = NOW()
                        WHERE id = :snapshot_id
                        """
                    ),
                    {
                        "snapshot_id": snapshot_id,
                        "stats": json.dumps({"error": "Indexing stalled", "stalled_seconds": stalled_seconds}),
                    },
                )
                session.commit()
                refreshed = True

    # Refresh row after potential updates
    if refreshed:
        row = session.execute(
            text(
                """
                SELECT rs.id, rs.index_status, rs.stats, ij.message, ij.status, ij.started_at, ij.updated_at
                FROM repository_snapshots rs
                LEFT JOIN indexing_jobs ij ON rs.id = ij.snapshot_id
                WHERE rs.id = :snapshot_id
                """
            ),
            {"snapshot_id": snapshot_id},
        ).mappings().first()

    return dict(row) if row else {}
