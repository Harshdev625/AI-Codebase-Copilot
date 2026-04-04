from __future__ import annotations

import uuid
from hmac import compare_digest

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
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
    UserResponse,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(req: AuthRegisterRequest, session: Session = Depends(get_db_session)) -> UserResponse:
    existing = session.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": req.email.lower()},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
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

    return success_response(
        UserResponse(
            id=user_id,
            email=req.email.lower(),
            full_name=req.full_name,
            role=ROLE_USER,
            is_active=True,
        ).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/auth/admin/register", status_code=status.HTTP_201_CREATED)
def admin_register(req: AuthAdminRegisterRequest, session: Session = Depends(get_db_session)) -> UserResponse:
    configured_secret = settings.admin_registration_secret_key.strip()
    if not configured_secret:
        raise HTTPException(status_code=503, detail="Admin registration is disabled")

    if not compare_digest(req.admin_secret_key, configured_secret):
        raise HTTPException(status_code=403, detail="Invalid admin secret key")

    existing = session.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": req.email.lower()},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
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

    return success_response(
        UserResponse(
            id=user_id,
            email=req.email.lower(),
            full_name=req.full_name,
            role=ROLE_ADMIN,
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
    row = session.execute(
        text(
            """
            SELECT id, password_hash, is_active
            FROM users
            WHERE email = :email
            """
        ),
        {"email": req.email.lower()},
    ).mappings().first()

    if row is None or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not row["is_active"]:
        raise HTTPException(status_code=403, detail="User is inactive")

    token = create_access_token(subject=row["id"])
    return success_response(AuthTokenResponse(access_token=token).model_dump())


@router.post("/auth/admin/login")
def admin_login(req: AuthLoginRequest, session: Session = Depends(get_db_session)) -> AuthTokenResponse:
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
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not row["is_active"]:
        raise HTTPException(status_code=403, detail="User is inactive")
    if normalize_role(row["role"]) != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin account required")

    token = create_access_token(subject=row["id"])
    return success_response(AuthTokenResponse(access_token=token).model_dump())


@router.post("/admin/auth/login", tags=["admin"])
def admin_login_alias(req: AuthLoginRequest, session: Session = Depends(get_db_session)) -> AuthTokenResponse:
    """Alias for admin login under /admin/* to keep admin functionality grouped."""
    return admin_login(req, session)


@router.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return success_response(
        UserResponse(
            id=current_user["id"],
            email=current_user["email"],
            full_name=current_user.get("full_name"),
            role=normalize_role(current_user["role"]),
            is_active=bool(current_user["is_active"]),
        ).model_dump()
    )