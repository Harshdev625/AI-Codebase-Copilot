from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.dependencies import require_roles
from app.db.database import get_db_session

router = APIRouter(tags=["admin"])


class UserRoleUpdate(BaseModel):
    """Request to update user role (similar to Google, AWS admin management)."""
    user_id: str
    role: str  # "admin" or "developer"


class UserActiveUpdate(BaseModel):
    """Request to activate/deactivate user."""
    user_id: str
    is_active: bool


@router.get("/admin/users")
def admin_users(
    _: dict = Depends(require_roles({"admin"})),
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
    return [dict(row) for row in rows]


@router.get("/admin/repositories")
def admin_repositories(
    _: dict = Depends(require_roles({"admin"})),
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
    return [dict(row) for row in rows]


@router.get("/admin/indexing-status")
def admin_indexing_status(
    _: dict = Depends(require_roles({"admin"})),
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
    return [dict(row) for row in rows]


@router.get("/admin/agent-runs")
def admin_agent_runs(
    _: dict = Depends(require_roles({"admin"})),
    session: Session = Depends(get_db_session),
) -> list[dict]:
    rows = session.execute(
        text(
            """
            SELECT id, conversation_id, user_id, project_id, repo_id, query, intent, status, started_at, finished_at
            FROM agent_runs
            ORDER BY started_at DESC
            LIMIT 200
            """
        )
    ).mappings().all()
    return [dict(row) for row in rows]


@router.post("/admin/users/{user_id}/role")
def update_user_role(
    user_id: str,
    request: UserRoleUpdate,
    current_admin: dict = Depends(require_roles({"admin"})),
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Update user role. Only admins can promote/demote users.
    Similar to AWS/GCP/Azure admin management.
    """
    if request.role not in ("admin", "developer"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin' or 'developer'.")

    # Prevent self-demotion (safety check)
    if current_admin["id"] == user_id and request.role == "developer":
        raise HTTPException(status_code=400, detail="Cannot demote yourself. Contact another admin.")

    # Update role
    session.execute(
        text("UPDATE users SET role = :role, updated_at = NOW() WHERE id = :user_id"),
        {"role": request.role, "user_id": user_id},
    )
    session.commit()

    # Return updated user
    row = session.execute(
        text("SELECT id, email, full_name, role, is_active FROM users WHERE id = :user_id"),
        {"user_id": user_id},
    ).mappings().first()

    return dict(row) if row else {"error": "User not found"}


@router.post("/admin/users/{user_id}/status")
def update_user_status(
    user_id: str,
    request: UserActiveUpdate,
    current_admin: dict = Depends(require_roles({"admin"})),
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

    return dict(row) if row else {"error": "User not found"}


@router.delete("/admin/users/{user_id}")
def delete_user(
    user_id: str,
    current_admin: dict = Depends(require_roles({"admin"})),
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

    return {"deleted": True, "user_id": result["id"], "email": result["email"]}


@router.get("/admin/system-metrics")
def admin_system_metrics(
    _: dict = Depends(require_roles({"admin"})),
    session: Session = Depends(get_db_session),
) -> dict:
    counts = session.execute(
        text(
            """
            SELECT
              (SELECT COUNT(*) FROM users) AS users_count,
              (SELECT COUNT(*) FROM projects) AS projects_count,
              (SELECT COUNT(*) FROM repositories) AS repositories_count,
              (SELECT COUNT(*) FROM conversations) AS conversations_count,
              (SELECT COUNT(*) FROM messages) AS messages_count,
              (SELECT COUNT(*) FROM agent_runs) AS agent_runs_count,
              (SELECT COUNT(*) FROM code_chunks) AS indexed_chunks_count
            """
        )
    ).mappings().first()
    return dict(counts) if counts else {}