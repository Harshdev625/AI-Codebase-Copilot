from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import get_db_session

bearer_scheme = HTTPBearer(auto_error=False)


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

    if row is None or not row["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not active")

    return dict(row)


def require_roles(allowed_roles: set[str]):
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = str(current_user.get("role", ""))
        if user_role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return current_user

    return checker


def ensure_repository_access(session: Session, repo_id: str, user_id: str) -> dict:
    row = session.execute(
        text(
            """
            SELECT r.id, r.project_id, r.repo_id, r.remote_url, r.local_path, r.default_branch
            FROM repositories r
            JOIN project_memberships pm ON pm.project_id = r.project_id
            WHERE r.repo_id = :repo_id AND pm.user_id = :user_id
            LIMIT 1
            """
        ),
        {"repo_id": repo_id, "user_id": user_id},
    ).mappings().first()
    if row is not None:
        return dict(row)

    repository_exists = session.execute(
        text("SELECT id FROM repositories WHERE repo_id = :repo_id LIMIT 1"),
        {"repo_id": repo_id},
    ).first()
    if repository_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this repository")