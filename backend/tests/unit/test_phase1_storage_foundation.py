"""
tests/unit/test_phase1_storage_foundation.py
---------------------------------------------
Validates every Phase 1 requirement:

  1. ORM model columns are present with correct types
  2. Repository snapshot creation via create_snapshot()
  3. File metadata persistence via upsert_file_records()
  4. Content hash generation in _assign_repository_ids_and_chunk_ids()
  5. Snapshot retention cleanup (ALL / LAST_N / IMPORTANT_ONLY)
  6. GET /repositories/{id}/tree endpoint

All tests use the SQLite-backed in-memory fixture from conftest.py.
Qdrant calls are patched at the module boundary.
"""
from __future__ import annotations

import hashlib
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import inspect, text

from app.db import models as m
from app.db.database import Base


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_repo(db_session, user_id: str) -> dict:
    repo_id = str(uuid.uuid4())
    db_session.execute(
        text(
            """
            INSERT INTO repositories
              (id, owner_user_id, repo_id, remote_url, local_path, default_branch, retain_snapshots_mode, retain_snapshot_count)
            VALUES
              (:id, :owner_user_id, :repo_id, NULL, NULL, 'main', 'LAST_N', 20)
            """
        ),
        {"id": repo_id, "owner_user_id": user_id, "repo_id": f"org/repo-{repo_id[:6]}"},
    )
    db_session.commit()
    return {"id": repo_id}


def _make_snapshot(
    db_session,
    repository_id: str,
    commit_sha: str,
    *,
    is_pinned: bool = False,
    is_release: bool = False,
    files_count: int = 10,
    chunks_count: int = 50,
) -> str:
    snap_id = str(uuid.uuid5(uuid.NAMESPACE_OID, f"{repository_id}|{commit_sha}"))
    db_session.execute(
        text(
            """
            INSERT INTO repository_snapshots
              (id, repository_id, commit_sha, files_count, chunks_count,
               files_skipped, is_pinned, is_release)
            VALUES
              (:id, :repository_id, :commit_sha, :files_count, :chunks_count,
               0, :is_pinned, :is_release)
            """
        ),
        {
            "id": snap_id,
            "repository_id": repository_id,
            "commit_sha": commit_sha,
            "files_count": files_count,
            "chunks_count": chunks_count,
            "is_pinned": is_pinned,
            "is_release": is_release,
        },
    )
    db_session.commit()
    return snap_id


# ---------------------------------------------------------------------------
# 1. ORM schema validation
# ---------------------------------------------------------------------------

class TestOrmSchemaPresence:
    """Verify that every new column actually exists in the SQLite schema."""

    def test_repositories_has_retention_columns(self, db_session):
        cols = {c["name"] for c in inspect(db_session.bind).get_columns("repositories")}
        assert "latest_indexed_commit" in cols
        assert "retain_snapshots_mode" in cols
        assert "retain_snapshot_count" in cols

    def test_indexing_jobs_has_new_columns(self, db_session):
        cols = {c["name"] for c in inspect(db_session.bind).get_columns("indexing_jobs")}
        assert "trigger_type" in cols
        assert "priority" in cols
        assert "files_indexed" in cols
        assert "files_skipped" in cols
        assert "chunks_created" in cols
        assert "errors" in cols
        assert "finished_at" in cols

    def test_code_chunks_has_hash_columns(self, db_session):
        cols = {c["name"] for c in inspect(db_session.bind).get_columns("code_chunks")}
        assert "content_hash" in cols
        assert "qdrant_point_id" in cols

    def test_chat_sessions_has_commit_sha(self, db_session):
        cols = {c["name"] for c in inspect(db_session.bind).get_columns("chat_sessions")}
        assert "commit_sha" in cols

    def test_repository_files_table_exists(self, db_session):
        tables = inspect(db_session.bind).get_table_names()
        assert "repository_files" in tables

    def test_repository_snapshots_table_exists(self, db_session):
        tables = inspect(db_session.bind).get_table_names()
        assert "repository_snapshots" in tables

    def test_repository_files_columns(self, db_session):
        cols = {c["name"] for c in inspect(db_session.bind).get_columns("repository_files")}
        required = {
            "id", "repository_id", "path", "type", "extension", "language",
            "size_bytes", "line_count", "token_count", "hash", "is_generated",
            "status", "skip_reason", "last_indexed_commit",
        }
        assert required <= cols, f"Missing columns: {required - cols}"

    def test_repository_snapshots_columns(self, db_session):
        cols = {c["name"] for c in inspect(db_session.bind).get_columns("repository_snapshots")}
        required = {
            "id", "repository_id", "commit_sha", "indexed_at",
            "files_count", "chunks_count", "files_skipped",
            "is_pinned", "is_release",
        }
        assert required <= cols, f"Missing columns: {required - cols}"

    def test_repository_has_files_relationship(self):
        """ORM relationship repository.repository_files must exist."""
        mapper = m.Repository.__mapper__
        assert "repository_files" in {r.key for r in mapper.relationships}

    def test_repository_has_snapshots_relationship(self):
        mapper = m.Repository.__mapper__
        assert "snapshots" in {r.key for r in mapper.relationships}


