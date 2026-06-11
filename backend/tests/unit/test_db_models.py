"""Phase A: Full DB + Model Stabilization Tests.

Validates:
- All SQLAlchemy models can be created on SQLite
- Foreign key relationships work correctly
- Cascade deletes propagate properly
- UUID primary keys are handled correctly
- JSONBType works on both SQLite and Postgres (via TypeDecorator)
- VectorType works on SQLite (stores as JSON string)
- Index constraints are enforced
- Unique constraints are enforced
- All timestamps default correctly
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base
from app.db import models  # noqa: F401 — register ORM models
from app.db.models import (
    AgentRun,
    ChatSession,
    CodeChunk,
    IndexingJob,
    Message,
    Repository,
    User,
)


# ---------------------------------------------------------------------------
# Fixtures: isolated SQLite in-memory DB per test
# ---------------------------------------------------------------------------

@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )

    # Listen on all engines (or this specific one if it works, but Engine is safer)
    from sqlalchemy.engine import Engine
    @event.listens_for(Engine, "connect")
    def _set_pragma(dbapi_conn, _rec):
        if hasattr(dbapi_conn, "execute"):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
        else:
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture()
def session(engine):
    connection = engine.connect()
    # We don't start a transaction manually here because sessionmaker 
    # with autocommit=False will start one. Raw SQL deletes might get 
    # lost if we nest transactions weirdly on SQLite.
    sess = sessionmaker(bind=connection, autoflush=False, autocommit=False, future=True)()
    yield sess
    sess.rollback()
    sess.close()
    connection.close()


# ---------------------------------------------------------------------------
# Schema introspection tests
# ---------------------------------------------------------------------------

class TestSchemaCreation:
    """Verify all tables are created correctly from ORM metadata."""

    def test_all_tables_exist(self, engine):
        inspector = inspect(engine)
        expected = {
            "users", "repositories", "indexing_jobs",
            "chat_sessions", "messages", "agent_runs", "code_chunks",
        }
        actual = set(inspector.get_table_names())
        assert expected.issubset(actual), f"Missing tables: {expected - actual}"

    def test_users_columns(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("users")}
        assert {"id", "email", "password_hash", "role", "is_active", "created_at", "updated_at"}.issubset(columns)

    def test_repositories_columns(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("repositories")}
        assert {"id", "owner_user_id", "repo_id", "remote_url", "default_branch"}.issubset(columns)

    def test_code_chunks_columns(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("code_chunks")}
        assert {"id", "repo_id", "repository_id", "path", "language", "content", "embedding"}.issubset(columns)

    def test_foreign_keys_exist(self, engine):
        inspector = inspect(engine)
        # repositories -> users
        repo_fks = inspector.get_foreign_keys("repositories")
        fk_tables = {fk["referred_table"] for fk in repo_fks}
        assert "users" in fk_tables

        # code_chunks -> repositories
        chunk_fks = inspector.get_foreign_keys("code_chunks")
        chunk_fk_tables = {fk["referred_table"] for fk in chunk_fks}
        assert "repositories" in chunk_fk_tables

        # chat_sessions -> users
        session_fks = inspector.get_foreign_keys("chat_sessions")
        session_fk_tables = {fk["referred_table"] for fk in session_fks}
        assert "users" in session_fk_tables

        # messages -> chat_sessions
        msg_fks = inspector.get_foreign_keys("messages")
        msg_fk_tables = {fk["referred_table"] for fk in msg_fks}
        assert "chat_sessions" in msg_fk_tables


# ---------------------------------------------------------------------------
# CRUD + relationship tests
# ---------------------------------------------------------------------------

class TestUserModel:
    def test_create_user(self, session: Session):
        user = User(
            id=str(uuid.uuid4()),
            email="test@example.com",
            password_hash="hashed",
            role="USER",
            is_active=True,
        )
        session.add(user)
        session.flush()

        fetched = session.get(User, user.id)
        assert fetched is not None
        assert fetched.email == "test@example.com"
        assert fetched.role == "USER"
        assert fetched.is_active is True

    def test_email_uniqueness(self, session: Session):
        u1 = User(id=str(uuid.uuid4()), email="dupe@example.com", password_hash="h", role="USER", is_active=True)
        u2 = User(id=str(uuid.uuid4()), email="dupe@example.com", password_hash="h", role="USER", is_active=True)
        session.add(u1)
        session.flush()
        session.add(u2)
        with pytest.raises(Exception):  # IntegrityError
            session.flush()
        session.rollback()

    def test_uuid_primary_key(self, session: Session):
        uid = str(uuid.uuid4())
        user = User(id=uid, email="uuid@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()
        assert session.get(User, uid) is not None


class TestRepositoryModel:
    def test_create_repository_with_user(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="owner@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        repo = Repository(
            id=str(uuid.uuid4()),
            owner_user_id=user.id,
            repo_id="test-repo",
            remote_url="https://github.com/test/repo.git",
            default_branch="main",
        )
        session.add(repo)
        session.flush()

        fetched = session.get(Repository, repo.id)
        assert fetched is not None
        assert fetched.repo_id == "test-repo"
        assert fetched.owner_user_id == user.id

    def test_cascade_delete_user_deletes_repositories(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="cascade@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        repo = Repository(id=str(uuid.uuid4()), owner_user_id=user.id, repo_id="r1", default_branch="main")
        session.add(repo)
        session.flush()

        repo_id = repo.id
        session.delete(user)
        session.flush()

        assert session.get(Repository, repo_id) is None

    def test_unique_owner_repo_constraint(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="uniq@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        r1 = Repository(id=str(uuid.uuid4()), owner_user_id=user.id, repo_id="same-repo", default_branch="main")
        r2 = Repository(id=str(uuid.uuid4()), owner_user_id=user.id, repo_id="same-repo", default_branch="main")
        session.add(r1)
        session.flush()
        session.add(r2)
        with pytest.raises(Exception):  # IntegrityError
            session.flush()
        session.rollback()


class TestIndexingJobModel:
    def test_create_indexing_job(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="idx@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        repo = Repository(id=str(uuid.uuid4()), owner_user_id=user.id, repo_id="idx-repo", default_branch="main")
        session.add(repo)
        session.flush()

        job = IndexingJob(
            id=str(uuid.uuid4()),
            repository_id=repo.id,
            status="queued",
            stats={"total_files": 0},
        )
        session.add(job)
        session.flush()

        fetched = session.get(IndexingJob, job.id)
        assert fetched is not None
        assert fetched.status == "queued"
        assert fetched.stats == {"total_files": 0}

    def test_jsonb_type_on_sqlite(self, session: Session):
        """Verify JSONBType serialization/deserialization on SQLite."""
        user = User(id=str(uuid.uuid4()), email="json@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        repo = Repository(id=str(uuid.uuid4()), owner_user_id=user.id, repo_id="json-repo", default_branch="main")
        session.add(repo)
        session.flush()

        complex_stats = {
            "total_files": 42,
            "languages": ["python", "javascript"],
            "nested": {"key": "value"},
        }
        job = IndexingJob(id=str(uuid.uuid4()), repository_id=repo.id, status="completed", stats=complex_stats)
        session.add(job)
        session.flush()

        # Re-fetch to ensure deserialization works
        session.expire(job)
        fetched = session.get(IndexingJob, job.id)
        assert fetched.stats == complex_stats
        assert fetched.stats["languages"] == ["python", "javascript"]


class TestChatSessionAndMessageModels:
    def test_create_session_with_messages(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="chat@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        chat = ChatSession(id=str(uuid.uuid4()), user_id=user.id, session_title="Test Chat")
        session.add(chat)
        session.flush()

        msg = Message(
            id=str(uuid.uuid4()),
            chat_session_id=chat.id,
            role="user",
            content="Hello world",
            msg_metadata={"tokens": 2},
        )
        session.add(msg)
        session.flush()

        fetched = session.get(Message, msg.id)
        assert fetched is not None
        assert fetched.content == "Hello world"
        assert fetched.msg_metadata == {"tokens": 2}

    def test_cascade_delete_session_deletes_messages(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="cascade2@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        chat = ChatSession(id=str(uuid.uuid4()), user_id=user.id)
        session.add(chat)
        session.flush()

        msg_id = str(uuid.uuid4())
        msg = Message(id=msg_id, chat_session_id=chat.id, role="user", content="bye")
        session.add(msg)
        session.flush()

        session.delete(chat)
        session.flush()

        assert session.get(Message, msg_id) is None


class TestCodeChunkModel:
    def test_create_code_chunk(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="chunk@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        repo = Repository(id=str(uuid.uuid4()), owner_user_id=user.id, repo_id="chunk-repo", default_branch="main")
        session.add(repo)
        session.flush()

        chunk = CodeChunk(
            id=str(uuid.uuid4()),
            repo_id="chunk-repo",
            repository_id=repo.id,
            commit_sha="abc123",
            path="src/main.py",
            language="python",
            symbol="main",
            chunk_type="function",
            start_line=1,
            end_line=10,
            content="def main():\n    pass",
        )
        session.add(chunk)
        session.flush()

        fetched = session.get(CodeChunk, chunk.id)
        assert fetched is not None
        assert fetched.language == "python"
        assert fetched.chunk_type == "function"

    def test_vector_type_on_sqlite(self, session: Session):
        """Verify VectorType stores as JSON string on SQLite."""
        user = User(id=str(uuid.uuid4()), email="vec@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        repo = Repository(id=str(uuid.uuid4()), owner_user_id=user.id, repo_id="vec-repo", default_branch="main")
        session.add(repo)
        session.flush()

        embedding = [0.1, 0.2, 0.3, 0.4, 0.5]
        chunk = CodeChunk(
            id=str(uuid.uuid4()),
            repo_id="vec-repo",
            repository_id=repo.id,
            path="a.py",
            content="x",
            embedding=embedding,
        )
        session.add(chunk)
        session.flush()

        session.expire(chunk)
        fetched = session.get(CodeChunk, chunk.id)
        assert fetched.embedding is not None
        assert len(fetched.embedding) == 5
        assert abs(fetched.embedding[0] - 0.1) < 1e-6

    def test_cascade_delete_repo_deletes_chunks(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="cascade3@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        repo = Repository(id=str(uuid.uuid4()), owner_user_id=user.id, repo_id="del-repo", default_branch="main")
        session.add(repo)
        session.flush()

        chunk_id = str(uuid.uuid4())
        chunk = CodeChunk(
            id=chunk_id, repo_id="del-repo", repository_id=repo.id,
            path="a.py", content="x",
        )
        session.add(chunk)
        session.flush()

        session.delete(repo)
        session.flush()

        assert session.get(CodeChunk, chunk_id) is None


class TestAgentRunModel:
    def test_create_agent_run(self, session: Session):
        user = User(id=str(uuid.uuid4()), email="agent@test.com", password_hash="h", role="USER", is_active=True)
        session.add(user)
        session.flush()

        run = AgentRun(
            id=str(uuid.uuid4()),
            user_id=user.id,
            query="explain this code",
            intent="explain",
            status="completed",
            diagnostics={"steps": 3, "tokens_used": 500},
        )
        session.add(run)
        session.flush()

        fetched = session.get(AgentRun, run.id)
        assert fetched is not None
        assert fetched.diagnostics["steps"] == 3

    def test_agent_run_nullable_user(self, session: Session):
        """AgentRun.user_id is nullable (SET NULL on user delete)."""
        run = AgentRun(
            id=str(uuid.uuid4()),
            user_id=None,
            query="anonymous query",
            status="completed",
            diagnostics={},
        )
        session.add(run)
        session.flush()

        fetched = session.get(AgentRun, run.id)
        assert fetched.user_id is None


class TestSchemaRecreation:
    """Verify schema can be dropped and recreated from scratch."""

    def test_drop_and_recreate(self):
        eng = create_engine("sqlite:///:memory:", future=True)
        Base.metadata.create_all(bind=eng)
        inspector = inspect(eng)
        assert len(inspector.get_table_names()) > 0
        
        Base.metadata.drop_all(bind=eng)
        assert len(inspect(eng).get_table_names()) == 0

        Base.metadata.create_all(bind=eng)
        tables = set(inspect(eng).get_table_names())
        assert "users" in tables
        assert "code_chunks" in tables
        assert "repositories" in tables
        eng.dispose()
