from __future__ import annotations

import logging

from sqlalchemy import text

from app.db.database import Base, engine
from app.db import models  # noqa: F401  (register ORM models)


logger = logging.getLogger(__name__)


def ensure_app_schema() -> None:
    logger.info("schema_ensure - start")
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(bind=connection)
    logger.info("schema_ensure - completed")


def reset_app_schema() -> None:
    logger.warning("schema_reset - start")
    with engine.begin() as connection:
        # Drop and recreate schema to remove any orphaned objects and constraints.
        if connection.dialect.name == "postgresql":
            connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            connection.execute(text("CREATE SCHEMA public"))
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(bind=connection)
    logger.warning("schema_reset - completed")