# ---------------------------------------------------------------------------
# 2. Snapshot creation
# ---------------------------------------------------------------------------

class TestSnapshotCreation:

    @pytest.mark.asyncio
    async def test_create_snapshot_inserts_row(self, db_session, test_user):
        from app.services.indexing_helpers import create_snapshot

        repo = _make_repo(db_session, test_user["id"])
        commit = "abc123"

        await create_snapshot(
            db_session,
            repository_id=repo["id"],
            commit_sha=commit,
            files_count=42,
            files_skipped=3,
            chunks_count=200,
        )

        row = db_session.execute(
            text(
                "SELECT * FROM repository_snapshots WHERE repository_id = :rid AND commit_sha = :sha"
            ),
            {"rid": repo["id"], "sha": commit},
        ).mappings().first()

        assert row is not None
        assert row["files_count"] == 42
        assert row["chunks_count"] == 200
        assert row["files_skipped"] == 3
        assert bool(row["is_pinned"]) is False
        assert bool(row["is_release"]) is False

    @pytest.mark.asyncio
    async def test_create_snapshot_is_idempotent(self, db_session, test_user):
        """Calling create_snapshot twice for same commit must upsert, not duplicate."""
        from app.services.indexing_helpers import create_snapshot

        repo = _make_repo(db_session, test_user["id"])
        commit = "deadbeef"

        await create_snapshot(db_session, repository_id=repo["id"], commit_sha=commit,
                              files_count=10, files_skipped=0, chunks_count=50)
        await create_snapshot(db_session, repository_id=repo["id"], commit_sha=commit,
                              files_count=12, files_skipped=1, chunks_count=60)

        count = db_session.execute(
            text("SELECT COUNT(*) FROM repository_snapshots WHERE repository_id = :rid"),
            {"rid": repo["id"]},
        ).scalar()
        assert count == 1

        row = db_session.execute(
            text("SELECT * FROM repository_snapshots WHERE repository_id = :rid"),
            {"rid": repo["id"]},
        ).mappings().first()
        assert row["files_count"] == 10  # unchanged due to immutability

    @pytest.mark.asyncio
    async def test_create_snapshot_updates_latest_indexed_commit(self, db_session, test_user):
        from app.services.indexing_helpers import create_snapshot

        repo = _make_repo(db_session, test_user["id"])
        await create_snapshot(db_session, repository_id=repo["id"], commit_sha="v1sha",
                              files_count=1, files_skipped=0, chunks_count=5)

        latest = db_session.execute(
            text("SELECT latest_indexed_commit FROM repositories WHERE id = :id"),
            {"id": repo["id"]},
        ).scalar()
        assert latest == "v1sha"


# ---------------------------------------------------------------------------
# 3. File metadata persistence
# ---------------------------------------------------------------------------

