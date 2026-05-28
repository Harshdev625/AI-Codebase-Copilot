from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.roles import normalize_role
from app.core.security import decode_access_token
from app.db.database import get_db_session
from app.core.exceptions import AuthenticationException, AuthorizationException, NotFoundException
from app.core.roles import ROLE_ADMIN, ROLE_USER
from app.db.models import Repository, User


def default_scopes_for_role(role: str) -> list[str]:
    normalized = normalize_role(role)
    if normalized == ROLE_ADMIN:
        return ["*"]
    if normalized == ROLE_USER:
        return [
            "repository:read",
            "repository:write",
            "indexing:write",
            "chat:query",
        ]
    return []

bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PaginationParams:
    limit: int
    offset: int


def get_pagination(
    limit: int = Query(default=20, ge=1, le=200),
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


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_db_session),
    request: Request = None,
) -> dict:
    token_scopes: list[str] = []
    auth_method = "bearer"
    user_id = ""

    if credentials is not None and str(credentials.scheme).lower() == "bearer":
        token = str(credentials.credentials or "").strip()
        if not token:
            logger.warning("auth - empty bearer token")
            raise AuthenticationException("Missing bearer token")

        try:
            payload = decode_access_token(token)
        except ValueError as exc:
            logger.warning("auth - token decode failed error=%s", exc)
            raise AuthenticationException(str(exc)) from exc

        user_id = str(payload.get("sub", ""))
        if not user_id:
            logger.warning("auth - token missing subject")
            raise AuthenticationException("Invalid token subject")

        token_scopes = _normalize_scopes(payload.get("scopes"))
    else:
        logger.warning("auth - missing bearer token")
        raise AuthenticationException("Missing bearer token")

    user_row = session.query(User).filter(User.id == user_id).first()
    if user_row is None:
        logger.warning("auth - user not found user_id=%s", user_id)
        raise AuthenticationException("User not found")
    if not bool(user_row.is_active):
        logger.warning("auth - user inactive user_id=%s", user_id)
        raise AuthenticationException("User not active")

    user = {
        "id": str(user_row.id),
        "email": str(user_row.email),
        "full_name": str(user_row.full_name) if user_row.full_name else None,
        "role": str(user_row.role),
        "is_active": bool(user_row.is_active),
    }
    user["role"] = normalize_role(user.get("role"))
    user["token_scopes"] = token_scopes or default_scopes_for_role(user.get("role"))
    user["auth_method"] = auth_method

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
            raise AuthorizationException("Insufficient role")
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
        raise AuthorizationException("Insufficient token scopes")


def require_scopes(required_scopes: set[str]):
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        assert_scopes(current_user, required_scopes)
        return current_user

    return checker


def ensure_repository_access(session: Session, repo_id: str, user_id: str) -> dict:
    logger.debug("repository_access - by repo_id requested repo_id=%s user_id=%s", repo_id, user_id)
    repo = (
        session.query(Repository)
        .filter(Repository.owner_user_id == user_id)
        .filter(Repository.repo_id.ilike(repo_id))
        .first()
    )
    if repo is not None:
        logger.debug("repository_access - by repo_id granted repo_id=%s user_id=%s", repo_id, user_id)
        return {
            "id": str(repo.id),
            "owner_user_id": str(repo.owner_user_id),
            "repo_id": str(repo.repo_id),
            "remote_url": str(repo.remote_url) if repo.remote_url else None,
            "local_path": str(repo.local_path) if repo.local_path else None,
            "default_branch": str(repo.default_branch),
        }

    repository_exists = session.query(Repository.id).filter(Repository.repo_id.ilike(repo_id)).first()
    if repository_exists is None:
        logger.warning("repository_access - repo not found repo_id=%s user_id=%s", repo_id, user_id)
        raise NotFoundException("Repository", repo_id)
    logger.warning("repository_access - forbidden repo_id=%s user_id=%s", repo_id, user_id)
    raise AuthorizationException("Not authorized for this repository")


def ensure_repository_access_by_id(session: Session, repository_id: str, user_id: str) -> dict:
    logger.debug(
        "repository_access - by repository_id requested repository_id=%s user_id=%s",
        repository_id,
        user_id,
    )
    repo = (
        session.query(Repository)
        .filter(Repository.id == repository_id, Repository.owner_user_id == user_id)
        .first()
    )
    if repo is not None:
        logger.debug(
            "repository_access - by repository_id granted repository_id=%s user_id=%s",
            repository_id,
            user_id,
        )
        return {
            "id": str(repo.id),
            "owner_user_id": str(repo.owner_user_id),
            "repo_id": str(repo.repo_id),
            "remote_url": str(repo.remote_url) if repo.remote_url else None,
            "local_path": str(repo.local_path) if repo.local_path else None,
            "default_branch": str(repo.default_branch),
        }

    repository_exists = session.query(Repository.id).filter(Repository.id == repository_id).first()
    if repository_exists is None:
        logger.warning(
            "repository_access - repository not found repository_id=%s user_id=%s",
            repository_id,
            user_id,
        )
        raise NotFoundException("Repository", repository_id)
    logger.warning("repository_access - forbidden repository_id=%s user_id=%s", repository_id, user_id)
    raise AuthorizationException("Not authorized for this repository")