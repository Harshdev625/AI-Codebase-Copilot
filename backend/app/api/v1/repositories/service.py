from __future__ import annotations

import json
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.services.indexing_service import IndexingService
from app.core.config import settings

logger = logging.getLogger(__name__)

def get_projects_for_user(session: Session, user_id: str) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            """
            SELECT p.id, p.name, p.description, p.created_by, p.created_at
            FROM projects p
            JOIN project_memberships pm ON pm.project_id = p.id
            WHERE pm.user_id = :user_id
            ORDER BY p.created_at DESC
            """
        ),
        {"user_id": user_id},
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

def get_repositories_for_project(session: Session, project_id: str) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            """
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
            """
        ),
        {"project_id": project_id},
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
            SELECT id, project_id, repo_id, remote_url, local_path, default_branch, created_at
            FROM repositories
            WHERE id = :id
            """
        ),
        {"id": repository_id},
    ).mappings().first()
    return dict(row) if row else {}

def trigger_repository_indexing(
    repo_id: str,
    repo_path: str | None,
    repo_url: str | None,
    repo_ref: str | None,
    commit_sha: str,
    repository_db_id: str | None,
    snapshot_id: str | None,
    indexing_job_id: str | None,
) -> None:
    """Background task to run indexing."""
    db = SessionLocal()
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

        total = IndexingService(db).index_repository(
            repo_id=repo_id,
            repository_id=repository_db_id,
            repo_path=repo_path,
            repo_url=repo_url,
            repo_ref=repo_ref,
            commit_sha=commit_sha,
            indexing_job_id=indexing_job_id,
            snapshot_id=snapshot_id,
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

    # Refresh row after potential updates
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