class TestFileMetadataPersistence:

    @pytest.mark.asyncio
    async def test_upsert_file_records_inserts_rows(self, db_session, test_user, tmp_path):
        from app.services.indexing_helpers import upsert_file_records

        repo = _make_repo(db_session, test_user["id"])

        # Create real temp files so stat() and read_text() work
        f1 = tmp_path / "main.py"
        f1.write_text("print('hello')\n", encoding="utf-8")
        f2 = tmp_path / "utils.ts"
        f2.write_text("export const x = 1;\n", encoding="utf-8")

        upserted, files_to_chunk = await upsert_file_records(
            db_session,
            repository_id=repo["id"],
            repo_root=tmp_path,
            commit_sha="sha001",
            file_list=[f1, f2],
        )

        assert upserted == 2
        # Both files are new (no prior hash), so both need chunking
        assert len(files_to_chunk) == 2

        rows = db_session.execute(
            text("SELECT path, language, status FROM repository_files WHERE repository_id = :rid"),
            {"rid": repo["id"]},
        ).mappings().all()

        paths = {r["path"] for r in rows}
        assert "main.py" in paths
        assert "utils.ts" in paths
        assert all(r["status"] == "INDEXED" for r in rows)

    @pytest.mark.asyncio
    async def test_upsert_file_records_stores_hash(self, db_session, test_user, tmp_path):
        from app.services.indexing_helpers import upsert_file_records

        repo = _make_repo(db_session, test_user["id"])
        content = "def foo(): pass\n"
        f = tmp_path / "foo.py"
        f.write_text(content, encoding="utf-8")

        await upsert_file_records(
            db_session,
            repository_id=repo["id"],
            repo_root=tmp_path,
            commit_sha="sha002",
            file_list=[f],
        )

        expected_hash = hashlib.sha256(content.encode()).hexdigest()
        row = db_session.execute(
            text("SELECT hash FROM repository_files WHERE repository_id = :rid AND path = :path"),
            {"rid": repo["id"], "path": "foo.py"},
        ).mappings().first()

        assert row is not None
        assert row["hash"] == expected_hash

    @pytest.mark.asyncio
    async def test_upsert_file_records_stores_line_and_token_count(self, db_session, test_user, tmp_path):
        from app.services.indexing_helpers import upsert_file_records

        repo = _make_repo(db_session, test_user["id"])
        content = "line1\nline2\nline3\n"
        f = tmp_path / "three_lines.py"
        f.write_text(content, encoding="utf-8")

        await upsert_file_records(
            db_session,
            repository_id=repo["id"],
            repo_root=tmp_path,
            commit_sha="sha003",
            file_list=[f],
        )

        row = db_session.execute(
            text("SELECT line_count, token_count FROM repository_files WHERE repository_id = :rid"),
            {"rid": repo["id"]},
        ).mappings().first()

        assert row["line_count"] == 4
        # token estimate = len(content) // 4 = 18 // 4 = 4
        assert row["token_count"] > 0

    @pytest.mark.asyncio
    async def test_upsert_file_records_is_idempotent(self, db_session, test_user, tmp_path):
        from app.services.indexing_helpers import upsert_file_records

        repo = _make_repo(db_session, test_user["id"])
        f = tmp_path / "idempotent.py"
        f.write_text("x = 1\n", encoding="utf-8")

        await upsert_file_records(db_session, repository_id=repo["id"],
                                  repo_root=tmp_path, commit_sha="s1", file_list=[f])
        f.write_text("x = 2\n", encoding="utf-8")  # content changed
        await upsert_file_records(db_session, repository_id=repo["id"],
                                  repo_root=tmp_path, commit_sha="s2", file_list=[f])

        count = db_session.execute(
            text("SELECT COUNT(*) FROM repository_files WHERE repository_id = :rid"),
            {"rid": repo["id"]},
        ).scalar()
        assert count == 1  # still just one row, updated

    @pytest.mark.asyncio
    async def test_generated_file_flagged(self, db_session, test_user, tmp_path):
        from app.services.indexing_helpers import upsert_file_records

        repo = _make_repo(db_session, test_user["id"])
        lock = tmp_path / "package-lock.json"
        lock.write_text("{}", encoding="utf-8")

        await upsert_file_records(db_session, repository_id=repo["id"],
                                  repo_root=tmp_path, commit_sha="s1", file_list=[lock])

        row = db_session.execute(
            text("SELECT is_generated FROM repository_files WHERE repository_id = :rid"),
            {"rid": repo["id"]},
        ).mappings().first()
        assert bool(row["is_generated"]) is True


# ---------------------------------------------------------------------------
# 4. Content hash generation on CodeChunk
# ---------------------------------------------------------------------------

