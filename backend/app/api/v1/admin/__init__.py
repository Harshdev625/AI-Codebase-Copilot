from __future__ import annotations

import logging
import httpx
import redis

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, Field

from app.api.dependencies import PaginationParams, assert_scopes, get_pagination, require_roles, resolve_pagination
from app.core.api_response import paginated_success_response, success_response
from app.core.config import settings
from app.core.roles import ROLE_ADMIN, ROLE_USER, normalize_role
from app.db.database import get_db_session
from app.observability.metrics import runtime_metrics

router = APIRouter(tags=["admin"])
logger = logging.getLogger(__name__)


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
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    pagination = resolve_pagination(pagination)
    logger.info("admin_users - request received")
    total = int(session.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0)
    rows = session.execute(
        text(
            """
            SELECT id, email, full_name, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"limit": pagination.limit, "offset": pagination.offset},
    ).mappings().all()
    results: list[dict] = []
    for row in rows:
        item = dict(row)
        item["role"] = normalize_role(item.get("role"))
        results.append(item)
    logger.info("admin_users - response sent count=%s", len(results))
    return paginated_success_response(
        items=results,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get("/admin/repositories")
def admin_repositories(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    pagination = resolve_pagination(pagination)
    logger.info("admin_repositories - request received")
    total = int(session.execute(text("SELECT COUNT(*) FROM repositories")).scalar() or 0)
    rows = session.execute(
        text(
            """
            SELECT id, owner_user_id, repo_id, remote_url, local_path, default_branch, created_at
            FROM repositories
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"limit": pagination.limit, "offset": pagination.offset},
    ).mappings().all()
    payload = [dict(row) for row in rows]
    logger.info("admin_repositories - response sent count=%s", len(payload))
    return paginated_success_response(
        items=payload,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get("/admin/indexing-status")
def admin_indexing_status(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    pagination = resolve_pagination(pagination)
    logger.info("admin_indexing_status - request received")
    total = int(session.execute(text("SELECT COUNT(*) FROM indexing_jobs")).scalar() or 0)
    rows = session.execute(
        text(
            """
            SELECT id, repository_id, commit_sha, status, message, started_at, finished_at, created_at
            FROM indexing_jobs
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"limit": pagination.limit, "offset": pagination.offset},
    ).mappings().all()
    payload = [dict(row) for row in rows]
    logger.info("admin_indexing_status - response sent count=%s", len(payload))
    return paginated_success_response(
        items=payload,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post("/admin/users/{user_id}/role")
def update_user_role(
    user_id: str,
    request: UserRoleUpdate,
    current_admin: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_admin, {"admin:write"})
    """
    Update user role. Only admins can promote/demote users.
    Similar to AWS/GCP/Azure admin management.
    """
    logger.info("admin_update_user_role - request received target_user_id=%s", user_id)
    normalized_role = normalize_role(request.role)
    if normalized_role not in (ROLE_ADMIN, ROLE_USER):
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'ADMIN' or 'USER'.")

    # Prevent self-demotion (safety check)
    if current_admin["id"] == user_id and normalized_role == ROLE_USER:
        raise HTTPException(status_code=400, detail="Cannot demote yourself. Contact another admin.")

    # Update role
    session.execute(
        text("UPDATE users SET role = :role, updated_at = CURRENT_TIMESTAMP WHERE id = :user_id"),
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
        logger.info("admin_update_user_role - success target_user_id=%s role=%s", user_id, result["role"])
        return success_response(result)
    logger.warning("admin_update_user_role - user not found target_user_id=%s", user_id)
    raise HTTPException(status_code=404, detail="User not found")


@router.post("/admin/users/{user_id}/status")
def update_user_status(
    user_id: str,
    request: UserActiveUpdate,
    current_admin: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_admin, {"admin:write"})
    """Activate or deactivate a user account."""
    logger.info("admin_update_user_status - request received target_user_id=%s", user_id)
    # Prevent self-deactivation
    if current_admin["id"] == user_id and not request.is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself. Contact another admin.")

    # Update status
    session.execute(
        text("UPDATE users SET is_active = :is_active, updated_at = CURRENT_TIMESTAMP WHERE id = :user_id"),
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
        logger.info(
            "admin_update_user_status - success target_user_id=%s is_active=%s",
            user_id,
            result["is_active"],
        )
        return success_response(result)
    logger.warning("admin_update_user_status - user not found target_user_id=%s", user_id)
    raise HTTPException(status_code=404, detail="User not found")


@router.delete("/admin/users/{user_id}")
def delete_user(
    user_id: str,
    current_admin: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_admin, {"admin:write"})
    """Delete a user account (admin only)."""
    logger.info("admin_delete_user - request received target_user_id=%s", user_id)
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
        logger.warning("admin_delete_user - user not found target_user_id=%s", user_id)
        raise HTTPException(status_code=404, detail="User not found")

    logger.info("admin_delete_user - success target_user_id=%s", user_id)
    return success_response({"deleted": True, "user_id": result["id"], "email": result["email"]})


@router.get("/admin/system-metrics")
def admin_system_metrics(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    logger.info("admin_system_metrics - request received")
    counts = session.execute(
        text(
            """
            SELECT
              (SELECT COUNT(*) FROM users) AS users_count,
              (SELECT COUNT(*) FROM repositories) AS repositories_count,
              (SELECT COUNT(*) FROM code_chunks) AS indexed_chunks_count,
              (SELECT COUNT(*) FROM repository_files) AS indexed_files_count,
              (SELECT COUNT(*) FROM act_patch_drafts) AS patch_count,
              (SELECT COUNT(*) FROM repository_snapshots) AS snapshot_count,
              (SELECT COUNT(*) FROM chat_sessions) AS active_sessions
            """
        )
    ).mappings().first()
    payload = dict(counts) if counts else {}
    logger.info("admin_system_metrics - response sent")
    return success_response(payload)


@router.get("/admin/runtime-metrics")
def admin_runtime_metrics(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
) -> dict:
    assert_scopes(_, {"admin:read"})
    logger.info("admin_runtime_metrics - request received")
    payload = runtime_metrics.snapshot()
    logger.info("admin_runtime_metrics - response sent counters=%s latencies=%s", len(payload.get("counters", {})), len(payload.get("latencies", {})))
    return success_response(payload)


def _safe_pct(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 2)


@router.get("/admin/telemetry")
def admin_telemetry(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    logger.info("admin_telemetry - request received")

    queue_row = session.execute(
        text(
            """
            SELECT
              COUNT(*) FILTER (WHERE status = 'pending') AS queue_depth,
              COUNT(*) FILTER (WHERE status = 'running') AS indexing_running,
              COUNT(*) FILTER (WHERE status = 'failed') AS failed_jobs,
              COUNT(*) AS total_jobs
            FROM indexing_jobs
            """
        )
    ).mappings().first()

    active_stream_row = session.execute(
        text(
            """
            SELECT COUNT(*) AS active_streams
            FROM agent_runs
            WHERE status IN ('running', 'streaming', 'in_progress')
              AND started_at >= NOW() - INTERVAL '30 minutes'
            """
        )
    ).mappings().first()

    retrieval_row = session.execute(
        text(
            """
            WITH recent_runs AS (
              SELECT
                CASE
                  WHEN (diagnostics->>'retrieved_count') ~ '^[0-9]+$' THEN (diagnostics->>'retrieved_count')::int
                  WHEN (diagnostics->>'retrieval_count') ~ '^[0-9]+$' THEN (diagnostics->>'retrieval_count')::int
                  ELSE 0
                END AS retrieved_count
              FROM agent_runs
              WHERE started_at >= NOW() - INTERVAL '24 hours'
            )
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE retrieved_count >= 1) AS hit_ge_1,
              COUNT(*) FILTER (WHERE retrieved_count >= 3) AS hit_ge_3,
              COUNT(*) FILTER (WHERE retrieved_count = 0) AS hit_zero
            FROM recent_runs
            """
        )
    ).mappings().first()

    latency_row = session.execute(
        text(
            """
            WITH completed_runs AS (
              SELECT EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000.0 AS latency_ms
              FROM agent_runs
              WHERE finished_at IS NOT NULL
                AND started_at IS NOT NULL
                AND status = 'completed'
                AND finished_at >= NOW() - INTERVAL '24 hours'
            )
            SELECT
              COALESCE(AVG(latency_ms), 0) AS avg_latency_ms,
              COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms), 0) AS p50_latency_ms,
              COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) AS p95_latency_ms
            FROM completed_runs
            """
        )
    ).mappings().first()

    latency_samples_rows = session.execute(
        text(
            """
            SELECT EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000.0 AS latency_ms
            FROM agent_runs
            WHERE finished_at IS NOT NULL
              AND started_at IS NOT NULL
              AND finished_at >= NOW() - INTERVAL '24 hours'
            ORDER BY finished_at DESC
            LIMIT 30
            """
        )
    ).mappings().all()

    queue_depth = int((queue_row or {}).get("queue_depth") or 0)
    indexing_running = int((queue_row or {}).get("indexing_running") or 0)
    failed_jobs = int((queue_row or {}).get("failed_jobs") or 0)
    total_jobs = int((queue_row or {}).get("total_jobs") or 0)

    retrieval_total = int((retrieval_row or {}).get("total") or 0)
    retrieval_hit_ge_1 = int((retrieval_row or {}).get("hit_ge_1") or 0)
    retrieval_hit_ge_3 = int((retrieval_row or {}).get("hit_ge_3") or 0)
    retrieval_hit_zero = int((retrieval_row or {}).get("hit_zero") or 0)

    payload = {
        "active_streams": int((active_stream_row or {}).get("active_streams") or 0),
        "indexing_queue_depth": queue_depth,
        "indexing_running": indexing_running,
        "queue_health": {
            "total_jobs": total_jobs,
            "failed_jobs": failed_jobs,
            "failure_rate_pct": _safe_pct(failed_jobs, total_jobs),
        },
        "retrieval_hit_profile": {
            "sample_size": retrieval_total,
            "top1_hit_rate_pct": _safe_pct(retrieval_hit_ge_1, retrieval_total),
            "top3_hit_rate_pct": _safe_pct(retrieval_hit_ge_3, retrieval_total),
            "zero_hit_rate_pct": _safe_pct(retrieval_hit_zero, retrieval_total),
        },
        "model_latency": {
            "avg_ms": round(float((latency_row or {}).get("avg_latency_ms") or 0.0), 2),
            "p50_ms": round(float((latency_row or {}).get("p50_latency_ms") or 0.0), 2),
            "p95_ms": round(float((latency_row or {}).get("p95_latency_ms") or 0.0), 2),
            "samples_ms": [
                round(float(row.get("latency_ms") or 0.0), 2)
                for row in reversed([dict(item) for item in latency_samples_rows])
            ],
        },
    }
    logger.info("admin_telemetry - response sent")
    return success_response(payload)


@router.get("/admin/architecture-graph")
def admin_architecture_graph(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    repository_id: str | None = Query(default=None),
    limit: int = Query(default=500, ge=100, le=1500),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    raise HTTPException(status_code=410, detail="Architecture graph is disabled in the simplified schema.")


@router.get("/admin/recent-activity")
def admin_recent_activity(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    pagination = resolve_pagination(pagination)
    logger.info("admin_recent_activity - request received")
    indexing_jobs = session.execute(
        text(
            """
            SELECT id, repository_id, status, message, started_at, finished_at, created_at
            FROM indexing_jobs
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"limit": pagination.limit, "offset": pagination.offset},
    ).mappings().all()

    users_total = int(session.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0)
    recent_users = session.execute(
        text(
            """
            SELECT id, email, full_name, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"limit": pagination.limit, "offset": pagination.offset},
    ).mappings().all()

    jobs_total = int(session.execute(text("SELECT COUNT(*) FROM indexing_jobs")).scalar() or 0)

    payload = {
        "indexing_jobs": [dict(row) for row in indexing_jobs],
        "recent_users": [
            {**dict(row), "role": normalize_role(dict(row).get("role"))} for row in recent_users
        ],
    }
    logger.info(
        "admin_recent_activity - response sent indexing_jobs=%s recent_users=%s",
        len(payload["indexing_jobs"]),
        len(payload["recent_users"]),
    )
    return success_response(
        {
            "indexing_jobs": {
                "items": payload["indexing_jobs"],
                "pagination": {
                    "total": jobs_total,
                    "limit": pagination.limit,
                    "offset": pagination.offset,
                    "has_more": (pagination.offset + pagination.limit) < jobs_total,
                },
            },
            "recent_users": {
                "items": payload["recent_users"],
                "pagination": {
                    "total": users_total,
                    "limit": pagination.limit,
                    "offset": pagination.offset,
                    "has_more": (pagination.offset + pagination.limit) < users_total,
                },
            },
        }
    )


@router.get("/admin/service-health")
def admin_service_health(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    logger.info("admin_service_health - request received")
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

    statuses = [
            {"name": "Backend API", "status": "online", "detail": None},
            {"name": "PostgreSQL", "status": db_status["status"], "detail": db_status["error"]},
            {"name": "Qdrant", "status": qdrant_status["status"], "detail": qdrant_status["error"]},
            {"name": "Redis", "status": redis_status["status"], "detail": redis_status["error"]},
            {"name": "Ollama", "status": ollama_status["status"], "detail": ollama_status["error"]},
        ]
    logger.info("admin_service_health - response sent")
    return success_response(statuses)


@router.get("/admin/usage-overview")
def admin_usage_overview(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    raise HTTPException(status_code=410, detail="Usage tracking is disabled in the simplified schema.")


@router.get("/admin/billing-events")
def admin_billing_events(
    _: dict = Depends(require_roles({ROLE_ADMIN})),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(_, {"admin:read"})
    raise HTTPException(status_code=410, detail="Billing events are disabled in the simplified schema.")