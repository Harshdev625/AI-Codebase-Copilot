from __future__ import annotations

import httpx
import redis

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, Field

from app.api.dependencies import require_roles
from app.core.api_response import success_response
from app.core.config import settings
from app.core.roles import ROLE_ADMIN, ROLE_USER, normalize_role
from app.db.database import get_db_session

router = APIRouter(tags=["admin"])


class UserRoleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    """Request to update user role (similar to Google, AWS admin management)."""
    role: str = Field(..., min_length=4, max_length=16)  # "ADMIN" or "USER"


class UserActiveUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    """Request to activate/deactivate user."""
    is_active: bool


@router.get("/admin/users")
def admin_users(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> list[dict]:
    rows = session.execute(
        text(
            """
            SELECT id, email, full_name, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC
            """
        )
    ).mappings().all()
    results: list[dict] = []
    for row in rows:
        item = dict(row)
        item["role"] = normalize_role(item.get("role"))
        results.append(item)
    return success_response(results)


@router.get("/admin/repositories")
def admin_repositories(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> list[dict]:
    rows = session.execute(
        text(
            """
            SELECT id, project_id, repo_id, remote_url, local_path, default_branch, created_at
            FROM repositories
            ORDER BY created_at DESC
            """
        )
    ).mappings().all()
    return success_response([dict(row) for row in rows])


@router.get("/admin/indexing-status")
def admin_indexing_status(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> list[dict]:
    rows = session.execute(
        text(
            """
            SELECT id, repository_id, snapshot_id, status, message, started_at, finished_at, created_at
            FROM indexing_jobs
            ORDER BY created_at DESC
            LIMIT 200
            """
        )
    ).mappings().all()
    return success_response([dict(row) for row in rows])


@router.post("/admin/users/{user_id}/role")
def update_user_role(
    user_id: str,
    request: UserRoleUpdate,
    current_admin: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Update user role. Only admins can promote/demote users.
    Similar to AWS/GCP/Azure admin management.
    """
    normalized_role = normalize_role(request.role)
    if normalized_role not in (ROLE_ADMIN, ROLE_USER):
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'ADMIN' or 'USER'.")

    # Prevent self-demotion (safety check)
    if current_admin["id"] == user_id and normalized_role == ROLE_USER:
        raise HTTPException(status_code=400, detail="Cannot demote yourself. Contact another admin.")

    # Update role
    session.execute(
        text("UPDATE users SET role = :role, updated_at = NOW() WHERE id = :user_id"),
        {"role": normalized_role, "user_id": user_id},
    )
    session.commit()

    # Return updated user
    row = session.execute(
        text("SELECT id, email, full_name, role, is_active FROM users WHERE id = :user_id"),
        {"user_id": user_id},
    ).mappings().first()

    if row:
        result = dict(row)
        result["role"] = normalize_role(result.get("role"))
        return success_response(result)
    raise HTTPException(status_code=404, detail="User not found")


@router.post("/admin/users/{user_id}/status")
def update_user_status(
    user_id: str,
    request: UserActiveUpdate,
    current_admin: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    """Activate or deactivate a user account."""
    # Prevent self-deactivation
    if current_admin["id"] == user_id and not request.is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself. Contact another admin.")

    # Update status
    session.execute(
        text("UPDATE users SET is_active = :is_active, updated_at = NOW() WHERE id = :user_id"),
        {"is_active": request.is_active, "user_id": user_id},
    )
    session.commit()

    # Return updated user
    row = session.execute(
        text("SELECT id, email, full_name, role, is_active FROM users WHERE id = :user_id"),
        {"user_id": user_id},
    ).mappings().first()

    if row:
        result = dict(row)
        result["role"] = normalize_role(result.get("role"))
        return success_response(result)
    raise HTTPException(status_code=404, detail="User not found")


@router.delete("/admin/users/{user_id}")
def delete_user(
    user_id: str,
    current_admin: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    """Delete a user account (admin only). Cascades to delete projects."""
    # Prevent self-deletion
    if current_admin["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself. Contact another admin.")

    # Delete user (cascade deletes related data)
    result = session.execute(
        text("DELETE FROM users WHERE id = :user_id RETURNING id, email"),
        {"user_id": user_id},
    ).mappings().first()
    session.commit()

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return success_response({"deleted": True, "user_id": result["id"], "email": result["email"]})


@router.get("/admin/system-metrics")
def admin_system_metrics(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    counts = session.execute(
        text(
            """
            SELECT
              (SELECT COUNT(*) FROM users) AS users_count,
              (SELECT COUNT(*) FROM projects) AS projects_count,
              (SELECT COUNT(*) FROM repositories) AS repositories_count,
              (SELECT COUNT(*) FROM code_chunks) AS indexed_chunks_count
            """
        )
    ).mappings().first()
    return success_response(dict(counts) if counts else {})


@router.get("/admin/recent-activity")
def admin_recent_activity(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    indexing_jobs = session.execute(
        text(
            """
            SELECT id, repository_id, status, message, started_at, finished_at, created_at
            FROM indexing_jobs
            ORDER BY created_at DESC
            LIMIT 25
            """
        )
    ).mappings().all()

    recent_users = session.execute(
        text(
            """
            SELECT id, email, full_name, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT 25
            """
        )
    ).mappings().all()

    return success_response(
        {
            "indexing_jobs": [dict(row) for row in indexing_jobs],
            "recent_users": [
                {**dict(row), "role": normalize_role(dict(row).get("role"))} for row in recent_users
            ],
        }
    )


@router.get("/admin/service-health")
def admin_service_health(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> list[dict]:
    def _ok() -> dict:
        return {"status": "online", "error": None}

    def _fail(exc: Exception) -> dict:
        return {"status": "offline", "error": str(exc)}

    # Backend + DB health through current SQLAlchemy session.
    try:
        session.execute(text("SELECT 1"))
        db_status = _ok()
    except Exception as exc:
        db_status = _fail(exc)

    # Qdrant direct HTTP health.
    try:
        with httpx.Client(timeout=3.0) as client:
            response = client.get(f"{settings.qdrant_url}/collections")
            response.raise_for_status()
        qdrant_status = _ok()
    except Exception as exc:
        qdrant_status = _fail(exc)

    # Redis ping.
    try:
        redis.Redis(host=settings.redis_host, port=settings.redis_port, db=settings.redis_db).ping()
        redis_status = _ok()
    except Exception as exc:
        redis_status = _fail(exc)

    # Ollama tags endpoint.
    try:
        with httpx.Client(timeout=3.0) as client:
            response = client.get(f"{settings.ollama_base_url}/api/tags")
            response.raise_for_status()
        ollama_status = _ok()
    except Exception as exc:
        ollama_status = _fail(exc)

    return success_response(
        [
            {"name": "Backend API", "status": "online", "detail": None},
            {"name": "PostgreSQL", "status": db_status["status"], "detail": db_status["error"]},
            {"name": "Qdrant", "status": qdrant_status["status"], "detail": qdrant_status["error"]},
            {"name": "Redis", "status": redis_status["status"], "detail": redis_status["error"]},
            {"name": "Ollama", "status": ollama_status["status"], "detail": ollama_status["error"]},
        ]
    )