import pytest
from app.db import models as db_models

@pytest.fixture
def test_setup(db_session, test_user):
    repo = db_models.Repository(
        id="repo-diff",
        owner_user_id=test_user["id"],
        repo_id="test-repo-diff",
        remote_url="https://github.com/test/repo.git",
        default_branch="main"
    )
    db_session.add(repo)
    db_session.commit()
    return test_user, repo

def test_snapshot_diffing_and_renames(client, auth_headers, test_setup, db_session):
    user, repo = test_setup
    
    # 1. Create Snapshot A (Old)
    snap_a = db_models.RepositorySnapshot(
        id="snap-a", repository_id=repo.id, commit_sha="sha-a",
        files_count=3, chunks_count=10, status="ACTIVE", index_status="COMPLETE"
    )
    db_session.add(snap_a)
    db_session.commit()
    
    files_a = [
        db_models.SnapshotFile(
            snapshot_id=snap_a.id, path="README.md", content_hash="readme-hash",
            size_bytes=100, file_type="FILE"
        ),
        db_models.SnapshotFile(
            snapshot_id=snap_a.id, path="src/main.py", content_hash="main-hash-1",
            size_bytes=500, file_type="FILE"
        ),
        db_models.SnapshotFile(
            snapshot_id=snap_a.id, path="src/utils.py", content_hash="utils-hash",
            size_bytes=300, file_type="FILE"
        )
    ]
    for f in files_a:
        db_session.add(f)
    db_session.commit()
    
    # 2. Create Snapshot B (New)
    snap_b = db_models.RepositorySnapshot(
        id="snap-b", repository_id=repo.id, commit_sha="sha-b",
        files_count=4, chunks_count=12, status="ACTIVE", index_status="COMPLETE"
    )
    db_session.add(snap_b)
    db_session.commit()
    
    # README.md -> UNCHANGED (readme-hash)
    # src/main.py -> MODIFIED (main-hash-2)
    # src/helper.py -> ADDED (helper-hash)
    # src/utility.py -> RENAMED from src/utils.py (utils-hash)
    files_b = [
        db_models.SnapshotFile(
            snapshot_id=snap_b.id, path="README.md", content_hash="readme-hash",
            size_bytes=100, file_type="FILE"
        ),
        db_models.SnapshotFile(
            snapshot_id=snap_b.id, path="src/main.py", content_hash="main-hash-2",
            size_bytes=510, file_type="FILE"
        ),
        db_models.SnapshotFile(
            snapshot_id=snap_b.id, path="src/helper.py", content_hash="helper-hash",
            size_bytes=150, file_type="FILE"
        ),
        db_models.SnapshotFile(
            snapshot_id=snap_b.id, path="src/utility.py", content_hash="utils-hash",
            size_bytes=300, file_type="FILE"
        )
    ]
    for f in files_b:
        db_session.add(f)
    db_session.commit()
    
    # 3. Call diff API
    response = client.get(
        f"/v1/repositories/{repo.id}/snapshots/{snap_a.id}/diff?compare_with={snap_b.id}",
        headers=auth_headers
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    
    assert data["added"] == ["src/helper.py"]
    assert data["removed"] == []
    assert data["modified"] == ["src/main.py"]
    assert data["renamed"] == [{"from": "src/utils.py", "to": "src/utility.py"}]
