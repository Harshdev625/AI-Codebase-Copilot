from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.api_response import success_response
from app.core.roles import normalize_role
from app.db.database import get_db_session

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/me")
def user_dashboard_summary(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    user_id = current_user["id"]

    counts = session.execute(
        text(
            """
            SELECT
              (SELECT COUNT(*) FROM projects p
               JOIN project_memberships pm ON pm.project_id = p.id
               WHERE pm.user_id = :user_id) AS projects_count,
              (SELECT COUNT(*) FROM repositories r
               JOIN project_memberships pm ON pm.project_id = r.project_id
               WHERE pm.user_id = :user_id) AS repositories_count,
                            (SELECT COUNT(*) FROM code_chunks cc
                             WHERE cc.repository_id IN (
                                 SELECT r.id
                                 FROM repositories r
                                 JOIN project_memberships pm ON pm.project_id = r.project_id
                                 WHERE pm.user_id = :user_id
                             )) AS indexed_chunks_count
            """
        ),
        {"user_id": user_id},
    ).mappings().first()

    recent_repositories = session.execute(
        text(
            """
                        SELECT r.id, r.repo_id, r.default_branch, r.created_at,
                                     (
                                         SELECT rs.index_status
                                         FROM repository_snapshots rs
                                         WHERE rs.repository_id = r.id
                                         ORDER BY rs.created_at DESC
                                         LIMIT 1
                                     ) AS latest_index_status
                        FROM repositories r
                        JOIN project_memberships pm ON pm.project_id = r.project_id
                        WHERE pm.user_id = :user_id
                        ORDER BY r.created_at DESC
            LIMIT 8
            """
        ),
        {"user_id": user_id},
    ).mappings().all()

    return success_response(
        {
            "user": {
                "id": current_user["id"],
                "email": current_user["email"],
                "full_name": current_user.get("full_name"),
                "role": normalize_role(current_user.get("role")),
                "is_active": bool(current_user.get("is_active", False)),
            },
            "metrics": dict(counts) if counts else {},
            "recent_repositories": [dict(row) for row in recent_repositories],
        }
    )
