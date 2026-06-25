import pytest
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from app.db import models as db_models
from app.services.sandbox_manager import SandboxManager
from app.services.validation_engine import ValidationEngine
from app.services.patch_lifecycle_service import PatchLifecycleService
from app.services.conflict_service import ConflictService
from sqlalchemy import text

@pytest.fixture
def test_setup(db_session, test_user):
    repo = db_models.Repository(
        id="repo-patch",
        owner_user_id=test_user["id"],
        repo_id="test-patch-repo",
        remote_url="https://github.com/test/repo.git",
        local_path="/mock/cache",
        default_branch="main"
    )
    db_session.add(repo)
    db_session.commit()
    
    # Pre-seed a base snapshot
    snapshot = db_models.RepositorySnapshot(
        id="snap-base",
        repository_id=repo.id,
        commit_sha="commit-base",
        files_count=2,
        chunks_count=10,
        status="ACTIVE",
        index_status="COMPLETE"
    )
    db_session.add(snapshot)
    db_session.commit()
    
    files = [
        db_models.SnapshotFile(
            snapshot_id=snapshot.id, path="src/main.py", content_hash="hash-main-base",
            size_bytes=100, file_type="FILE", language="python", line_count=10
        ),
        db_models.SnapshotFile(
            snapshot_id=snapshot.id, path="src/utils.py", content_hash="hash-utils-base",
            size_bytes=200, file_type="FILE", language="python", line_count=15
        )
    ]
    for f in files:
        db_session.add(f)
    db_session.commit()
    
    return test_user, repo, snapshot