class TestContentHashGeneration:

    def test_assign_sets_content_hash(self):
        from app.services.indexing_service import IndexingService
        from app.models.domain_models import CodeChunk

        chunk = CodeChunk(
            id="dummy",
            repo_id="r1",
            repository_id=None,
            commit_sha="sha1",
            path="foo.py",
            language="py",
            symbol="",
            chunk_type="generic",
            start_line=1,
            end_line=5,
            content="def foo(): pass",
        )

        mock_session = MagicMock()
        svc = IndexingService(mock_session)
        svc._assign_repository_ids_and_chunk_ids("repo-uuid", [chunk])

        expected = hashlib.sha256("def foo(): pass".encode("utf-8")).hexdigest()
        assert chunk.content_hash == expected

    def test_assign_id_is_deterministic(self):
        from app.services.indexing_service import IndexingService
        from app.models.domain_models import CodeChunk

        def _make_chunk():
            return CodeChunk(
                id="dummy",
                repo_id="r1",
                repository_id=None,
                commit_sha="sha1",
                path="foo.py",
                language="py",
                symbol="",
                chunk_type="generic",
                start_line=1,
                end_line=5,
                content="def foo(): pass",
            )

        mock_session = MagicMock()
        svc = IndexingService(mock_session)
        c1, c2 = _make_chunk(), _make_chunk()
        svc._assign_repository_ids_and_chunk_ids("repo-uuid", [c1])
        svc._assign_repository_ids_and_chunk_ids("repo-uuid", [c2])
        assert c1.id == c2.id

    def test_different_content_gives_different_hash(self):
        from app.services.indexing_service import IndexingService
        from app.models.domain_models import CodeChunk

        mock_session = MagicMock()
        svc = IndexingService(mock_session)

        c1 = CodeChunk(id="x", repo_id="r", repository_id=None, commit_sha="s",
                       path="a.py", language="py", symbol="", chunk_type="generic",
                       start_line=1, end_line=1, content="content A")
        c2 = CodeChunk(id="x", repo_id="r", repository_id=None, commit_sha="s",
                       path="a.py", language="py", symbol="", chunk_type="generic",
                       start_line=1, end_line=1, content="content B")

        svc._assign_repository_ids_and_chunk_ids("repo-uuid", [c1, c2])
        assert c1.content_hash != c2.content_hash


# ---------------------------------------------------------------------------
# 5. Snapshot retention cleanup
# ---------------------------------------------------------------------------

class TestSnapshotRetentionCleanup:

    def _make_qdrant_mock(self):
        mock = MagicMock()
        mock.delete_points_by_ids = MagicMock(return_value=None)
        return mock

    def test_all_mode_deletes_nothing(self, db_session, test_user):
        from app.services.snapshot_retention import SnapshotRetentionService

        repo = _make_repo(db_session, test_user["id"])
        for i in range(5):
            _make_snapshot(db_session, repo["id"], f"sha-{i}")

        svc = SnapshotRetentionService(db_session)
        svc.qdrant = self._make_qdrant_mock()
        deleted = svc.enforce_retention(repository_id=repo["id"], mode="ALL", retain_count=2)

        assert deleted == 0
        count = db_session.execute(
            text("SELECT COUNT(*) FROM repository_snapshots WHERE repository_id = :rid"),
            {"rid": repo["id"]},
        ).scalar()
        assert count == 5

    def test_last_n_keeps_newest(self, db_session, test_user):
        from app.services.snapshot_retention import SnapshotRetentionService

        repo = _make_repo(db_session, test_user["id"])
        # Insert 5 snapshots; the first (sha-0) is oldest because indexed_at is server default NOW()
        # We need to use explicit ordering so we force distinct commit shas
        shas = [f"sha-retain-{i}" for i in range(5)]
        for sha in shas:
            _make_snapshot(db_session, repo["id"], sha)

        svc = SnapshotRetentionService(db_session)
        svc.qdrant = self._make_qdrant_mock()
        deleted = svc.enforce_retention(repository_id=repo["id"], mode="LAST_N", retain_count=3)

        # 5 snapshots - keep 3 = delete 2
        assert deleted == 2

        count = db_session.execute(
            text("SELECT COUNT(*) FROM repository_snapshots WHERE repository_id = :rid AND status = 'ACTIVE'"),
            {"rid": repo["id"]},
        ).scalar()
        assert count == 3

        archived = db_session.execute(
            text("SELECT COUNT(*) FROM repository_snapshots WHERE repository_id = :rid AND status = 'ARCHIVED'"),
            {"rid": repo["id"]},
        ).scalar()
        assert archived == 2

    def test_last_n_never_deletes_pinned(self, db_session, test_user):
        from app.services.snapshot_retention import SnapshotRetentionService

        repo = _make_repo(db_session, test_user["id"])
        _make_snapshot(db_session, repo["id"], "pinned-sha", is_pinned=True)
        for i in range(4):
            _make_snapshot(db_session, repo["id"], f"unpinned-{i}")

        svc = SnapshotRetentionService(db_session)
        svc.qdrant = self._make_qdrant_mock()
        svc.enforce_retention(repository_id=repo["id"], mode="LAST_N", retain_count=2)

        # pinned must survive
        row = db_session.execute(
            text("SELECT id FROM repository_snapshots WHERE commit_sha = 'pinned-sha'")
        ).first()
        assert row is not None

    def test_last_n_never_deletes_release(self, db_session, test_user):
        from app.services.snapshot_retention import SnapshotRetentionService

        repo = _make_repo(db_session, test_user["id"])
        _make_snapshot(db_session, repo["id"], "release-sha", is_release=True)
        for i in range(4):
            _make_snapshot(db_session, repo["id"], f"regular-{i}")

        svc = SnapshotRetentionService(db_session)
        svc.qdrant = self._make_qdrant_mock()
        svc.enforce_retention(repository_id=repo["id"], mode="LAST_N", retain_count=2)

        row = db_session.execute(
            text("SELECT id FROM repository_snapshots WHERE commit_sha = 'release-sha'")
        ).first()
        assert row is not None

    def test_important_only_deletes_non_important(self, db_session, test_user):
        from app.services.snapshot_retention import SnapshotRetentionService

        repo = _make_repo(db_session, test_user["id"])
        _make_snapshot(db_session, repo["id"], "pinned", is_pinned=True)
        _make_snapshot(db_session, repo["id"], "release", is_release=True)
        _make_snapshot(db_session, repo["id"], "ordinary-1")
        _make_snapshot(db_session, repo["id"], "ordinary-2")

        svc = SnapshotRetentionService(db_session)
        svc.qdrant = self._make_qdrant_mock()
        deleted = svc.enforce_retention(repository_id=repo["id"], mode="IMPORTANT_ONLY", retain_count=0)

        assert deleted == 2

        surviving = db_session.execute(
            text("SELECT commit_sha FROM repository_snapshots WHERE repository_id = :rid AND status = 'ACTIVE'"),
            {"rid": repo["id"]},
        ).scalars().all()
        assert set(surviving) == {"pinned", "release"}

        archived = db_session.execute(
            text("SELECT commit_sha FROM repository_snapshots WHERE repository_id = :rid AND status = 'ARCHIVED'"),
            {"rid": repo["id"]},
        ).scalars().all()
        assert set(archived) == {"ordinary-1", "ordinary-2"}

    def test_no_snapshots_returns_zero(self, db_session, test_user):
        from app.services.snapshot_retention import SnapshotRetentionService

        repo = _make_repo(db_session, test_user["id"])
        svc = SnapshotRetentionService(db_session)
        svc.qdrant = self._make_qdrant_mock()
        deleted = svc.enforce_retention(repository_id=repo["id"], mode="LAST_N", retain_count=5)
        assert deleted == 0


