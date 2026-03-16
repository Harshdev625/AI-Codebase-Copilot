from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db_session
from app.models.api_models import (
    AddRepositoryRequest,
    CreateProjectRequest,
    ProjectResponse,
    RepositoryResponse,
)

router = APIRouter(tags=["projects"])


def _to_payload(row: dict) -> dict:
    payload = dict(row)
    created_at = payload.get("created_at")
    if created_at is not None and hasattr(created_at, "isoformat"):
        payload["created_at"] = created_at.isoformat()
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
    return [ProjectResponse(**_to_payload(row)) for row in rows]


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

    return ProjectResponse(**_to_payload(row))


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
            SELECT id, project_id, repo_id, remote_url, local_path, default_branch, created_at
            FROM repositories
            WHERE project_id = :project_id
            ORDER BY created_at DESC
            """
        ),
        {"project_id": project_id},
    ).mappings().all()
    return [RepositoryResponse(**_to_payload(row)) for row in rows]


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

    return RepositoryResponse(**_to_payload(row))


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