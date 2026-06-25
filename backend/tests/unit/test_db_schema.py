"""B2 — schema ensure/reset idempotency on SQLite."""
from __future__ import annotations

from sqlalchemy import inspect

from app.db.database import Base, engine
from app.db.schema import _apply_additive_migrations, ensure_app_schema, reset_app_schema


def test_ensure_app_schema_is_idempotent():
    ensure_app_schema()
    ensure_app_schema()

    inspector = inspect(engine)
    assert "chat_sessions" in inspector.get_table_names()
    column_names = {col["name"] for col in inspector.get_columns("chat_sessions")}
    assert "is_deleted" in column_names
    assert "deleted_at" in column_names


def test_additive_sqlite_migrations_tolerate_existing_columns():
    ensure_app_schema()
    with engine.begin() as connection:
        _apply_additive_migrations(connection)


def test_reset_app_schema_recreates_tables_on_sqlite():
    ensure_app_schema()
    reset_app_schema()
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    expected = {table.name for table in Base.metadata.sorted_tables}
    assert expected.issubset(table_names)
