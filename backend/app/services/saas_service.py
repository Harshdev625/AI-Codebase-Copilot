from __future__ import annotations

import hashlib
import json
import logging
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.roles import ROLE_ADMIN, normalize_role


logger = logging.getLogger(__name__)

PLAN_FREE = "free"
PLAN_PRO = "pro"
PLAN_ENTERPRISE = "enterprise"

PROJECT_SCOPE_GLOBAL = "__global__"

_ALL_SCOPES = {
    "profile:read",
    "project:read",
    "project:write",
    "repository:read",
    "repository:write",
    "chat:query",
    "indexing:write",
    "usage:read",
    "apikey:read",
    "apikey:write",
    "billing:read",
    "admin:read",
    "admin:write",
}

_DEFAULT_SCOPES_USER = {
    "profile:read",
    "project:read",
    "project:write",
    "repository:read",
    "repository:write",
    "chat:query",
    "indexing:write",
    "usage:read",
    "apikey:read",
    "apikey:write",
    "billing:read",
}

_DEFAULT_SCOPES_ADMIN = _DEFAULT_SCOPES_USER.union({"admin:read", "admin:write"})


def _is_missing_table_error(exc: Exception, table: str) -> bool:
    message = str(exc).lower()
    return table.lower() in message and (
        "no such table" in message
        or "does not exist" in message
        or "undefined table" in message
    )


def _is_missing_column_error(exc: Exception, column: str) -> bool:
    message = str(exc).lower()
    return column.lower() in message and (
        "no such column" in message
        or "has no column named" in message
        or "undefined column" in message
    )


def _supports_execute(session: Any) -> bool:
    return hasattr(session, "execute") and callable(getattr(session, "execute", None))


def _safe_rollback(session: Any) -> None:
    rollback = getattr(session, "rollback", None)
    if callable(rollback):
        rollback()


def _safe_commit(session: Any) -> None:
    commit = getattr(session, "commit", None)
    if callable(commit):
        commit()


