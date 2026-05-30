"""
Test configuration for isolated backend tests.

Provides a SQLite-backed in-memory database, a clean schema per test session,
and a FastAPI TestClient with the DB session dependency overridden.

Usage:
    - ``db_session`` fixture: yields a SQLAlchemy Session bound to SQLite.
    - ``client`` fixture: yields a ``TestClient`` using the overridden session.
    - ``auth_headers`` fixture: returns Authorization headers for a test user.
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Force file-based SQLite for stable fixture isolation
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")
os.environ.setdefault("QDRANT_HOST", "localhost")
os.environ.setdefault("QDRANT_PORT", "6333")
os.environ.setdefault("REDIS_HOST", "localhost")
os.environ.setdefault("REDIS_PORT", "6379")

from app.db.database import Base, get_db_session
from app.db import models as _models  # noqa: F401  — register ORM classes
from app.core.security import create_access_token


# ---------------------------------------------------------------------------
# Engine + session factory for the test suite
# ---------------------------------------------------------------------------

_test_engine = create_engine(
    "sqlite:///test.db",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)

# Enable WAL-like behavior for SQLite
@event.listens_for(_test_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


_TestSessionLocal = sessionmaker(
    bind=_test_engine,
    autoflush=False,
    autocommit=False,
    future=True,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_circuit_breakers():
    """Reset all circuit breakers before each test to prevent state leakage."""
    from app.core.resilience import _circuit_breakers
    for cb in _circuit_breakers.values():
        cb.reset()


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    """Create all tables once for the entire test session."""
    Base.metadata.drop_all(bind=_test_engine)
    Base.metadata.create_all(bind=_test_engine)
    yield
    Base.metadata.drop_all(bind=_test_engine)


@pytest.fixture()
def db_session():
    """Yield an isolated DB session. Rolls back after each test."""
    connection = _test_engine.connect()
    transaction = connection.begin()
    session = _TestSessionLocal(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    """Yield a TestClient with the DB session dependency overridden."""
    from fastapi.testclient import TestClient
    from app.main import app

    def _override_session():
        yield db_session

    app.dependency_overrides[get_db_session] = _override_session
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


@pytest.fixture()
def test_user(db_session):
    """Create a test user in the DB and return user dict + token."""
    from app.db.models import User
    from app.core.security import hash_password

    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        email=f"test+{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("password123"),
        full_name="Test User",
        role="USER",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    token = create_access_token(
        subject=user_id,
        claims={"scopes": ["repository:read", "repository:write", "indexing:write", "chat:query"]},
    )
    return {
        "id": user_id,
        "email": user.email,
        "role": "USER",
        "token": token,
    }


@pytest.fixture()
def auth_headers(test_user):
    """Return Authorization headers for a test user."""
    return {"Authorization": f"Bearer {test_user['token']}"}


@pytest.fixture()
def admin_user(db_session):
    """Create an admin test user."""
    from app.db.models import User
    from app.core.security import hash_password

    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        email=f"admin+{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("adminpass123"),
        full_name="Admin User",
        role="ADMIN",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    token = create_access_token(
        subject=user_id,
        claims={"scopes": ["*"]},
    )
    return {
        "id": user_id,
        "email": user.email,
        "role": "ADMIN",
        "token": token,
    }


@pytest.fixture()
def admin_headers(admin_user):
    """Return Authorization headers for an admin user."""
    return {"Authorization": f"Bearer {admin_user['token']}"}


# ---------------------------------------------------------------------------
# Marker helpers
# ---------------------------------------------------------------------------

def _live_enabled() -> bool:
    return os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").strip().lower() in {"1", "true", "yes"}


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if _live_enabled():
        return

    kept: list[pytest.Item] = []
    deselected: list[pytest.Item] = []

    for item in items:
        if item.get_closest_marker("live_integration") is not None:
            deselected.append(item)
        else:
            kept.append(item)

    if deselected:
        config.hook.pytest_deselected(items=deselected)
        items[:] = kept
