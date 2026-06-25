"""Unit tests for database dialect helpers."""

from unittest.mock import MagicMock

from app.db.utils import get_jsonb_cast_sql, get_timestamp_sql, is_sqlite_session


def _session_with_dialect(name: str | None):
    session = MagicMock()
    dialect = MagicMock()
    dialect.name = name
    bind = MagicMock()
    bind.dialect = dialect
    session.bind = bind
    return session


def test_is_sqlite_session_true():
    assert is_sqlite_session(_session_with_dialect("sqlite")) is True


def test_is_sqlite_session_postgres():
    assert is_sqlite_session(_session_with_dialect("postgresql")) is False


def test_is_sqlite_session_no_bind():
    session = MagicMock()
    session.bind = None
    assert is_sqlite_session(session) is False


def test_get_timestamp_sql():
    assert get_timestamp_sql(True) == "CURRENT_TIMESTAMP"
    assert get_timestamp_sql(False) == "NOW()"


def test_get_jsonb_cast_sql():
    assert get_jsonb_cast_sql("payload", True) == ":payload"
    assert get_jsonb_cast_sql("payload", False) == "CAST(:payload AS jsonb)"
