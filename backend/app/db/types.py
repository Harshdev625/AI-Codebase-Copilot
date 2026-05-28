from __future__ import annotations

import json
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector as PgVector
from sqlalchemy.dialects.postgresql import JSON as PGJSON
from sqlalchemy.types import JSON as SQLJSON, Text, TypeDecorator
from sqlalchemy import func


class VectorType(TypeDecorator):
    cache_ok = True
    impl = Text

    def __init__(self, dimension: int) -> None:
        super().__init__()
        self._dimension = dimension

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PgVector(self._dimension))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return None


class JSONBType(TypeDecorator):
    """Cross-database JSONB type that uses native JSONB for PostgreSQL and JSON for SQLite."""
    cache_ok = True
    impl = SQLJSON

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGJSON())
        return dialect.type_descriptor(SQLJSON())

    def process_bind_param(self, value, dialect):
        if value is None or dialect.name == "postgresql":
            return value
        # SQLite JSON type expects a string
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        # SQLite returns strings, need to parse them
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (TypeError, ValueError):
                return {}
        return value


def get_db_func_now():
    """Get the appropriate NOW/CURRENT_TIMESTAMP function for the current dialect.
    
    This is a workaround for SQLite not supporting NOW().
    Use this in server_default= parameters when you need dialect-specific time functions.
    """
    # We can't determine the dialect at definition time, so we use a callable
    # that will be resolved by SQLAlchemy
    return func.now()
