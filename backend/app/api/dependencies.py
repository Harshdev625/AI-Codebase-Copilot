from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.roles import normalize_role
from app.core.security import decode_access_token
from app.db.database import get_db_session
from app.services.saas_service import (
    authenticate_api_key,
    default_scopes_for_role,
    enforce_request_limit,
    normalize_plan_tier,
)

bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PaginationParams:
    limit: int
    offset: int


def get_pagination(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=10_000),
) -> PaginationParams:
    return PaginationParams(limit=limit, offset=offset)


def resolve_pagination(
    pagination: object | None,
    *,
    default_limit: int = 50,
    default_offset: int = 0,
) -> PaginationParams:
    if isinstance(pagination, PaginationParams):
        return pagination
    return PaginationParams(limit=default_limit, offset=default_offset)


def _normalize_scopes(raw_scopes: object) -> list[str]:
    if raw_scopes is None:
        return []
    if isinstance(raw_scopes, str):
        candidates = [segment.strip() for segment in raw_scopes.replace(",", " ").split(" ")]
    elif isinstance(raw_scopes, (list, tuple, set)):
        candidates = [str(segment).strip() for segment in raw_scopes]
    else:
        candidates = []
    seen: set[str] = set()
    normalized: list[str] = []
    for scope in candidates:
        value = scope.lower()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _is_missing_plan_tier_column_error(exc: Exception) -> bool:
    return "no such column" in str(exc).lower() and "plan_tier" in str(exc).lower()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_db_session),
    request: Request = None,
) -> dict:
    token_scopes: list[str] = []
    plan_tier: str | None = None
    auth_method = "bearer"
    user_id = ""
    api_key_value = str((request.headers.get("x-api-key") if request is not None else "") or "").strip()

    if credentials is not None and str(credentials.scheme).lower() == "bearer":
        token = str(credentials.credentials or "").strip()
        if not token:
            logger.warning("auth - empty bearer token")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

        try:
            payload = decode_access_token(token)
        except ValueError as exc:
            logger.warning("auth - token decode failed error=%s", exc)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

        user_id = str(payload.get("sub", ""))
        if not user_id:
            logger.warning("auth - token missing subject")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

        token_scopes = _normalize_scopes(payload.get("scopes"))
        plan_tier = normalize_plan_tier(str(payload.get("plan_tier") or ""))
    elif api_key_value:
        api_key_user = authenticate_api_key(session, api_key_value)
        if not api_key_user:
            logger.warning("auth - invalid api key")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        user_id = str(api_key_user.get("id") or "")
        token_scopes = _normalize_scopes(api_key_user.get("token_scopes"))
        plan_tier = normalize_plan_tier(str(api_key_user.get("plan_tier") or ""))
        auth_method = "api_key"
    else:
        logger.warning("auth - missing bearer token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        row = session.execute(
            text(
                """
                SELECT id, email, full_name, role, is_active, plan_tier
                FROM users
                WHERE id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().first()
    except Exception as exc:
        if not _is_missing_plan_tier_column_error(exc):
            raise
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
        logger.warning("auth - user not found user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not row["is_active"]:
        logger.warning("auth - user inactive user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not active")

    user = dict(row)
    user["role"] = normalize_role(user.get("role"))
    user["plan_tier"] = normalize_plan_tier(str(user.get("plan_tier") or plan_tier or "free"))
    user["token_scopes"] = token_scopes or default_scopes_for_role(user.get("role"))
    user["auth_method"] = auth_method

    if request is not None and str(request.url.path).startswith("/v1"):
        try:
            enforce_request_limit(session, user_id=str(user["id"]), plan_tier=str(user["plan_tier"]), auto_commit=True)
        except HTTPException:
            raise
        except Exception:
            logger.exception("auth - request quota check failed user_id=%s", user.get("id"))

    logger.debug("auth - authenticated user_id=%s role=%s", user.get("id"), user.get("role"))
    return user


def require_roles(allowed_roles: set[str]):
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        normalized_allowed_roles = {normalize_role(role) for role in allowed_roles}
        user_role = normalize_role(str(current_user.get("role", "")))
        if user_role not in normalized_allowed_roles:
            logger.warning(
                "authz - insufficient role user_id=%s user_role=%s required=%s",
                current_user.get("id"),
                user_role,
                sorted(normalized_allowed_roles),
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        current_user["role"] = user_role
        logger.debug("authz - role permitted user_id=%s role=%s", current_user.get("id"), user_role)
        return current_user

    return checker


def assert_scopes(current_user: dict, required_scopes: set[str]) -> None:
    raw_scopes = current_user.get("token_scopes", [])
    if not raw_scopes and not current_user.get("role"):
        return
    granted = {str(scope).strip().lower() for scope in raw_scopes}
    if not granted:
        granted = {str(scope).strip().lower() for scope in default_scopes_for_role(str(current_user.get("role") or ""))}
    if "*" in granted or "admin:write" in granted:
        return

    missing = [scope for scope in sorted(required_scopes) if scope.lower() not in granted]
    if missing:
        logger.warning(
            "authz - missing scopes user_id=%s missing=%s granted=%s",
            current_user.get("id"),
            missing,
            sorted(granted),
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient token scopes")


def require_scopes(required_scopes: set[str]):
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        assert_scopes(current_user, required_scopes)
        return current_user

    return checker


def ensure_repository_access(session: Session, repo_id: str, user_id: str) -> dict:
    logger.debug("repository_access - by repo_id requested repo_id=%s user_id=%s", repo_id, user_id)
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
        logger.debug("repository_access - by repo_id granted repo_id=%s user_id=%s", repo_id, user_id)
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
        logger.warning("repository_access - repo not found repo_id=%s user_id=%s", repo_id, user_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    logger.warning("repository_access - forbidden repo_id=%s user_id=%s", repo_id, user_id)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this repository")


def ensure_repository_access_by_id(session: Session, repository_id: str, user_id: str) -> dict:
    logger.debug(
        "repository_access - by repository_id requested repository_id=%s user_id=%s",
        repository_id,
        user_id,
    )
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
        logger.debug(
            "repository_access - by repository_id granted repository_id=%s user_id=%s",
            repository_id,
            user_id,
        )
        return dict(row)

    repository_exists = session.execute(
        text("SELECT id FROM repositories WHERE id = :repository_id LIMIT 1"),
        {"repository_id": repository_id},
    ).first()
    if repository_exists is None:
        logger.warning(
            "repository_access - repository not found repository_id=%s user_id=%s",
            repository_id,
            user_id,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    logger.warning("repository_access - forbidden repository_id=%s user_id=%s", repository_id, user_id)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this repository")