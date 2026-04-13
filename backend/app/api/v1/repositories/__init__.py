from __future__ import annotations

import json
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_repository_access, ensure_repository_access_by_id, get_current_user
from app.core.api_response import success_response
from app.core.config import settings
from app.db.database import get_db_session, SessionLocal
from app.models.api_models import (
    AddRepositoryRequest,
    CreateProjectRequest,
    IndexRequest,
    IndexResponse,
    ProjectResponse,
    RepositoryResponse,
)
from app.services.indexing_service import IndexingService

router = APIRouter(tags=["repositories"])
logger = logging.getLogger(__name__)


def _to_payload(row: dict) -> dict:
    payload = dict(row)
    created_at = payload.get("created_at")
    if created_at is not None and hasattr(created_at, "isoformat"):
        payload["created_at"] = created_at.isoformat()

    latest_stats = payload.get("latest_index_stats")
    if isinstance(latest_stats, str):
        try:
            latest_stats = json.loads(latest_stats)
        except json.JSONDecodeError:
            latest_stats = {}
    if latest_stats is None:
        latest_stats = {}

    payload["latest_index_stats"] = latest_stats
    indexed_chunks = latest_stats.get("indexed_chunks") if isinstance(latest_stats, dict) else None
    payload["latest_indexed_chunks"] = indexed_chunks if isinstance(indexed_chunks, int) else None

    completed_stats = payload.get("latest_completed_index_stats")
    if isinstance(completed_stats, str):
        try:
            completed_stats = json.loads(completed_stats)
        except json.JSONDecodeError:
            completed_stats = {}
    if completed_stats is None:
        completed_stats = {}

    payload["latest_completed_index_stats"] = completed_stats
    completed_chunks = completed_stats.get("indexed_chunks") if isinstance(completed_stats, dict) else None
    payload["latest_completed_indexed_chunks"] = completed_chunks if isinstance(completed_chunks, int) else None

    has_completed_index = payload.get("has_completed_index")
    payload["has_completed_index"] = bool(has_completed_index)
    return payload


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> list[ProjectResponse]:
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
        {"user_id": current_user["id"]},
    ).mappings().all()
    return success_response([ProjectResponse(**_to_payload(row)).model_dump() for row in rows])


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    req: CreateProjectRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProjectResponse:
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
            "name": req.name,
            "description": req.description,
            "created_by": current_user["id"],
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
            "user_id": current_user["id"],
        },
    )
    session.commit()

    row = session.execute(
        text("SELECT id, name, description, created_by, created_at FROM projects WHERE id = :id"),
        {"id": project_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=500, detail="Project creation failed")

    return success_response(ProjectResponse(**_to_payload(row)).model_dump(), status_code=status.HTTP_201_CREATED)


@router.get("/projects/{project_id}/repositories", response_model=list[RepositoryResponse])
def list_repositories(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> list[RepositoryResponse]:
    _ensure_membership(session, project_id, current_user["id"])
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
    return success_response([RepositoryResponse(**_to_payload(row)).model_dump() for row in rows])


@router.post(
    "/projects/{project_id}/repositories",
    response_model=RepositoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_repository(
    project_id: str,
    req: AddRepositoryRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> RepositoryResponse:
    _ensure_membership(session, project_id, current_user["id"])

    repository_id = str(uuid.uuid4())
    try:
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
                "repo_id": req.repo_id,
                "remote_url": req.remote_url,
                "local_path": req.local_path,
                "default_branch": req.default_branch,
            },
        )
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Repository already exists") from None

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
    if row is None:
        raise HTTPException(status_code=500, detail="Repository creation failed")

    return success_response(
        RepositoryResponse(**_to_payload(row)).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/index", response_model=IndexResponse, status_code=status.HTTP_202_ACCEPTED)
def index_repo(
    req: IndexRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> IndexResponse:
    snapshot_id = str(uuid.uuid4())
    indexing_job_id = str(uuid.uuid4())

    if req.repository_id:
        repository_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
        effective_repo_id = str(repository_row.get("repo_id") or repository_row["id"])
    else:
        effective_repo_id = str(req.repo_id)
        repository_row = ensure_repository_access(session, effective_repo_id, current_user["id"])
    repository_db_id = repository_row["id"]
    effective_repo_path = req.repo_path or repository_row.get("local_path")
    effective_repo_url = req.repo_url or repository_row.get("remote_url")
    effective_repo_ref = req.repo_ref or repository_row.get("default_branch") or "main"

    if not effective_repo_path and not effective_repo_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Repository source missing: set local_path or remote_url on repository, or pass repo_path/repo_url in request",
        )

    if repository_db_id is not None:
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
                "commit_sha": req.commit_sha,
                "branch": effective_repo_ref,
            },
        )
        session.execute(
            text(
                """
                INSERT INTO indexing_jobs (id, repository_id, snapshot_id, status, message, started_at)
                VALUES (:id, :repository_id, :snapshot_id, 'pending', 'Indexing queued', NOW())
                """
            ),
            {
                "id": indexing_job_id,
                "repository_id": repository_db_id,
                "snapshot_id": snapshot_id,
            },
        )
        session.commit()

    def _background_index_job(
        repo_id: str,
        repo_path: str | None,
        repo_url: str | None,
        repo_ref: str | None,
        commit_sha: str,
        repository_db_id: str | None,
        snapshot_id: str | None,
        indexing_job_id: str | None,
    ) -> None:
        db = SessionLocal()
        try:
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
        except Exception as exc:
            # Reset failed transaction before issuing status updates.
            db.rollback()
            logger.exception("Indexing job failed repo_id=%s snapshot_id=%s", repo_id, snapshot_id)
            if repository_db_id is not None and indexing_job_id is not None and snapshot_id is not None:
                db.execute(
                    text(
                        """
                        UPDATE indexing_jobs
                        SET status = 'failed', message = :message, finished_at = NOW()
                        WHERE id = :id
                        """
                    ),
                    {"id": indexing_job_id, "message": str(exc)},
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
                                "error_detail": str(exc)[:300],
                            }
                        ),
                    },
                )
                db.commit()
            return
        else:
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
        finally:
            db.close()

    background_tasks.add_task(
        _background_index_job,
        effective_repo_id,
        effective_repo_path,
        effective_repo_url,
        effective_repo_ref,
        req.commit_sha,
        repository_db_id,
        snapshot_id,
        indexing_job_id,
    )

    return success_response(
        IndexResponse(indexed_chunks=0, snapshot_id=snapshot_id).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )


