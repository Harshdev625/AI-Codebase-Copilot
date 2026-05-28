from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import (
    PaginationParams,
    assert_scopes,
    ensure_repository_access,
    ensure_repository_access_by_id,
    get_current_user,
    get_pagination,
    resolve_pagination,
)
from app.core.api_response import paginated_success_response, success_response
from app.db.database import get_db_session
from app.models.api_models import (
    AddRepositoryRequest,
    IndexRequest,
    IndexResponse,
    RepositoryResponse,
)
from . import service

router = APIRouter(tags=["repositories"])
logger = logging.getLogger(__name__)

def _safe_count_from_result(result: Any) -> int:
    scalar_fn = getattr(result, "scalar", None)
    if callable(scalar_fn):
        try:
            value = scalar_fn()
            return int(value or 0)
        except Exception:
            pass

    mappings_fn = getattr(result, "mappings", None)
    if callable(mappings_fn):
        mapped = mappings_fn()
        first_fn = getattr(mapped, "first", None)
        if callable(first_fn):
            row = first_fn()
            if isinstance(row, dict) and row:
                first_value = next(iter(row.values()))
                try:
                    return int(first_value or 0)
                except Exception:
                    return 0

    first_fn = getattr(result, "first", None)
    if callable(first_fn):
        row = first_fn()
        if isinstance(row, (list, tuple)) and row:
            try:
                return int(row[0] or 0)
            except Exception:
                return 0

    return 0


def _to_payload(row: dict) -> dict:
    payload = dict(row)
    created_at = payload.get("created_at")
    if created_at is not None and hasattr(created_at, "isoformat"):
        payload["created_at"] = created_at.isoformat()

    latest_stats = payload.get("latest_job_stats")
    if latest_stats is None:
        latest_stats = payload.get("latest_index_stats")
    if isinstance(latest_stats, str):
        try:
            latest_stats = json.loads(latest_stats)
        except json.JSONDecodeError:
            latest_stats = {}
    if latest_stats is None:
        latest_stats = {}
    payload["latest_job_stats"] = latest_stats
    payload["latest_index_stats"] = latest_stats

    latest_job_status = payload.get("latest_job_status")
    if latest_job_status is not None:
        payload["latest_index_status"] = latest_job_status

    indexed_chunks = latest_stats.get("indexed_chunks") if isinstance(latest_stats, dict) else None
    payload["latest_indexed_chunks"] = indexed_chunks if isinstance(indexed_chunks, int) else None

    return payload

@router.get("/projects")
def list_projects(
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Projects are disabled in the simplified schema.")

@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Projects are disabled in the simplified schema.")

@router.delete("/projects/{project_id}", status_code=status.HTTP_200_OK)
def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Projects are disabled in the simplified schema.")

@router.get("/projects/{project_id}/repositories")
def list_repositories(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Project repositories are disabled in the simplified schema.")

@router.post("/projects/{project_id}/repositories", status_code=status.HTTP_201_CREATED)
def add_repository(
    project_id: str,
    req: AddRepositoryRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Project repositories are disabled in the simplified schema.")

@router.post("/index", status_code=status.HTTP_202_ACCEPTED)
def index_repo(
    req: IndexRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"indexing:write"})
    logger.info("index_start - request repository_id=%s", req.repository_id)

    if req.repository_id:
        repository_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repository_row = ensure_repository_access(session, req.repo_id, current_user["id"])

    try:
        queued = service.queue_repository_indexing(
            session,
            repository_row=repository_row,
            commit_sha=req.commit_sha,
            repo_path=req.repo_path,
            repo_url=req.repo_url,
            repo_ref=req.repo_ref,
            source="manual",
            prevent_duplicate_commit=False,
        )
    except service.IndexingAlreadyRunningError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("index_start - queue dispatch failed repository_id=%s", repository_row["id"])
        raise HTTPException(status_code=503, detail="Failed to enqueue indexing job") from exc

    return success_response(
        IndexResponse(indexed_chunks=0, indexing_job_id=queued["indexing_job_id"]).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )

@router.get("/index/progress/{indexing_job_id}")
def get_index_progress(
    indexing_job_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    data = service.get_index_job_progress(
        session,
        indexing_job_id=indexing_job_id,
        user_id=str(current_user["id"]),
    )
    if not data:
        raise HTTPException(status_code=404, detail="Indexing job not found")
    return success_response(data)


@router.get("/repositories")
def list_user_repositories(
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    pagination = resolve_pagination(pagination)
    total_result = session.execute(
        text("SELECT COUNT(*) AS total FROM repositories WHERE owner_user_id = :user_id"),
        {"user_id": current_user["id"]},
    )
    total = _safe_count_from_result(total_result)
    repos = service.get_repositories_for_user(
        session,
        user_id=str(current_user["id"]),
        limit=pagination.limit,
        offset=pagination.offset,
    )
    payload = [RepositoryResponse(**_to_payload(r)).model_dump() for r in repos]
    return paginated_success_response(
        items=payload,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post("/repositories", status_code=status.HTTP_201_CREATED)
def add_user_repository(
    req: AddRepositoryRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:write"})
    repo = service.add_repository_for_user(
        session,
        owner_user_id=str(current_user["id"]),
        repo_id=req.repo_id,
        remote_url=req.remote_url,
        local_path=req.local_path,
        default_branch=req.default_branch,
    )
    return success_response(
        RepositoryResponse(**_to_payload(repo)).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )
