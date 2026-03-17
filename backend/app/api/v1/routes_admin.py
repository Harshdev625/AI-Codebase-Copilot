from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.database import get_db_session

router = APIRouter(tags=["admin"])


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