@router.get("/index/progress/{snapshot_id}")
def get_index_progress(
    snapshot_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Get indexing progress for a snapshot."""
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
        raise HTTPException(status_code=404, detail="Snapshot not found")

    # Timeout handling: mark long-running jobs as failed to avoid silent stuck states.
    if row["status"] == "running" and row["started_at"] is not None:
        started = row["started_at"]
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed_seconds = int((datetime.now(timezone.utc) - started).total_seconds())
        if elapsed_seconds > settings.indexing_timeout_seconds:
            session.execute(
                text(
                    """
                    UPDATE indexing_jobs
                    SET status = 'failed', message = :message, finished_at = NOW(), updated_at = NOW()
                    WHERE snapshot_id = :snapshot_id AND status = 'running'
                    """
                ),
                {
                    "snapshot_id": snapshot_id,
                    "message": "Indexing timed out",
                },
            )
            session.execute(
                text(
                    """
                    UPDATE repository_snapshots
                    SET index_status = 'failed',
                        stats = CAST(:stats AS jsonb),
                        indexed_at = NOW()
                    WHERE id = :snapshot_id
                    """
                ),
                {
                    "snapshot_id": snapshot_id,
                    "stats": json.dumps(
                        {
                            "error": "Indexing timed out",
                            "elapsed_seconds": elapsed_seconds,
                        }
                    ),
                },
            )
            session.commit()

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

    if row["status"] == "running":
        heartbeat_at = row.get("updated_at") or row["started_at"]
        if heartbeat_at is not None:
            if heartbeat_at.tzinfo is None:
                heartbeat_at = heartbeat_at.replace(tzinfo=timezone.utc)
            stalled_seconds = int((datetime.now(timezone.utc) - heartbeat_at).total_seconds())
            if stalled_seconds > settings.indexing_stall_timeout_seconds:
                session.execute(
                    text(
                        """
                        UPDATE indexing_jobs
                        SET status = 'failed', message = :message, finished_at = NOW(), updated_at = NOW()
                        WHERE snapshot_id = :snapshot_id AND status = 'running'
                        """
                    ),
                    {
                        "snapshot_id": snapshot_id,
                        "message": "Indexing stalled",
                    },
                )
                session.execute(
                    text(
                        """
                        UPDATE repository_snapshots
                        SET index_status = 'failed',
                            stats = CAST(:stats AS jsonb),
                            indexed_at = NOW()
                        WHERE id = :snapshot_id
                        """
                    ),
                    {
                        "snapshot_id": snapshot_id,
                        "stats": json.dumps(
                            {
                                "error": "Indexing stalled",
                                "stalled_seconds": stalled_seconds,
                            }
                        ),
                    },
                )
                session.commit()

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

    started_at = row["started_at"]
    if started_at is not None and hasattr(started_at, "isoformat"):
        started_at = started_at.isoformat()

    stats = row["stats"] or {}
    if isinstance(stats, str):
        try:
            stats = json.loads(stats)
        except json.JSONDecodeError:
            stats = {}
    if not isinstance(stats, dict):
        stats = {}
    total_files = int(stats.get("total_files") or 0)
    processed_files = int(stats.get("processed_files") or 0)
    percentage = int(stats.get("percentage") or 0)
    current_file = stats.get("current_file")
    eta_seconds = stats.get("eta_seconds")

    return success_response(
        {
            "snapshot_id": snapshot_id,
            "index_status": row["index_status"] or row["status"] or "pending",
            "job_status": row["status"] or "pending",
            "message": row["message"] or "Indexing in progress...",
            "stats": stats,
            "total_files": total_files,
            "processed_files": processed_files,
            "percentage": percentage,
            "current_file": current_file,
            "eta_seconds": eta_seconds,
            "started_at": started_at,
        }
    )


def _ensure_membership(session: Session, project_id: str, user_id: str) -> None:
    membership = session.execute(
        text(
            """
            SELECT id
            FROM project_memberships
            WHERE project_id = :project_id AND user_id = :user_id
            """
        ),
        {"project_id": project_id, "user_id": user_id},
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not authorized for this project")
