from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.roles import normalize_role
from app.core.security import decode_access_token
from app.db.database import get_db_session

bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_db_session),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    user_id = str(payload.get("sub", ""))
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    row = session.execute(
        text(
            """
            SELECT id, email, full_name, role, is_active
            FROM users
            WHERE id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not row["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not active")

    user = dict(row)
    user["role"] = normalize_role(user.get("role"))
    return user


def require_roles(allowed_roles: set[str]):
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        normalized_allowed_roles = {normalize_role(role) for role in allowed_roles}
        user_role = normalize_role(str(current_user.get("role", "")))
        if user_role not in normalized_allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        current_user["role"] = user_role
        return current_user

    return checker


def ensure_repository_access(session: Session, repo_id: str, user_id: str) -> dict:
    rows = session.execute(
        text(
            """
            SELECT r.id, r.project_id, r.repo_id, r.remote_url, r.local_path, r.default_branch
            FROM repositories r
            JOIN project_memberships pm ON pm.project_id = r.project_id
            WHERE LOWER(r.repo_id) = LOWER(:repo_id) AND pm.user_id = :user_id
            ORDER BY r.created_at DESC
            LIMIT 2
            """
        ),
        {"repo_id": repo_id, "user_id": user_id},
    ).mappings().all()

    if len(rows) == 1:
        return dict(rows[0])

    if len(rows) > 1:
        logger.warning(
            "Ambiguous repository access repo_id=%s user_id=%s count=%s",
            repo_id,
            user_id,
            len(rows),
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository identifier is ambiguous across multiple projects",
        )

    repository_exists = session.execute(
        text("SELECT id FROM repositories WHERE LOWER(repo_id) = LOWER(:repo_id) LIMIT 1"),
        {"repo_id": repo_id},
    ).first()
    if repository_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this repository")


def ensure_repository_access_by_id(session: Session, repository_id: str, user_id: str) -> dict:
    row = session.execute(
        text(
            """
            SELECT r.id, r.project_id, r.repo_id, r.remote_url, r.local_path, r.default_branch
            FROM repositories r
            JOIN project_memberships pm ON pm.project_id = r.project_id
            WHERE r.id = :repository_id AND pm.user_id = :user_id
            LIMIT 1
            """
        ),
        {"repository_id": repository_id, "user_id": user_id},
    ).mappings().first()

    if row is not None:
        return dict(row)

    repository_exists = session.execute(
        text("SELECT id FROM repositories WHERE id = :repository_id LIMIT 1"),
        {"repository_id": repository_id},
    ).first()
    if repository_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this repository")