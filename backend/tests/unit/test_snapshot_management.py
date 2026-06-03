import pytest
import uuid
import base64
from datetime import datetime
from app.db import models as db_models
from sqlalchemy import text

@pytest.fixture
def test_setup(db_session, test_user):
    repo = db_models.Repository(
        id="repo-123",
        owner_user_id=test_user["id"],
        repo_id="test-repo",
        remote_url="https://github.com/test/repo.git",
        default_branch="main"
    )
    db_session.add(repo)
    db_session.commit()
    return test_user, repo

def test_snapshot_immutability(db_session, test_setup):
    user, repo = test_setup
    
    # 1. Create a snapshot
    snapshot = db_models.RepositorySnapshot(
        id="snap-123",
        repository_id=repo.id,
        commit_sha="commit-123",
        files_count=10,
        chunks_count=50,
        files_skipped=0,
        is_pinned=False,
        is_release=False,
        status="ACTIVE",
        index_status="COMPLETE",
        indexer_version="1.0.0",
        last_indexed_at=datetime.utcnow()
    )
    db_session.add(snapshot)
    db_session.commit()
    
    # 2. Attempt to update commit_sha and assert ValueError is raised
    snapshot.commit_sha = "commit-changed"
    with pytest.raises(ValueError) as excinfo:
        db_session.commit()
    assert "Column 'commit_sha' cannot be updated" in str(excinfo.value)
    db_session.rollback()
    
    # 3. Attempt to update files_count and assert ValueError
    snapshot.files_count = 20
    with pytest.raises(ValueError) as excinfo:
        db_session.commit()
    assert "Column 'files_count' cannot be updated" in str(excinfo.value)
    db_session.rollback()

    # 4. Attempt to update chunks_count and assert ValueError
    snapshot.chunks_count = 100
    with pytest.raises(ValueError) as excinfo:
        db_session.commit()
    assert "Column 'chunks_count' cannot be updated" in str(excinfo.value)
    db_session.rollback()
    
    # 5. Verify other fields can be updated
    snapshot.is_pinned = True
    snapshot.status = "PINNED"
    snapshot.index_status = "FAILED"
    db_session.commit()
    
    db_session.refresh(snapshot)
    assert snapshot.is_pinned is True
    assert snapshot.status == "PINNED"
    assert snapshot.index_status == "FAILED"

def test_snapshot_explorer_tree(client, auth_headers, test_setup, db_session):
    user, repo = test_setup
    
    # 1. Create snapshot
    snapshot = db_models.RepositorySnapshot(
        id="snap-tree",
        repository_id=repo.id,
        commit_sha="commit-tree",
        files_count=3,
        chunks_count=10,
        status="ACTIVE",
        index_status="COMPLETE"
    )
    db_session.add(snapshot)
    db_session.commit()
    
    # 2. Create snapshot files
    files = [
        db_models.SnapshotFile(
            snapshot_id=snapshot.id, path="README.md", content_hash="hash-readme",
            size_bytes=100, file_type="FILE", language="markdown", line_count=5
        ),
        db_models.SnapshotFile(
            snapshot_id=snapshot.id, path="src/main.py", content_hash="hash-main",
            size_bytes=500, file_type="FILE", language="python", line_count=20
        ),
        db_models.SnapshotFile(
            snapshot_id=snapshot.id, path="src/utils.py", content_hash="hash-utils",
            size_bytes=300, file_type="FILE", language="python", line_count=15
        )
    ]
    for f in files:
        db_session.add(f)
    db_session.commit()
    
    # 3. Query root tree for snapshot
    response = client.get(
        f"/v1/repositories/{repo.id}/tree?snapshot_id={snapshot.id}",
        headers=auth_headers
    )
    assert response.status_code == 200, response.text
    items = response.json()["data"]["items"]
    paths = {item["path"] for item in items}
    assert paths == {"README.md", "src"}
    
    # 4. Query src directory for snapshot
    response = client.get(
        f"/v1/repositories/{repo.id}/tree?snapshot_id={snapshot.id}&path=src",
        headers=auth_headers
    )
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    paths = {item["path"] for item in items}
    assert paths == {"src/main.py", "src/utils.py"}
    
    # 5. Keyset Cursor Pagination test
    response = client.get(
        f"/v1/repositories/{repo.id}/tree?snapshot_id={snapshot.id}&limit=1",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()["data"]
    items = data["items"]
    assert len(items) == 1
    assert items[0]["path"] == "README.md"
    next_cursor = data["next_cursor"]
    assert next_cursor is not None
    
    response = client.get(
        f"/v1/repositories/{repo.id}/tree?snapshot_id={snapshot.id}&limit=1&cursor={next_cursor}",
        headers=auth_headers
    )
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["path"] == "src"