def normalize_plan_tier(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {PLAN_FREE, PLAN_PRO, PLAN_ENTERPRISE}:
        return normalized
    return PLAN_FREE


def default_scopes_for_role(role: str | None) -> list[str]:
    normalized_role = normalize_role(role)
    scopes = _DEFAULT_SCOPES_ADMIN if normalized_role == ROLE_ADMIN else _DEFAULT_SCOPES_USER
    return sorted(scopes)


def sanitize_requested_scopes(scopes: list[str] | None, *, role: str | None) -> list[str]:
    requested = {str(scope or "").strip().lower() for scope in (scopes or []) if str(scope or "").strip()}
    if not requested:
        return default_scopes_for_role(role)

    allowed = set(default_scopes_for_role(role))
    sanitized = sorted(scope for scope in requested if scope in allowed and scope in _ALL_SCOPES)
    if not sanitized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid scopes requested")
    return sanitized


def estimate_tokens(text_value: str | None) -> int:
    text_value = str(text_value or "")
    if not text_value.strip():
        return 0
    return max(1, len(text_value) // 4)


def get_plan_limits(plan_tier: str) -> dict[str, int]:
    plan = normalize_plan_tier(plan_tier)
    if plan == PLAN_ENTERPRISE:
        return {
            "requests_per_day": int(settings.plan_enterprise_requests_per_day),
            "queries_per_day": int(settings.plan_enterprise_queries_per_day),
            "queries_per_project_per_day": int(settings.plan_enterprise_queries_per_project_per_day),
            "index_jobs_per_day": int(settings.plan_enterprise_index_jobs_per_day),
            "index_jobs_per_project_per_day": int(settings.plan_enterprise_index_jobs_per_project_per_day),
            "indexing_volume_chunks_per_day": int(settings.plan_enterprise_indexing_volume_chunks_per_day),
            "max_projects": int(settings.plan_enterprise_max_projects),
            "max_repositories_per_project": int(settings.plan_enterprise_max_repositories_per_project),
        }
    if plan == PLAN_PRO:
        return {
            "requests_per_day": int(settings.plan_pro_requests_per_day),
            "queries_per_day": int(settings.plan_pro_queries_per_day),
            "queries_per_project_per_day": int(settings.plan_pro_queries_per_project_per_day),
            "index_jobs_per_day": int(settings.plan_pro_index_jobs_per_day),
            "index_jobs_per_project_per_day": int(settings.plan_pro_index_jobs_per_project_per_day),
            "indexing_volume_chunks_per_day": int(settings.plan_pro_indexing_volume_chunks_per_day),
            "max_projects": int(settings.plan_pro_max_projects),
            "max_repositories_per_project": int(settings.plan_pro_max_repositories_per_project),
        }

    return {
        "requests_per_day": int(settings.plan_free_requests_per_day),
        "queries_per_day": int(settings.plan_free_queries_per_day),
        "queries_per_project_per_day": int(settings.plan_free_queries_per_project_per_day),
        "index_jobs_per_day": int(settings.plan_free_index_jobs_per_day),
        "index_jobs_per_project_per_day": int(settings.plan_free_index_jobs_per_project_per_day),
        "indexing_volume_chunks_per_day": int(settings.plan_free_indexing_volume_chunks_per_day),
        "max_projects": int(settings.plan_free_max_projects),
        "max_repositories_per_project": int(settings.plan_free_max_repositories_per_project),
    }


def get_user_plan(session: Session, user_id: str) -> str:
    if not _supports_execute(session):
        return PLAN_FREE
    try:
        row = session.execute(
            text("SELECT plan_tier FROM users WHERE id = :user_id"),
            {"user_id": user_id},
        ).mappings().first()
    except Exception as exc:
        if not _is_missing_column_error(exc, "plan_tier"):
            raise
        _safe_rollback(session)
        return PLAN_FREE
    if not row:
        return PLAN_FREE
    return normalize_plan_tier(str(row.get("plan_tier") or PLAN_FREE))


def usage_snapshot(session: Session, user_id: str, project_id: str | None = None) -> dict[str, Any]:
    plan_tier = get_user_plan(session, user_id)
    limits = get_plan_limits(plan_tier)
    today = date.today()
    if not _supports_execute(session):
        usage_rows: list[dict[str, Any]] = []
    else:
        try:
            usage_rows = session.execute(
                text(
                    """
                    SELECT metric, SUM(count) AS value
                    FROM usage_counters
                    WHERE user_id = :user_id
                      AND period_start = :period_start
                      AND (
                        :project_scope = :global_scope
                        OR project_scope IN (:global_scope, :project_scope)
                      )
                    GROUP BY metric
                    """
                ),
                {
                    "user_id": user_id,
                    "period_start": today,
                    "global_scope": PROJECT_SCOPE_GLOBAL,
                    "project_scope": project_id or PROJECT_SCOPE_GLOBAL,
                },
            ).mappings().all()
        except Exception as exc:
            if not _is_missing_table_error(exc, "usage_counters"):
                raise
            _safe_rollback(session)
            usage_rows = []

    values = {str(row.get("metric") or ""): int(row.get("value") or 0) for row in usage_rows}
    return {
        "plan_tier": plan_tier,
        "limits": limits,
        "usage_today": {
            "requests": values.get("requests", 0),
            "queries": values.get("queries", 0),
            "index_jobs": values.get("index_jobs", 0),
            "indexing_volume_chunks": values.get("indexing_volume_chunks", 0),
            "tokens_in": values.get("llm_tokens_in", 0),
            "tokens_out": values.get("llm_tokens_out", 0),
        },
    }


def _metric_count(
    session: Session,
    *,
    user_id: str,
    metric: str,
    project_scope: str,
    period_start: date,
) -> int:
    if not _supports_execute(session):
        return 0
    try:
        row = session.execute(
            text(
                """
                SELECT count
                FROM usage_counters
                WHERE user_id = :user_id
                  AND metric = :metric
                  AND project_scope = :project_scope
                  AND period_start = :period_start
                LIMIT 1
                """
            ),
            {
                "user_id": user_id,
                "metric": metric,
                "project_scope": project_scope,
                "period_start": period_start,
            },
        ).mappings().first()
    except Exception as exc:
        if not _is_missing_table_error(exc, "usage_counters"):
            raise
        _safe_rollback(session)
        return 0
    return int((row or {}).get("count") or 0)


def _increment_usage_counter(
    session: Session,
    *,
    user_id: str,
    metric: str,
    quantity: int,
    project_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    auto_commit: bool,
) -> int:
    if not _supports_execute(session):
        return 0
    project_scope = project_id or PROJECT_SCOPE_GLOBAL
    period_start = date.today()
    counter_id = str(uuid.uuid4())
    try:
        session.execute(
            text(
                """
                INSERT INTO usage_counters (id, user_id, project_id, project_scope, metric, period_start, count, updated_at)
                VALUES (:id, :user_id, :project_id, :project_scope, :metric, :period_start, :count, NOW())
                ON CONFLICT (user_id, project_scope, metric, period_start)
                DO UPDATE SET
                  count = usage_counters.count + EXCLUDED.count,
                  updated_at = NOW()
                """
            ),
            {
                "id": counter_id,
                "user_id": user_id,
                "project_id": project_id,
                "project_scope": project_scope,
                "metric": metric,
                "period_start": period_start,
                "count": int(quantity),
            },
        )

        session.execute(
            text(
                """
                INSERT INTO usage_events (id, user_id, project_id, project_scope, metric, quantity, metadata)
                VALUES (:id, :user_id, :project_id, :project_scope, :metric, :quantity, CAST(:metadata AS jsonb))
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "project_id": project_id,
                "project_scope": project_scope,
                "metric": metric,
                "quantity": int(quantity),
                "metadata": json.dumps(metadata or {}),
            },
        )
    except Exception as exc:
        if not (
            _is_missing_table_error(exc, "usage_counters")
            or _is_missing_table_error(exc, "usage_events")
        ):
            raise
        _safe_rollback(session)
        return 0

    if auto_commit:
        session.commit()

    return _metric_count(
        session,
        user_id=user_id,
        metric=metric,
        project_scope=project_scope,
        period_start=period_start,
    )


def emit_billing_event(
    session: Session,
    *,
    event_type: str,
    user_id: str,
    project_id: str | None,
    payload: dict[str, Any],
    auto_commit: bool = True,
) -> None:
    if not _supports_execute(session):
        return
    try:
        session.execute(
            text(
                """
                INSERT INTO billing_events (id, event_type, user_id, project_id, payload, delivered, delivery_attempts)
                VALUES (:id, :event_type, :user_id, :project_id, CAST(:payload AS jsonb), FALSE, 0)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "event_type": event_type,
                "user_id": user_id,
                "project_id": project_id,
                "payload": json.dumps(payload),
            },
        )
    except Exception as exc:
        if not _is_missing_table_error(exc, "billing_events"):
            raise
        _safe_rollback(session)
        return
    if auto_commit:
        session.commit()


def _enforce_daily_limit(
    session: Session,
    *,
    user_id: str,
    metric: str,
    limit: int,
    quantity: int,
    project_id: str | None = None,
    detail: str,
    auto_commit: bool,
) -> int:
    if limit <= 0:
        return _increment_usage_counter(
            session,
            user_id=user_id,
            metric=metric,
            quantity=quantity,
            project_id=project_id,
            auto_commit=auto_commit,
        )

    project_scope = project_id or PROJECT_SCOPE_GLOBAL
    period_start = date.today()
    used = _metric_count(
        session,
        user_id=user_id,
        metric=metric,
        project_scope=project_scope,
        period_start=period_start,
    )
    if used + quantity > limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)

    return _increment_usage_counter(
        session,
        user_id=user_id,
        metric=metric,
        quantity=quantity,
        project_id=project_id,
        auto_commit=auto_commit,
    )


def enforce_request_limit(
    session: Session,
    *,
    user_id: str,
    plan_tier: str,
    auto_commit: bool = True,
) -> int:
    if not _supports_execute(session):
        return 0
    limits = get_plan_limits(plan_tier)
    return _enforce_daily_limit(
        session,
        user_id=user_id,
        metric="requests",
        limit=int(limits["requests_per_day"]),
        quantity=1,
        project_id=None,
        detail="Daily API request limit reached for your plan.",
        auto_commit=auto_commit,
    )


def enforce_query_limit(
    session: Session,
    *,
    user_id: str,
    plan_tier: str,
    project_id: str | None,
    auto_commit: bool = True,
) -> None:
    if not _supports_execute(session):
        return
    limits = get_plan_limits(plan_tier)
    _enforce_daily_limit(
        session,
        user_id=user_id,
        metric="queries",
        limit=int(limits["queries_per_day"]),
        quantity=1,
        project_id=None,
        detail="Daily query limit reached for your plan.",
        auto_commit=False,
    )
    if project_id:
        _enforce_daily_limit(
            session,
            user_id=user_id,
            metric="project_queries",
            limit=int(limits["queries_per_project_per_day"]),
            quantity=1,
            project_id=project_id,
            detail="Project query limit reached for your plan.",
            auto_commit=False,
        )
    if auto_commit:
        _safe_commit(session)


def enforce_indexing_limit(
    session: Session,
    *,
    user_id: str,
    plan_tier: str,
    project_id: str | None,
    auto_commit: bool = True,
) -> None:
    if not _supports_execute(session):
        return
    limits = get_plan_limits(plan_tier)
    _enforce_daily_limit(
        session,
        user_id=user_id,
        metric="index_jobs",
        limit=int(limits["index_jobs_per_day"]),
        quantity=1,
        project_id=None,
        detail="Daily indexing limit reached for your plan.",
        auto_commit=False,
    )
    if project_id:
        _enforce_daily_limit(
            session,
            user_id=user_id,
            metric="project_index_jobs",
            limit=int(limits["index_jobs_per_project_per_day"]),
            quantity=1,
            project_id=project_id,
            detail="Project indexing limit reached for your plan.",
            auto_commit=False,
        )
    if auto_commit:
        _safe_commit(session)


def enforce_project_creation_limit(session: Session, *, user_id: str, plan_tier: str) -> None:
    limit = int(get_plan_limits(plan_tier)["max_projects"])
    if limit <= 0:
        return
    row = session.execute(
        text("SELECT COUNT(*) AS total FROM projects WHERE created_by = :user_id"),
        {"user_id": user_id},
    ).mappings().first()
    total = int((row or {}).get("total") or 0)
    if total >= limit:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project limit reached for your plan.")


def enforce_repository_limit(session: Session, *, project_id: str, plan_tier: str) -> None:
    limit = int(get_plan_limits(plan_tier)["max_repositories_per_project"])
    if limit <= 0:
        return
    row = session.execute(
        text("SELECT COUNT(*) AS total FROM repositories WHERE project_id = :project_id"),
        {"project_id": project_id},
    ).mappings().first()
    total = int((row or {}).get("total") or 0)
    if total >= limit:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Repository limit reached for your plan.")


def record_query_usage(
    session: Session,
    *,
    user_id: str,
    project_id: str | None,
    query: str,
    answer: str,
    retrieved_count: int,
    auto_commit: bool = True,
) -> None:
    if not _supports_execute(session):
        return
    tokens_in = estimate_tokens(query)
    tokens_out = estimate_tokens(answer)
    _increment_usage_counter(
        session,
        user_id=user_id,
        metric="llm_tokens_in",
        quantity=tokens_in,
        project_id=project_id,
        metadata={"kind": "query"},
        auto_commit=False,
    )
    _increment_usage_counter(
        session,
        user_id=user_id,
        metric="llm_tokens_out",
        quantity=tokens_out,
        project_id=project_id,
        metadata={"kind": "query"},
        auto_commit=False,
    )
    if retrieved_count > 0:
        _increment_usage_counter(
            session,
            user_id=user_id,
            metric="retrieved_chunks",
            quantity=int(retrieved_count),
            project_id=project_id,
            metadata={"kind": "query"},
            auto_commit=False,
        )

    emit_billing_event(
        session,
        event_type="usage.query",
        user_id=user_id,
        project_id=project_id,
        payload={
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "retrieved_chunks": int(retrieved_count),
        },
        auto_commit=False,
    )
    if auto_commit:
        _safe_commit(session)


def record_indexing_usage(
    session: Session,
    *,
    user_id: str,
    project_id: str | None,
    indexed_chunks: int,
    files_processed: int,
    auto_commit: bool = True,
) -> None:
    if not _supports_execute(session):
        return
    _increment_usage_counter(
        session,
        user_id=user_id,
        metric="indexing_volume_chunks",
        quantity=max(0, int(indexed_chunks)),
        project_id=project_id,
        metadata={"files_processed": int(files_processed)},
        auto_commit=False,
    )
    emit_billing_event(
        session,
        event_type="usage.indexing",
        user_id=user_id,
        project_id=project_id,
        payload={
            "indexed_chunks": max(0, int(indexed_chunks)),
            "files_processed": max(0, int(files_processed)),
        },
        auto_commit=False,
    )
    if auto_commit:
        _safe_commit(session)


def create_api_key(
    session: Session,
    *,
    user_id: str,
    role: str,
    name: str,
    scopes: list[str] | None,
    expires_in_days: int | None,
) -> dict[str, Any]:
    selected_scopes = sanitize_requested_scopes(scopes, role=role)

    public_part = secrets.token_hex(6)
    secret_part = secrets.token_urlsafe(24)
    prefix = f"{settings.api_key_prefix}_{public_part}"
    raw_key = f"{prefix}_{secret_part}"
    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    expires_at = None
    if expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=int(expires_in_days))

    key_id = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, is_active, expires_at)
            VALUES (:id, :user_id, :name, :key_prefix, :key_hash, CAST(:scopes AS jsonb), TRUE, :expires_at)
            """
        ),
        {
            "id": key_id,
            "user_id": user_id,
            "name": name,
            "key_prefix": prefix,
            "key_hash": key_hash,
            "scopes": json.dumps(selected_scopes),
            "expires_at": expires_at,
        },
    )
    session.commit()

    return {
        "id": key_id,
        "name": name,
        "key_prefix": prefix,
        "api_key": raw_key,
        "scopes": selected_scopes,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "expires_at": expires_at.isoformat() if expires_at else None,
    }


def list_api_keys(session: Session, *, user_id: str) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            """
            SELECT id, name, key_prefix, scopes, is_active, created_at, last_used_at, expires_at
            FROM api_keys
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            """
        ),
        {"user_id": user_id},
    ).mappings().all()

    items: list[dict[str, Any]] = []
    for row in rows:
        scopes = row.get("scopes")
        if isinstance(scopes, str):
            try:
                scopes = json.loads(scopes)
            except Exception:
                scopes = []
        items.append(
            {
                "id": str(row.get("id") or ""),
                "name": str(row.get("name") or ""),
                "key_prefix": str(row.get("key_prefix") or ""),
                "scopes": [str(scope) for scope in (scopes or [])],
                "is_active": bool(row.get("is_active", False)),
                "created_at": str(row.get("created_at") or ""),
                "last_used_at": str(row.get("last_used_at") or "") if row.get("last_used_at") else None,
                "expires_at": str(row.get("expires_at") or "") if row.get("expires_at") else None,
            }
        )
    return items


def revoke_api_key(session: Session, *, user_id: str, api_key_id: str) -> bool:
    result = session.execute(
        text(
            """
            UPDATE api_keys
            SET is_active = FALSE
            WHERE id = :id AND user_id = :user_id AND is_active = TRUE
            """
        ),
        {"id": api_key_id, "user_id": user_id},
    )
    session.commit()
    return bool(getattr(result, "rowcount", 0))


def authenticate_api_key(session: Session, raw_api_key: str) -> dict[str, Any] | None:
    value = str(raw_api_key or "").strip()
    prefix = settings.api_key_prefix + "_"
    if not value.startswith(prefix):
        return None

    key_prefix = "_".join(value.split("_", 2)[:2])
    key_hash = hashlib.sha256(value.encode("utf-8")).hexdigest()

    row = session.execute(
        text(
            """
            SELECT
              k.id AS key_id,
              k.user_id,
              k.scopes,
              u.id,
              u.email,
              u.full_name,
              u.role,
              u.is_active,
              u.plan_tier
            FROM api_keys k
            JOIN users u ON u.id = k.user_id
            WHERE k.key_prefix = :key_prefix
              AND k.key_hash = :key_hash
              AND k.is_active = TRUE
              AND (k.expires_at IS NULL OR k.expires_at > NOW())
            LIMIT 1
            """
        ),
        {"key_prefix": key_prefix, "key_hash": key_hash},
    ).mappings().first()

    if not row or not bool(row.get("is_active", False)):
        return None

    session.execute(
        text("UPDATE api_keys SET last_used_at = NOW() WHERE id = :id"),
        {"id": row.get("key_id")},
    )
    session.commit()

    scopes = row.get("scopes")
    if isinstance(scopes, str):
        try:
            scopes = json.loads(scopes)
        except Exception:
            scopes = []

    return {
        "id": str(row.get("id") or ""),
        "email": str(row.get("email") or ""),
        "full_name": row.get("full_name"),
        "role": normalize_role(str(row.get("role") or "USER")),
        "is_active": bool(row.get("is_active", False)),
        "plan_tier": normalize_plan_tier(str(row.get("plan_tier") or PLAN_FREE)),
        "token_scopes": [str(scope) for scope in (scopes or [])],
        "auth_method": "api_key",
    }
