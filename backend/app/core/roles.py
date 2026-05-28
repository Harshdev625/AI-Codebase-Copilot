from __future__ import annotations

import logging

ROLE_USER = "USER"
ROLE_ADMIN = "ADMIN"


ROLE_ALIASES = {
    "user": ROLE_USER,
    "developer": ROLE_USER,
    "member": ROLE_USER,
    "admin": ROLE_ADMIN,
}


logger = logging.getLogger(__name__)


def normalize_role(role: str | None) -> str:
    value = (role or "").strip()
    if not value:
        return ""

    alias = ROLE_ALIASES.get(value.lower())
    if alias:
        logger.debug("normalize_role - alias role=%s normalized=%s", value, alias)
        return alias

    upper = value.upper()
    if upper in {ROLE_USER, ROLE_ADMIN}:
        logger.debug("normalize_role - canonical role=%s", upper)
        return upper

    logger.debug("normalize_role - passthrough role=%s", value)
    return value
