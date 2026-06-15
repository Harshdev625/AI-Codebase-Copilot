from __future__ import annotations

import logging
import uuid
from hmac import compare_digest

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.api_response import success_response
from app.core.config import settings
from app.core.exceptions import (
    AuthenticationException,
    AuthorizationException,
    DatabaseException,
    DuplicateException,
    ServiceException,
)
from app.core.roles import ROLE_ADMIN, ROLE_USER, normalize_role
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db_session
from app.db.models import User
from app.models.api_models import (
    AuthAdminRegisterRequest,
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
    UserResponse,
)
from app.api.dependencies import default_scopes_for_role

router = APIRouter(tags=["auth"])
logger = logging.getLogger(__name__)

@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(req: AuthRegisterRequest, session: Session = Depends(get_db_session)) -> UserResponse:
    logger.info("auth_register - request received email=%s", req.email.lower())
    
    # H1 FIX: Use ORM instead of raw SQL
    existing = session.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        logger.warning("auth_register - duplicate email=%s", req.email.lower())
        raise DuplicateException("User", req.email.lower())

    user_id = str(uuid.uuid4())
    try:
        user = User(
            id=user_id,
            email=req.email.lower(),
            password_hash=hash_password(req.password),
            full_name=req.full_name,
            role=ROLE_USER,
            is_active=True,
        )
        session.add(user)
        session.commit()
    except Exception as exc:
        # C4 FIX: Rollback on any error before raising
        session.rollback()
        logger.exception("auth_register - database error user_id=%s", user_id)
        raise DatabaseException("Registration failed") from exc
    
    logger.info("auth_register - user created user_id=%s email=%s", user_id, req.email.lower())

    return success_response(
        UserResponse(
            id=user_id,
            email=req.email.lower(),
            full_name=req.full_name,
            role=ROLE_USER,
            token_scopes=default_scopes_for_role(ROLE_USER),
            is_active=True,
        ).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/auth/admin/register", status_code=status.HTTP_201_CREATED)
def admin_register(req: AuthAdminRegisterRequest, session: Session = Depends(get_db_session)) -> UserResponse:
    logger.info("admin_register - request received email=%s", req.email.lower())

    invite_token = (req.invite_token or "").strip()
    secret_key = (req.admin_secret_key or "").strip()

    if invite_token:
        from app.services.admin_invite_service import validate_and_consume_admin_invite

        validate_and_consume_admin_invite(
            session,
            email=req.email.lower(),
            invite_token=invite_token,
        )
    else:
        configured_secret = settings.admin_registration_secret_key.strip()
        if not configured_secret:
            logger.warning("admin_register - admin registration disabled")
            raise ServiceException("Admin registration is disabled")

        if not compare_digest(secret_key, configured_secret):
            logger.warning("admin_register - invalid secret email=%s", req.email.lower())
            raise AuthorizationException("Invalid admin secret key")

    # H1 FIX: Use ORM instead of raw SQL
    existing = session.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        logger.warning("admin_register - duplicate email=%s", req.email.lower())
        raise DuplicateException("User", req.email.lower())

    user_id = str(uuid.uuid4())
    try:
        user = User(
            id=user_id,
            email=req.email.lower(),
            password_hash=hash_password(req.password),
            full_name=req.full_name,
            role=ROLE_ADMIN,
            is_active=True,
        )
        session.add(user)
        session.commit()
    except Exception as exc:
        # C4 FIX: Rollback on any error before raising
        session.rollback()
        logger.exception("admin_register - database error user_id=%s", user_id)
        raise DatabaseException("Registration failed") from exc
    
    logger.info("admin_register - admin user created user_id=%s email=%s", user_id, req.email.lower())

    return success_response(
        UserResponse(
            id=user_id,
            email=req.email.lower(),
            full_name=req.full_name,
            role=ROLE_ADMIN,
            token_scopes=default_scopes_for_role(ROLE_ADMIN),
            is_active=True,
        ).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/admin/auth/register", tags=["admin"], status_code=status.HTTP_201_CREATED)
def admin_register_alias(req: AuthAdminRegisterRequest, session: Session = Depends(get_db_session)) -> UserResponse:
    """Alias for admin registration under /admin/* to keep admin functionality grouped."""
    return admin_register(req, session)


@router.post("/auth/login")
def login(req: AuthLoginRequest, session: Session = Depends(get_db_session)) -> AuthTokenResponse:
    logger.info("auth_login - request received email=%s", req.email.lower())
    
    # H1 FIX: Use ORM instead of raw SQL
    user_row = session.query(User).filter(User.email == req.email.lower()).first()

    if user_row is None or not verify_password(req.password, user_row.password_hash):
        logger.warning("auth_login - invalid credentials email=%s", req.email.lower())
        raise AuthenticationException("Invalid credentials")
    if not user_row.is_active:
        logger.warning("auth_login - inactive user email=%s", req.email.lower())
        raise AuthorizationException("User is inactive")

    role = normalize_role(str(user_row.role))
    token = create_access_token(
        subject=user_row.id,
        claims={
            "scopes": default_scopes_for_role(role),
        },
    )
    logger.info("auth_login - login success user_id=%s", user_row.id)
    return success_response(AuthTokenResponse(access_token=token).model_dump())


@router.post("/auth/admin/login")
def admin_login(req: AuthLoginRequest, session: Session = Depends(get_db_session)) -> AuthTokenResponse:
    logger.info("admin_login - request received email=%s", req.email.lower())
    
    # H1 FIX: Use ORM instead of raw SQL
    user_row = session.query(User).filter(User.email == req.email.lower()).first()

    if user_row is None or not verify_password(req.password, user_row.password_hash):
        logger.warning("admin_login - invalid credentials email=%s", req.email.lower())
        raise AuthenticationException("Invalid credentials")
    if not user_row.is_active:
        logger.warning("admin_login - inactive user email=%s", req.email.lower())
        raise AuthorizationException("User is inactive")
    if normalize_role(user_row.role) != ROLE_ADMIN:
        logger.warning("admin_login - non-admin attempted login email=%s", req.email.lower())
        raise AuthorizationException("Admin account required")

    role = normalize_role(str(user_row.role))
    token = create_access_token(
        subject=user_row.id,
        claims={
            "scopes": default_scopes_for_role(role),
        },
    )
    logger.info("admin_login - login success user_id=%s", user_row.id)
    return success_response(AuthTokenResponse(access_token=token).model_dump())


@router.post("/admin/auth/login", tags=["admin"])
def admin_login_alias(req: AuthLoginRequest, session: Session = Depends(get_db_session)) -> AuthTokenResponse:
    """Alias for admin login under /admin/* to keep admin functionality grouped."""
    return admin_login(req, session)


@router.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    logger.info("auth_me - request received user_id=%s", current_user["id"])
    return success_response(
        UserResponse(
            id=current_user["id"],
            email=current_user["email"],
            full_name=current_user.get("full_name"),
            role=normalize_role(current_user["role"]),
            token_scopes=[str(scope) for scope in current_user.get("token_scopes", [])],
            is_active=bool(current_user["is_active"]),
        ).model_dump()
    )