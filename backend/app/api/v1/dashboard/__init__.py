from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import assert_scopes, get_current_user
from app.core.api_response import success_response
from app.core.roles import normalize_role
from app.db.database import get_db_session

router = APIRouter(tags=["dashboard"])
logger = logging.getLogger(__name__)


@router.get("/dashboard/me")
def user_dashboard_summary(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    user_id = current_user["id"]
    assert_scopes(current_user, {"repository:read"})
    logger.info("dashboard_me - request received user_id=%s", user_id)

    counts = session.execute(
        text(
            """
            SELECT
              (SELECT COUNT(*) FROM repositories r
               WHERE r.owner_user_id = :user_id) AS repositories_count,
              (SELECT COUNT(*) FROM chat_sessions cs WHERE cs.user_id = :user_id) AS chat_count,
              (SELECT COUNT(*) FROM code_chunks cc
               WHERE cc.repository_id IN (
                 SELECT r.id FROM repositories r WHERE r.owner_user_id = :user_id
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
                     SELECT ij.status
                     FROM indexing_jobs ij
                     WHERE ij.repository_id = r.id
                     ORDER BY ij.created_at DESC
                     LIMIT 1
                     ) AS latest_job_status
            FROM repositories r
            WHERE r.owner_user_id = :user_id
            ORDER BY r.created_at DESC
            LIMIT 8
            """
        ),
        {"user_id": user_id},
    ).mappings().all()

    recent_payload: list[dict] = []
    for row in recent_repositories:
        item = dict(row)
        if item.get("latest_job_status") is not None and item.get("latest_index_status") is None:
            item["latest_index_status"] = item.get("latest_job_status")
        recent_payload.append(item)

    payload = {
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "full_name": current_user.get("full_name"),
            "role": normalize_role(current_user.get("role")),
            "token_scopes": [str(scope) for scope in current_user.get("token_scopes", [])],
            "is_active": bool(current_user.get("is_active", False)),
        },
        "metrics": dict(counts) if counts else {},
        "recent_repositories": recent_payload,
    }
    logger.info(
        "dashboard_me - response sent user_id=%s recent_repositories=%s",
        user_id,
        len(payload["recent_repositories"]),
    )
    return success_response(
        {
            "user": payload["user"],
            "metrics": payload["metrics"],
            "recent_repositories": payload["recent_repositories"],
        }
    )
