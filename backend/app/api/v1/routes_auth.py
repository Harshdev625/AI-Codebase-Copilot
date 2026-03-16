from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db_session
from app.models.api_models import (
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
    UserResponse,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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
            VALUES (:id, :email, :password_hash, :full_name, 'developer', TRUE)
            """
        ),
        {
            "id": user_id,
            "email": req.email.lower(),
            "password_hash": hash_password(req.password),
            "full_name": req.full_name,
        },
    )
    session.commit()

    return UserResponse(
        id=user_id,
        email=req.email.lower(),
        full_name=req.full_name,
        role="developer",
        is_active=True,
    )


@router.post("/auth/login", response_model=AuthTokenResponse)
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
    return AuthTokenResponse(access_token=token)


@router.get("/auth/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user.get("full_name"),
        role=current_user["role"],
        is_active=bool(current_user["is_active"]),
    )