# ---------------------------------------------------------------------------
# 6. GET /repositories/{id}/tree endpoint
# ---------------------------------------------------------------------------

class TestRepositoryTreeEndpoint:

    def _seed_files(self, db_session, repository_id: str) -> None:
        for path, status in [
            ("src/main.py", "INDEXED"),
            ("src/utils.py", "INDEXED"),
            ("big_data.json", "SKIPPED"),
        ]:
            file_id = str(uuid.uuid4())
            db_session.execute(
                text(
                    """
                    INSERT INTO repository_files
                      (id, repository_id, path, type, is_generated, status)
                    VALUES
                      (:id, :rid, :path, 'FILE', 0, :status)
                    """
                ),
                {"id": file_id, "rid": repository_id, "path": path, "status": status},
            )
        db_session.commit()

    def test_tree_returns_all_files(self, client, test_user, auth_headers, db_session):
        repo = _make_repo(db_session, test_user["id"])
        self._seed_files(db_session, repo["id"])

        resp = client.get(f"/v1/repositories/{repo['id']}/tree", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data["data"]["items"]
        paths = {item["path"] for item in items}
        assert "src" in paths
        assert "big_data.json" in paths

    def test_tree_filter_by_status(self, client, test_user, auth_headers, db_session):
        repo = _make_repo(db_session, test_user["id"])
        self._seed_files(db_session, repo["id"])

        resp = client.get(
            f"/v1/repositories/{repo['id']}/tree?status_filter=INDEXED",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        items = data["data"]["items"]
        assert len(items) > 0

    def test_tree_requires_auth(self, client):
        repo_id = str(uuid.uuid4())
        resp = client.get(f"/v1/repositories/{repo_id}/tree")
        assert resp.status_code == 401

    def test_tree_rejects_wrong_owner(self, client, auth_headers, db_session):
        # Repository owned by a different user — this user should get 403/404
        other_user_id = str(uuid.uuid4())
        db_session.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, role, is_active)
                VALUES (:id, :email, 'x', 'USER', 1)
                """
            ),
            {"id": other_user_id, "email": f"other+{other_user_id[:6]}@test.com"},
        )
        db_session.commit()
        other_repo = _make_repo(db_session, other_user_id)

        resp = client.get(
            f"/v1/repositories/{other_repo['id']}/tree",
            headers=auth_headers,
        )
        # Should be 403 or 404 (access denied)
        assert resp.status_code in {403, 404}
