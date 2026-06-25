"""Admin invite token generation and validation."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationException, ServiceException
from app.db.models import AdminInvite


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def hash_invite_token(token: str) -> str:
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def create_admin_invite(
    session: Session,
    *,
    email: str,
    created_by_user_id: str,
    expires_in_hours: int = 72,
) -> tuple[AdminInvite, str]:
    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ServiceException("Invite email is required")

    plaintext_token = generate_invite_token()
    invite = AdminInvite(
        id=str(uuid.uuid4()),
        email=normalized_email,
        token_hash=hash_invite_token(plaintext_token),
        created_by_user_id=created_by_user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=max(1, min(expires_in_hours, 168))),
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)
    return invite, plaintext_token


def validate_and_consume_admin_invite(
    session: Session,
    *,
    email: str,
    invite_token: str,
) -> AdminInvite:
    normalized_email = email.strip().lower()
    token_hash = hash_invite_token(invite_token)
    invite = (
        session.query(AdminInvite)
        .filter(AdminInvite.token_hash == token_hash)
        .first()
    )
    if invite is None:
        raise AuthorizationException("Invalid or expired admin invite")

    if invite.consumed_at is not None:
        raise AuthorizationException("Admin invite has already been used")

    if invite.email != normalized_email:
        raise AuthorizationException("Admin invite email does not match registration email")

    now = datetime.now(timezone.utc)
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise AuthorizationException("Admin invite has expired")

    invite.consumed_at = now
    session.commit()
    return invite


def revoke_admin_invite(session: Session, *, invite_id: str) -> bool:
    invite = session.query(AdminInvite).filter(AdminInvite.id == invite_id).first()
    if invite is None:
        return False
    if invite.consumed_at is not None:
        raise ServiceException("Cannot revoke an invite that has already been used")
    session.delete(invite)
    session.commit()
    return True


def list_pending_admin_invites_for_email(session: Session, *, email: str) -> list[AdminInvite]:
    """Return unconsumed, unexpired admin invites for the given email."""
    normalized_email = email.strip().lower()
    if not normalized_email:
        return []

    now = datetime.now(timezone.utc)
    rows = (
        session.query(AdminInvite)
        .filter(
            AdminInvite.email == normalized_email,
            AdminInvite.consumed_at.is_(None),
        )
        .order_by(AdminInvite.created_at.desc())
        .all()
    )
    pending: list[AdminInvite] = []
    for row in rows:
        expires_at = row.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at >= now:
            pending.append(row)
    return pending
