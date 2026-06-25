from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import assert_scopes, get_current_user
from app.core.api_response import success_response
from app.core.roles import normalize_role
from app.db.database import get_db_session

router = APIRouter(tags=["dashboard"])
logger = logging.getLogger(__name__)

_READY_STATUSES = frozenset({"completed", "complete", "success"})
_ACTIVE_STATUSES = frozenset({"running", "in_progress", "pending", "queued"})
_FAILED_STATUSES = frozenset({"failed", "error"})


def _coerce_dt(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _serialize_dt(value: datetime | str | None) -> str | None:
    coerced = _coerce_dt(value)
    if coerced is None:
        return None
    return coerced.isoformat()


def _classify_index_status(status: str | None) -> str:
    key = (status or "").lower()
    if key in _READY_STATUSES:
        return "ready"
    if key in _ACTIVE_STATUSES:
        return "indexing"
    if key in _FAILED_STATUSES:
        return "failed"
    return "idle"


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
               )) AS indexed_chunks_count,
              (SELECT COUNT(*) FROM repository_files rf
               WHERE rf.repository_id IN (
                 SELECT r.id FROM repositories r WHERE r.owner_user_id = :user_id
               ) AND rf.status = 'INDEXED') AS indexed_files_count,
              (SELECT COUNT(*) FROM indexing_jobs ij
               WHERE ij.repository_id IN (
                 SELECT r.id FROM repositories r WHERE r.owner_user_id = :user_id
               )
               AND LOWER(ij.status) IN ('running', 'in_progress', 'pending', 'queued')
              ) AS active_indexing_jobs
            """
        ),
        {"user_id": user_id},
    ).mappings().first()

    last_chat_activity = session.execute(
        text(
            """
            SELECT MAX(cs.last_activity_at) AS last_activity_at
            FROM chat_sessions cs
            WHERE cs.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).scalar()

    last_index_activity = session.execute(
        text(
            """
            SELECT MAX(ij.finished_at) AS last_activity_at
            FROM indexing_jobs ij
            INNER JOIN repositories r ON r.id = ij.repository_id
            WHERE r.owner_user_id = :user_id AND ij.finished_at IS NOT NULL
            """
        ),
        {"user_id": user_id},
    ).scalar()

    metrics = dict(counts) if counts else {}
    activity_candidates = [
        _coerce_dt(dt) for dt in (last_chat_activity, last_index_activity) if dt is not None
    ]
    activity_candidates = [dt for dt in activity_candidates if dt is not None]
    if activity_candidates:
        metrics["last_activity_at"] = _serialize_dt(max(activity_candidates))

    repo_status_rows = session.execute(
        text(
            """
            SELECT r.id,
                   (
                     SELECT ij.status
                     FROM indexing_jobs ij
                     WHERE ij.repository_id = r.id
                     ORDER BY ij.created_at DESC
                     LIMIT 1
                   ) AS latest_job_status
            FROM repositories r
            WHERE r.owner_user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().all()

    indexing_summary = {"ready": 0, "indexing": 0, "failed": 0, "idle": 0}
    for row in repo_status_rows:
        bucket = _classify_index_status(row["latest_job_status"])
        indexing_summary[bucket] += 1

    recent_sessions_rows = session.execute(
        text(
            """
            SELECT
              cs.id,
              cs.session_title,
              cs.session_mode,
              cs.repository_id,
              cs.updated_at,
              cs.last_activity_at,
              cs.is_archived
            FROM chat_sessions cs
            WHERE cs.user_id = :user_id
            ORDER BY cs.updated_at DESC
            LIMIT 10
            """
        ),
        {"user_id": user_id},
    ).mappings().all()

    recent_sessions = []
    for row in recent_sessions_rows:
        if row.get("is_archived") in (True, 1, "1", "true"):
            continue
        recent_sessions.append(
            {
                "id": row["id"],
                "session_title": row["session_title"],
                "session_mode": row["session_mode"],
                "repository_id": row["repository_id"],
                "updated_at": _serialize_dt(row["updated_at"]),
                "last_activity_at": _serialize_dt(row["last_activity_at"]),
            }
        )
        if len(recent_sessions) >= 5:
            break

    recent_repositories = session.execute(
        text(
            """
            SELECT
              r.id,
              r.repo_id,
              r.default_branch,
              r.created_at,
              (
                SELECT ij.status
                FROM indexing_jobs ij
                WHERE ij.repository_id = r.id
                ORDER BY ij.created_at DESC
                LIMIT 1
              ) AS latest_job_status,
              (
                SELECT ij.message
                FROM indexing_jobs ij
                WHERE ij.repository_id = r.id
                ORDER BY ij.created_at DESC
                LIMIT 1
              ) AS latest_job_message,
              (
                SELECT ij.commit_sha
                FROM indexing_jobs ij
                WHERE ij.repository_id = r.id
                  AND LOWER(ij.status) IN ('completed', 'complete', 'success')
                ORDER BY ij.finished_at DESC, ij.created_at DESC
                LIMIT 1
              ) AS last_commit_sha,
              (
                SELECT COUNT(*) FROM repository_files rf
                WHERE rf.repository_id = r.id AND rf.status = 'INDEXED'
              ) AS indexed_files_count,
              (
                SELECT COUNT(*) FROM code_chunks cc
                WHERE cc.repository_id = r.id
              ) AS indexed_chunks_count,
              (
                SELECT ij.finished_at
                FROM indexing_jobs ij
                WHERE ij.repository_id = r.id
                  AND LOWER(ij.status) IN ('completed', 'complete', 'success')
                  AND ij.finished_at IS NOT NULL
                ORDER BY ij.finished_at DESC
                LIMIT 1
              ) AS last_indexed_at
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
        item = {
            "id": row["id"],
            "repo_id": row["repo_id"],
            "default_branch": row["default_branch"],
            "created_at": _serialize_dt(row["created_at"]),
            "latest_job_status": row["latest_job_status"],
            "latest_job_message": row["latest_job_message"],
            "last_commit_sha": row["last_commit_sha"],
            "indexed_files_count": int(row["indexed_files_count"] or 0),
            "indexed_chunks_count": int(row["indexed_chunks_count"] or 0),
            "last_indexed_at": _serialize_dt(row["last_indexed_at"]),
        }
        if item.get("latest_job_status") is not None:
            item["latest_index_status"] = item["latest_job_status"]
        recent_payload.append(item)

    user_payload = {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name"),
        "role": normalize_role(current_user.get("role")),
        "token_scopes": [str(scope) for scope in current_user.get("token_scopes", [])],
        "is_active": bool(current_user.get("is_active", False)),
    }

    logger.info(
        "dashboard_me - response sent user_id=%s recent_repositories=%s recent_sessions=%s",
        user_id,
        len(recent_payload),
        len(recent_sessions),
    )
    return success_response(
        {
            "user": user_payload,
            "metrics": metrics,
            "indexing_summary": indexing_summary,
            "recent_sessions": recent_sessions,
            "recent_repositories": recent_payload,
        }
    )


@router.get("/dashboard/activity")
def user_dashboard_activity(
    days: int = Query(default=7, ge=1, le=30),
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    user_id = current_user["id"]
    assert_scopes(current_user, {"repository:read"})
    logger.info("dashboard_activity - request received user_id=%s days=%s", user_id, days)

    since = datetime.now(timezone.utc) - timedelta(days=days - 1)
    since_date = since.date()

    session_rows = session.execute(
        text(
            """
            SELECT DATE(cs.created_at) AS day, COUNT(*) AS sessions
            FROM chat_sessions cs
            WHERE cs.user_id = :user_id
              AND DATE(cs.created_at) >= :since_date
            GROUP BY DATE(cs.created_at)
            ORDER BY day ASC
            """
        ),
        {"user_id": user_id, "since_date": since_date},
    ).mappings().all()

    job_rows = session.execute(
        text(
            """
            SELECT DATE(ij.finished_at) AS day, COUNT(*) AS indexing_jobs_completed
            FROM indexing_jobs ij
            INNER JOIN repositories r ON r.id = ij.repository_id
            WHERE r.owner_user_id = :user_id
              AND ij.finished_at IS NOT NULL
              AND LOWER(ij.status) IN ('completed', 'complete', 'success')
              AND DATE(ij.finished_at) >= :since_date
            GROUP BY DATE(ij.finished_at)
            ORDER BY day ASC
            """
        ),
        {"user_id": user_id, "since_date": since_date},
    ).mappings().all()

    sessions_by_day = {str(row["day"]): int(row["sessions"]) for row in session_rows}
    jobs_by_day = {str(row["day"]): int(row["indexing_jobs_completed"]) for row in job_rows}

    day_buckets: list[dict] = []
    for offset in range(days):
        day = since_date + timedelta(days=offset)
        day_key = day.isoformat()
        day_buckets.append(
            {
                "date": day_key,
                "sessions": sessions_by_day.get(day_key, 0),
                "indexing_jobs_completed": jobs_by_day.get(day_key, 0),
            }
        )

    logger.info("dashboard_activity - response sent user_id=%s buckets=%s", user_id, len(day_buckets))
    return success_response({"days": day_buckets})
