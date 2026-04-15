from __future__ import annotations

import logging
import uuid
from hmac import compare_digest

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import assert_scopes, get_current_user
from app.core.api_response import success_response
from app.core.config import settings
from app.core.roles import ROLE_ADMIN, ROLE_USER, normalize_role
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db_session
from app.models.api_models import (
    AuthAdminRegisterRequest,
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyResponse,
    UserResponse,
)
from app.services.saas_service import (
    create_api_key,
    default_scopes_for_role,
    list_api_keys,
    normalize_plan_tier,
    revoke_api_key,
)

router = APIRouter(tags=["auth"])
logger = logging.getLogger(__name__)


def _is_missing_plan_tier_column_error(exc: Exception) -> bool:
    return "no such column" in str(exc).lower() and "plan_tier" in str(exc).lower()


def _is_missing_plan_tier_insert_error(exc: Exception) -> bool:
    text_exc = str(exc).lower()
    return "plan_tier" in text_exc and ("no column named" in text_exc or "has no column named" in text_exc)


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(req: AuthRegisterRequest, session: Session = Depends(get_db_session)) -> UserResponse:
    logger.info("auth_register - request received email=%s", req.email.lower())
    existing = session.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": req.email.lower()},
    ).first()
    if existing:
        logger.warning("auth_register - duplicate email=%s", req.email.lower())
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    try:
        session.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, full_name, role, plan_tier, is_active)
                VALUES (:id, :email, :password_hash, :full_name, :role, :plan_tier, TRUE)
                """
            ),
            {
                "id": user_id,
                "email": req.email.lower(),
                "password_hash": hash_password(req.password),
                "full_name": req.full_name,
                "role": ROLE_USER,
                "plan_tier": "free",
            },
        )
    except Exception as exc:
        if not _is_missing_plan_tier_insert_error(exc):
            raise
        session.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, full_name, role, is_active)
                VALUES (:id, :email, :password_hash, :full_name, :role, TRUE)
                """
            ),
            {
                "id": user_id,
                "email": req.email.lower(),
                "password_hash": hash_password(req.password),
                "full_name": req.full_name,
                "role": ROLE_USER,
            },
        )
    session.commit()
    logger.info("auth_register - user created user_id=%s email=%s", user_id, req.email.lower())

    return success_response(
        UserResponse(
            id=user_id,
            email=req.email.lower(),
            full_name=req.full_name,
            role=ROLE_USER,
            plan_tier="free",
            token_scopes=default_scopes_for_role(ROLE_USER),
            is_active=True,
        ).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/auth/admin/register", status_code=status.HTTP_201_CREATED)
def admin_register(req: AuthAdminRegisterRequest, session: Session = Depends(get_db_session)) -> UserResponse:
    logger.info("admin_register - request received email=%s", req.email.lower())
    configured_secret = settings.admin_registration_secret_key.strip()
    if not configured_secret:
        logger.warning("admin_register - admin registration disabled")
        raise HTTPException(status_code=503, detail="Admin registration is disabled")

    if not compare_digest(req.admin_secret_key, configured_secret):
        logger.warning("admin_register - invalid secret email=%s", req.email.lower())
        raise HTTPException(status_code=403, detail="Invalid admin secret key")

    existing = session.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": req.email.lower()},
    ).first()
    if existing:
        logger.warning("admin_register - duplicate email=%s", req.email.lower())
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    try:
        session.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, full_name, role, plan_tier, is_active)
                VALUES (:id, :email, :password_hash, :full_name, :role, :plan_tier, TRUE)
                """
            ),
            {
                "id": user_id,
                "email": req.email.lower(),
                "password_hash": hash_password(req.password),
                "full_name": req.full_name,
                "role": ROLE_ADMIN,
                "plan_tier": "enterprise",
            },
        )
    except Exception as exc:
        if not _is_missing_plan_tier_insert_error(exc):
            raise
        session.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, full_name, role, is_active)
                VALUES (:id, :email, :password_hash, :full_name, :role, TRUE)
                """
            ),
            {
                "id": user_id,
                "email": req.email.lower(),
                "password_hash": hash_password(req.password),
                "full_name": req.full_name,
                "role": ROLE_ADMIN,
            },
        )
    session.commit()
    logger.info("admin_register - admin user created user_id=%s email=%s", user_id, req.email.lower())

    return success_response(
        UserResponse(
            id=user_id,
            email=req.email.lower(),
            full_name=req.full_name,
            role=ROLE_ADMIN,
            plan_tier="enterprise",
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
    try:
        row = session.execute(
            text(
                """
                SELECT id, password_hash, is_active, role, plan_tier
                FROM users
                WHERE email = :email
                """
            ),
            {"email": req.email.lower()},
        ).mappings().first()
    except Exception as exc:
        if not _is_missing_plan_tier_column_error(exc):
            raise
        row = session.execute(
            text(
                """
                SELECT id, password_hash, is_active, role
                FROM users
                WHERE email = :email
                """
            ),
            {"email": req.email.lower()},
        ).mappings().first()

    if row is None or not verify_password(req.password, row["password_hash"]):
        logger.warning("auth_login - invalid credentials email=%s", req.email.lower())
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not row["is_active"]:
        logger.warning("auth_login - inactive user email=%s", req.email.lower())
        raise HTTPException(status_code=403, detail="User is inactive")

    role = normalize_role(str(row.get("role") or ROLE_USER))
    plan_tier = normalize_plan_tier(str(row.get("plan_tier") or "free"))
    token = create_access_token(
        subject=row["id"],
        claims={
            "scopes": default_scopes_for_role(role),
            "plan_tier": plan_tier,
        },
    )
    logger.info("auth_login - login success user_id=%s", row["id"])
    return success_response(AuthTokenResponse(access_token=token).model_dump())


@router.post("/auth/admin/login")
def admin_login(req: AuthLoginRequest, session: Session = Depends(get_db_session)) -> AuthTokenResponse:
    logger.info("admin_login - request received email=%s", req.email.lower())
    row = session.execute(
        text(
            """
            SELECT id, password_hash, is_active, role
            FROM users
            WHERE email = :email
            """
        ),
        {"email": req.email.lower()},
    ).mappings().first()

    if row is None or not verify_password(req.password, row["password_hash"]):
        logger.warning("admin_login - invalid credentials email=%s", req.email.lower())
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not row["is_active"]:
        logger.warning("admin_login - inactive user email=%s", req.email.lower())
        raise HTTPException(status_code=403, detail="User is inactive")
    if normalize_role(row["role"]) != ROLE_ADMIN:
        logger.warning("admin_login - non-admin attempted login email=%s", req.email.lower())
        raise HTTPException(status_code=403, detail="Admin account required")

    role = normalize_role(str(row.get("role") or ROLE_ADMIN))
    plan_tier = normalize_plan_tier(str(row.get("plan_tier") or "enterprise"))
    token = create_access_token(
        subject=row["id"],
        claims={
            "scopes": default_scopes_for_role(role),
            "plan_tier": plan_tier,
        },
    )
    logger.info("admin_login - login success user_id=%s", row["id"])
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
            plan_tier=normalize_plan_tier(str(current_user.get("plan_tier") or "free")),
            token_scopes=[str(scope) for scope in current_user.get("token_scopes", [])],
            is_active=bool(current_user["is_active"]),
        ).model_dump()
    )


@router.get("/auth/api-keys")
def auth_list_api_keys(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"apikey:read"})
    items = [ApiKeyResponse(**item).model_dump() for item in list_api_keys(session, user_id=str(current_user["id"]))]
    return success_response({"items": items})


@router.post("/auth/api-keys", status_code=status.HTTP_201_CREATED)
def auth_create_api_key(
    req: ApiKeyCreateRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"apikey:write"})
    if str(current_user.get("auth_method") or "") == "api_key":
        raise HTTPException(status_code=403, detail="Use bearer token auth to manage API keys")

    created = create_api_key(
        session,
        user_id=str(current_user["id"]),
        role=str(current_user.get("role") or ROLE_USER),
        name=req.name,
        scopes=req.scopes,
        expires_in_days=req.expires_in_days,
    )
    return success_response(ApiKeyCreateResponse(**created).model_dump(), status_code=status.HTTP_201_CREATED)


@router.delete("/auth/api-keys/{api_key_id}")
def auth_revoke_api_key(
    api_key_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"apikey:write"})
    deleted = revoke_api_key(session, user_id=str(current_user["id"]), api_key_id=api_key_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="API key not found")
    return success_response({"revoked": True})