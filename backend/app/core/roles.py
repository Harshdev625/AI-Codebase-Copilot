from __future__ import annotations

ROLE_USER = "USER"
ROLE_ADMIN = "ADMIN"


ROLE_ALIASES = {
    "user": ROLE_USER,
    "developer": ROLE_USER,
    "member": ROLE_USER,
    "admin": ROLE_ADMIN,
}


def normalize_role(role: str | None) -> str:
    value = (role or "").strip()
    if not value:
        return ""

    alias = ROLE_ALIASES.get(value.lower())
    if alias:
        return alias

    upper = value.upper()
    if upper in {ROLE_USER, ROLE_ADMIN}:
        return upper

    return value
