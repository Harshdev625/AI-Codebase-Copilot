import pytest
from datetime import datetime, timedelta
from app.db import models as db_models
from app.services.snapshot_retention import SnapshotRetentionService
from sqlalchemy import text

@pytest.fixture
def test_setup(db_session, test_user):
    repo = db_models.Repository(
        id="repo-retention",
        owner_user_id=test_user["id"],
        repo_id="test-repo-retention",
        remote_url="https://github.com/test/repo.git",
        default_branch="main",
        retain_snapshots_mode="LAST_N",
        retain_snapshot_count=1
    )
    db_session.add(repo)
    db_session.commit()
    return test_user, repo

def test_snapshot_soft_retention(db_session, test_setup, monkeypatch):
    user, repo = test_setup
    
    # Mock Qdrant Service to avoid external calls
    class MockQdrant:
        def delete_points_by_ids(self, ids):
            pass
            
    monkeypatch.setattr("app.services.snapshot_retention.QdrantService", lambda: MockQdrant())
    
    # 1. Seed 4 snapshots in chronological order
    now = datetime.utcnow()
    
    # Snapshot 1: Oldest ACTIVE
    snap1 = db_models.RepositorySnapshot(
        id="snap-1", repository_id=repo.id, commit_sha="sha-1",
        indexed_at=now - timedelta(days=4), is_pinned=False, status="ACTIVE"
    )
    # Snapshot 2: Middle ACTIVE
    snap2 = db_models.RepositorySnapshot(
        id="snap-2", repository_id=repo.id, commit_sha="sha-2",
        indexed_at=now - timedelta(days=3), is_pinned=False, status="ACTIVE"
    )
    # Snapshot 3: PINNED
    snap3 = db_models.RepositorySnapshot(
        id="snap-3", repository_id=repo.id, commit_sha="sha-3",
        indexed_at=now - timedelta(days=2), is_pinned=True, status="PINNED"
    )
    # Snapshot 4: Latest ACTIVE
    snap4 = db_models.RepositorySnapshot(
        id="snap-4", repository_id=repo.id, commit_sha="sha-4",
        indexed_at=now - timedelta(days=1), is_pinned=False, status="ACTIVE"
    )
    
    db_session.add_all([snap1, snap2, snap3, snap4])
    db_session.commit()
    
    # Seed chunks associated with snap1
    chunk = db_models.CodeChunk(
        id="chunk-1", repo_id="test-repo-retention", repository_id=repo.id,
        snapshot_id=snap1.id, commit_sha="sha-1", path="src/main.py",
        content="code", status="ACTIVE", qdrant_point_id="point-1"
    )
    db_session.add(chunk)
    db_session.commit()
    
    # Run retention (retain_snapshot_count = 1)
    # Among ACTIVE unpinned snapshots (snap1, snap2, snap4):
    # snap4 is latest (keep)
    # snap2 and snap1 should be archived (since count is 1)
    # snap3 is protected (status is PINNED and is_pinned is True)
    service = SnapshotRetentionService(db_session)
    deleted_count = service.enforce_retention(
        repository_id=repo.id,
        mode="LAST_N",
        retain_count=1
    )
    
    assert deleted_count == 2
    
    # Verify snapshot rows were NOT deleted from the database
    all_snapshots = db_session.query(db_models.RepositorySnapshot).all()
    assert len(all_snapshots) == 4
    
    # Check statuses
    statuses = {s.id: s.status for s in all_snapshots}
    assert statuses["snap-4"] == "ACTIVE"
    assert statuses["snap-3"] == "PINNED"
    assert statuses["snap-2"] == "ARCHIVED"
    assert statuses["snap-1"] == "ARCHIVED"
    
    # Check chunk status
    db_session.refresh(chunk)
    assert chunk.status == "PURGED"
    assert chunk.purged_at is not None
    assert chunk.qdrant_point_id is None

def test_retention_fail_safe(db_session, test_setup):
    user, repo = test_setup
    
    # 1. Create ACTIVE snapshot
    snap = db_models.RepositorySnapshot(
        id="snap-fs", repository_id=repo.id, commit_sha="sha-fs",
        indexed_at=datetime.utcnow(), is_pinned=False, status="ACTIVE"
    )
    db_session.add(snap)
    db_session.commit()
    
    # Run retention with invalid mode
    service = SnapshotRetentionService(db_session)
    deleted = service.enforce_retention(
        repository_id=repo.id,
        mode="INVALID_MODE",
        retain_count=1
    )
    assert deleted == 0
    
    # Verify snapshot remains ACTIVE
    db_session.refresh(snap)
    assert snap.status == "ACTIVE"