def test_create_patch_draft(client, auth_headers, test_setup, db_session):
    user, repo, snapshot = test_setup
    payload = {
        "base_commit_sha": "commit-base",
        "patch_files": [
            {
                "file_path": "src/main.py",
                "action": "MODIFIED",
                "file_diff": "--- a/src/main.py\n+++ b/src/main.py\n",
                "content_hash_before": "hash-main-base",
                "content_hash_after": "hash-main-new"
            }
        ]
    }
    
    response = client.post(
        f"/v1/repositories/{repo.id}/patches",
        json=payload,
        headers=auth_headers
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["status"] == "DRAFT"
    assert "patch_id" in data
    
    # Verify DB records
    patch_id = data["patch_id"]
    draft = db_session.query(db_models.ActPatchDraft).filter_by(id=patch_id).first()
    assert draft is not None
    assert draft.base_commit_sha == "commit-base"
    assert len(draft.patch_files) == 1
    assert draft.patch_files[0].file_path == "src/main.py"
    assert draft.patch_files[0].file_diff == "--- a/src/main.py\n+++ b/src/main.py\n"

def test_validate_patch_draft(client, auth_headers, test_setup, db_session, monkeypatch):
    user, repo, snapshot = test_setup
    
    # 1. Create a draft patch in DB
    draft = db_models.ActPatchDraft(
        id="patch-val-123",
        repository_id=repo.id,
        base_commit_sha="commit-base",
        status="DRAFT",
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    patch_file = db_models.ActPatchFile(
        patch_id=draft.id,
        file_path="src/main.py",
        action="MODIFIED",
        file_diff="--- a/src/main.py\n+++ b/src/main.py\n",
        content_hash_before="hash-main-base",
        content_hash_after="hash-main-new"
    )
    db_session.add(draft)
    db_session.add(patch_file)
    db_session.commit()
    
    # Mock SandboxManager and ValidationEngine
    monkeypatch.setattr(SandboxManager, "create_sandbox", lambda self, *a, **k: Path("/mock/sandbox"))
    monkeypatch.setattr(SandboxManager, "apply_patch_files", lambda self, *a, **k: None)
    monkeypatch.setattr(SandboxManager, "destroy_sandbox", lambda self, *a, **k: None)
    monkeypatch.setattr(ValidationEngine, "validate_patch", lambda self, *a, **k: (True, "All validation stages passed"))
    
    response = client.post(
        f"/v1/repositories/{repo.id}/patches/{draft.id}/validate",
        headers=auth_headers
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["status"] == "APPROVED"
    assert "All validation stages passed" in data["validation_logs"]

def test_apply_patch_drift_conflict(client, auth_headers, test_setup, db_session, monkeypatch):
    user, repo, snapshot = test_setup
    
    # Create approved draft in DB
    draft = db_models.ActPatchDraft(
        id="patch-apply-conflict",
        repository_id=repo.id,
        base_commit_sha="commit-base",
        status="APPROVED",
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    patch_file = db_models.ActPatchFile(
        patch_id=draft.id,
        file_path="src/main.py",
        action="MODIFIED",
        file_diff="--- a/src/main.py\n+++ b/src/main.py\n",
        # Set expected before hash to hash-main-base
        content_hash_before="hash-main-base",
        content_hash_after="hash-main-new"
    )
    db_session.add(draft)
    db_session.add(patch_file)
    db_session.commit()
    
    # Mock drift detection to raise a conflict (e.g. file content has changed in cache to another hash)
    monkeypatch.setattr(ConflictService, "detect_drift", lambda self, repo_id, patch_draft: True)
    
    response = client.post(
        f"/v1/repositories/{repo.id}/patches/{draft.id}/apply",
        headers=auth_headers
    )
    assert response.status_code == 409, response.text
    assert "Conflict detected" in response.json()["error"]["message"]
    
    # Verify DB status is CONFLICTED
    db_session.refresh(draft)
    assert draft.status == "CONFLICTED"

def test_apply_patch_success(client, auth_headers, test_setup, db_session, monkeypatch):
    user, repo, snapshot = test_setup
    
    draft = db_models.ActPatchDraft(
        id="patch-apply-success",
        repository_id=repo.id,
        base_commit_sha="commit-base",
        status="APPROVED",
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    patch_file = db_models.ActPatchFile(
        patch_id=draft.id,
        file_path="src/main.py",
        action="MODIFIED",
        file_diff="--- a/src/main.py\n+++ b/src/main.py\n",
        content_hash_before="hash-main-base",
        content_hash_after="hash-main-new"
    )
    db_session.add(draft)
    db_session.add(patch_file)
    db_session.commit()
    
    # Mock ConflictService (no drift)
    monkeypatch.setattr(ConflictService, "detect_drift", lambda self, repo_id, patch_draft: False)
    
    # Mock filesystem operations
    monkeypatch.setattr(SandboxManager, "apply_patch_files", lambda self, *a, **k: None)
    
    # Mock snapshot creation
    post_snapshot_id = "snap-post-apply"
    def mock_create_snapshot(session, repository_id, commit_sha, files_count, files_skipped, chunks_count):
        # Insert a post snapshot row
        snap = db_models.RepositorySnapshot(
            id=post_snapshot_id, repository_id=repository_id, commit_sha=commit_sha,
            files_count=files_count, chunks_count=chunks_count, status="ACTIVE", index_status="COMPLETE"
        )
        session.add(snap)
        session.commit()
        return post_snapshot_id
        
    monkeypatch.setattr("app.services.indexing_helpers.create_snapshot", mock_create_snapshot)
    monkeypatch.setattr("app.services.indexing_service.IndexingService._resolve_repo_root", lambda *a, **k: Path("/mock/cache"))
    
    # Mock git commands inside apply
    class MockGit:
        def __init__(self, *a, **k): pass
        async def rev_parse(self, *a, **k):
            return type("Res", (), {"stdout": "commit-new"})()
            
    monkeypatch.setattr("app.services.indexing_service.IndexingService", MagicMock())
    
    # We trigger apply route
    # Mocking execution to get past subprocess git rev-parse commands
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="commit-new\n")
        response = client.post(
            f"/v1/repositories/{repo.id}/patches/{draft.id}/apply",
            headers=auth_headers
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["status"] == "APPLIED"
        
        # Verify DB updates
        db_session.refresh(draft)
        assert draft.status == "APPLIED"
        assert draft.pre_apply_snapshot_id == "snap-base"
        assert draft.post_apply_snapshot_id == post_snapshot_id
        assert draft.applied_commit_sha_before == "commit-base"

def test_explorer_tree_sandbox_overlay(client, auth_headers, test_setup, db_session):
    user, repo, snapshot = test_setup
    
    draft = db_models.ActPatchDraft(
        id="patch-tree-overlay",
        repository_id=repo.id,
        base_commit_sha="commit-base",
        status="DRAFT",
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    # Patch files:
    # 1. src/main.py -> MODIFIED
    # 2. src/helper.py -> ADDED
    # 3. src/utils.py -> DELETED
    patch_files = [
        db_models.ActPatchFile(
            patch_id=draft.id, file_path="src/main.py", action="MODIFIED",
            file_diff="diff1", content_hash_before="h1", content_hash_after="h2"
        ),
        db_models.ActPatchFile(
            patch_id=draft.id, file_path="src/helper.py", action="ADDED",
            file_diff="diff2", content_hash_before=None, content_hash_after="h3"
        ),
        db_models.ActPatchFile(
            patch_id=draft.id, file_path="src/utils.py", action="DELETED",
            file_diff="diff3", content_hash_before="h4", content_hash_after=None
        )
    ]
    db_session.add(draft)
    for pf in patch_files:
        db_session.add(pf)
    db_session.commit()
    
    # Fetch tree for sandbox segment 'src'
    # Snapshot base contains: src/main.py, src/utils.py
    # Overlay adds src/helper.py, modifies src/main.py, deletes src/utils.py
    # Outcome should contain: src/main.py, src/helper.py
    response = client.get(
        f"/v1/repositories/{repo.id}/tree?snapshot_id=snap-base&patch_id={draft.id}&path=src",
        headers=auth_headers
    )
    assert response.status_code == 200, response.text
    items = response.json()["data"]["items"]
    paths = {item["path"] for item in items}
    assert paths == {"src/main.py", "src/helper.py"}

def test_cleanup_expired_drafts(db_session, test_setup, monkeypatch):
    user, repo, snapshot = test_setup
    
    # 1. Create one expired patch draft and one active patch draft
    expired = db_models.ActPatchDraft(
        id="patch-expired", repository_id=repo.id, base_commit_sha="commit-base",
        status="DRAFT", expires_at=datetime.utcnow() - timedelta(hours=1)
    )
    active = db_models.ActPatchDraft(
        id="patch-active", repository_id=repo.id, base_commit_sha="commit-base",
        status="DRAFT", expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db_session.add_all([expired, active])
    db_session.commit()
    
    # Mock SandboxManager
    mock_destroy = MagicMock()
    monkeypatch.setattr(SandboxManager, "destroy_sandbox", mock_destroy)
    
    # Run lifecycle cleanup service
    service = PatchLifecycleService(db_session)
    with patch("pathlib.Path.exists", return_value=True):
        service.cleanup_expired_drafts()
    
    # Verify expired was deleted, active remains
    drafts = {d.id for d in db_session.query(db_models.ActPatchDraft).all()}
    assert "patch-expired" not in drafts
    assert "patch-active" in drafts
    mock_destroy.assert_called_once()
