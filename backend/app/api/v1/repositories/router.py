from __future__ import annotations

import json
import uuid
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_repository_access, ensure_repository_access_by_id, get_current_user
from app.core.api_response import success_response
from app.db.database import get_db_session
from app.models.api_models import (
    AddRepositoryRequest,
    CreateProjectRequest,
    IndexRequest,
    IndexResponse,
    ProjectResponse,
    RepositoryResponse,
)
from . import service

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

    payload["has_completed_index"] = bool(payload.get("has_completed_index"))
    return payload

@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> list[ProjectResponse]:
    logger.info("projects_list - request user_id=%s", current_user["id"])
    projects = service.get_projects_for_user(session, current_user["id"])
    payload = [ProjectResponse(**_to_payload(p)).model_dump() for p in projects]
    return success_response(payload)

@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    req: CreateProjectRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProjectResponse:
    logger.info("projects_create - request user_id=%s name=%s", current_user["id"], req.name)
    project = service.create_new_project(session, current_user["id"], req.name, req.description)
    return success_response(ProjectResponse(**_to_payload(project)).model_dump(), status_code=status.HTTP_201_CREATED)

@router.get("/projects/{project_id}/repositories", response_model=list[RepositoryResponse])
def list_repositories(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> list[RepositoryResponse]:
    logger.info("repositories_list - request project_id=%s", project_id)
    service_membership_check(session, project_id, current_user["id"])
    repos = service.get_repositories_for_project(session, project_id)
    payload = [RepositoryResponse(**_to_payload(r)).model_dump() for r in repos]
    return success_response(payload)

@router.post("/projects/{project_id}/repositories", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
def add_repository(
    project_id: str,
    req: AddRepositoryRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> RepositoryResponse:
    logger.info("repository_add - request project_id=%s repo_id=%s", project_id, req.repo_id)
    service_membership_check(session, project_id, current_user["id"])
    try:
        repo = service.add_repository_to_project(
            session, project_id, req.repo_id, req.remote_url, req.local_path, req.default_branch
        )
        return success_response(RepositoryResponse(**_to_payload(repo)).model_dump(), status_code=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error("repository_add - failure: %s", e)
        raise HTTPException(status_code=409, detail="Repository already exists or creation failed")

@router.post("/index", response_model=IndexResponse, status_code=status.HTTP_202_ACCEPTED)
def index_repo(
    req: IndexRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> IndexResponse:
    logger.info("index_start - request repository_id=%s", req.repository_id)
    snapshot_id = str(uuid.uuid4())
    indexing_job_id = str(uuid.uuid4())

    if req.repository_id:
        repository_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repository_row = ensure_repository_access(session, req.repo_id, current_user["id"])
    
    repository_db_id = repository_row["id"]
    effective_repo_id = repository_row.get("repo_id") or repository_row["id"]
    effective_repo_path = req.repo_path or repository_row.get("local_path")
    effective_repo_url = req.repo_url or repository_row.get("remote_url")
    effective_repo_ref = req.repo_ref or repository_row.get("default_branch") or "main"

    # Robust duplicate prevention with FOR UPDATE
    lock_sql = "SELECT id FROM repositories WHERE id = :repository_id"
    bind = getattr(session, "bind", None)
    dialect = getattr(getattr(bind, "dialect", None), "name", None)
    if dialect and str(dialect).lower() != "sqlite":
        lock_sql += " FOR UPDATE"
    session.execute(text(lock_sql), {"repository_id": repository_db_id})

    active_job = session.execute(
        text(
            """
            SELECT id FROM indexing_jobs
            WHERE repository_id = :repository_id
              AND status IN ('pending', 'running')
            LIMIT 1
            """
        ),
        {"repository_id": repository_db_id},
    ).mappings().first()

    if active_job:
        raise HTTPException(status_code=409, detail="Indexing already in progress for this repository")

    # Queue indexing
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

    background_tasks.add_task(
        service.trigger_repository_indexing,
        effective_repo_id,
        effective_repo_path,
        effective_repo_url,
        effective_repo_ref,
        req.commit_sha,
        repository_db_id,
        snapshot_id,
        indexing_job_id,
    )

    return success_response(IndexResponse(indexed_chunks=0, snapshot_id=snapshot_id).model_dump(), status_code=status.HTTP_202_ACCEPTED)

@router.get("/index/progress/{snapshot_id}")
def get_index_progress(
    snapshot_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    logger.info("index_progress - request snapshot_id=%s", snapshot_id)
    # Check for stalls first
    data = service.check_indexing_timeout_and_stalls(session, snapshot_id)
    if not data:
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    stats = data["stats"] or {}
    if isinstance(stats, str):
        try:
            stats = json.loads(stats)
        except:
            stats = {}

    started_at = data["started_at"]
    if started_at and hasattr(started_at, "isoformat"):
        started_at = started_at.isoformat()

    return success_response({
        "snapshot_id": snapshot_id,
        "index_status": data["index_status"] or data["status"] or "pending",
        "job_status": data["status"] or "pending",
        "message": data["message"] or "Indexing in progress...",
        "stats": stats,
        "total_files": stats.get("total_files", 0),
        "processed_files": stats.get("processed_files", 0),
        "percentage": stats.get("percentage", 0),
        "current_file": stats.get("current_file"),
        "eta_seconds": stats.get("eta_seconds"),
        "started_at": started_at,
    })

def service_membership_check(session: Session, project_id: str, user_id: str) -> None:
    membership = session.execute(
        text("SELECT id FROM project_memberships WHERE project_id = :p AND user_id = :u"),
        {"p": project_id, "u": user_id},
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied to this project")
