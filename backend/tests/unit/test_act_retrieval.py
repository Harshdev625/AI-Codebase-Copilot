import pytest
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from app.db import models as db_models
from app.services.conflict_service import ConflictService
from app.rag.retrieval.hybrid import hybrid_retrieve, reciprocal_rank_fusion
from app.rag.retrieval.service import RetrievalService
from sqlalchemy import text

@pytest.fixture
def test_setup_retrieval(db_session, test_user):
    repo1 = db_models.Repository(
        id="repo-ret-1",
        owner_user_id=test_user["id"],
        repo_id="repo-1",
        remote_url="https://github.com/test/repo1.git",
        local_path="/mock/cache/repo1",
        default_branch="main",
        latest_indexed_commit="commit-1"
    )
    repo2 = db_models.Repository(
        id="repo-ret-2",
        owner_user_id=test_user["id"],
        repo_id="repo-2",
        remote_url="https://github.com/test/repo2.git",
        local_path="/mock/cache/repo2",
        default_branch="main",
        latest_indexed_commit="commit-2"
    )
    db_session.add_all([repo1, repo2])
    db_session.commit()

    # Create base snapshots
    snap1 = db_models.RepositorySnapshot(
        id="snap-ret-1", repository_id=repo1.id, commit_sha="commit-1",
        files_count=2, chunks_count=2, status="ACTIVE", index_status="COMPLETE"
    )
    snap2 = db_models.RepositorySnapshot(
        id="snap-ret-2", repository_id=repo2.id, commit_sha="commit-2",
        files_count=1, chunks_count=1, status="ACTIVE", index_status="COMPLETE"
    )
    db_session.add_all([snap1, snap2])
    db_session.commit()

    # Base chunks
    chunk1 = db_models.CodeChunk(
        id="c1", repo_id=repo1.repo_id, repository_id=repo1.id, snapshot_id=snap1.id,
        commit_sha="commit-1", path="src/main.py", content="print('hello repo1')",
        language="python", symbol="main", chunk_type="generic", start_line=1, end_line=1,
        status="ACTIVE", content_hash="h1", qdrant_point_id="qp1"
    )
    chunk2 = db_models.CodeChunk(
        id="c2", repo_id=repo1.repo_id, repository_id=repo1.id, snapshot_id=snap1.id,
        commit_sha="commit-1", path="src/utils.py", content="def add(a, b): return a + b",
        language="python", symbol="add", chunk_type="generic", start_line=1, end_line=2,
        status="ACTIVE", content_hash="h2", qdrant_point_id="qp2"
    )
    chunk3 = db_models.CodeChunk(
        id="c3", repo_id=repo2.repo_id, repository_id=repo2.id, snapshot_id=snap2.id,
        commit_sha="commit-2", path="index.js", content="console.log('hello repo2')",
        language="javascript", symbol="", chunk_type="generic", start_line=1, end_line=1,
        status="ACTIVE", content_hash="h3", qdrant_point_id="qp3"
    )
    db_session.add_all([chunk1, chunk2, chunk3])
    db_session.commit()

    # Create an ACT patch draft on repo1
    patch_draft = db_models.ActPatchDraft(
        id="patch-ret-draft", repository_id=repo1.id, base_commit_sha="commit-1",
        status="APPROVED", expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    # Patch files:
    # 1. src/main.py -> MODIFIED
    # 2. src/utils.py -> DELETED
    # 3. src/helper.py -> ADDED
    pf1 = db_models.ActPatchFile(
        patch_id=patch_draft.id, file_path="src/main.py", action="MODIFIED",
        file_diff="diff-main", content_hash_before="h1", content_hash_after="h1-new"
    )
    pf2 = db_models.ActPatchFile(
        patch_id=patch_draft.id, file_path="src/utils.py", action="DELETED",
        file_diff="diff-utils", content_hash_before="h2", content_hash_after=None
    )
    pf3 = db_models.ActPatchFile(
        patch_id=patch_draft.id, file_path="src/helper.py", action="ADDED",
        file_diff="diff-helper", content_hash_before=None, content_hash_after="h3-new"
    )
    db_session.add(patch_draft)
    db_session.add_all([pf1, pf2, pf3])
    db_session.commit()

    # Add a persistent patch chunk for the added file
    p_chunk = db_models.PatchChunk(
        id="pc1", patch_id=patch_draft.id, repository_id=repo1.id, repo_id=repo1.repo_id,
        path="src/helper.py", symbol="helper", language="python", chunk_type="generic",
        start_line=1, end_line=2, content="def helper(): print('I am helper')",
        content_hash="h3-new", qdrant_point_id="qpc1"
    )
    db_session.add(p_chunk)
    db_session.commit()

    return repo1, repo2, patch_draft, snap1, snap2

def test_patch_aware_retrieval_excludes_and_merges(client, auth_headers, test_setup_retrieval, db_session, monkeypatch):
    repo1, repo2, patch_draft, snap1, snap2 = test_setup_retrieval

    # Mock Qdrant dense searches
    # Dense base search returns chunk1 and chunk2
    def mock_dense_search(session, repository_id, query, top_k=20, scope_paths=None, is_patch=False, patch_id=None):
        if patch_id:
            # Ephemeral patch search returns the patch chunk pc1
            return [{
                "id": "pc1", "path": "src/helper.py", "symbol": "helper",
                "content": "def helper(): print('I am helper')", "repository_id": repo1.id,
                "repo_id": repo1.repo_id, "score": 0.9, "is_patch_chunk": True
            }]
        else:
            # Base search returns chunk1 and chunk2 (chunk2 should be excluded later since src/utils.py is deleted)
            return [
                {
                    "id": "c1", "path": "src/main.py", "symbol": "main",
                    "content": "print('hello repo1')", "repository_id": repo1.id,
                    "repo_id": repo1.repo_id, "score": 0.8
                },
                {
                    "id": "c2", "path": "src/utils.py", "symbol": "add",
                    "content": "def add(a, b): return a + b", "repository_id": repo1.id,
                    "repo_id": repo1.repo_id, "score": 0.75
                }
            ]

    # Mock lexical search
    def mock_lexical_search(session, repository_id, query, top_k=20, scope_paths=None, is_patch=False, patch_id=None):
        if patch_id:
            return [{
                "id": "pc1", "path": "src/helper.py", "symbol": "helper",
                "content": "def helper(): print('I am helper')", "repository_id": repo1.id,
                "repo_id": repo1.repo_id, "score": 0.95
            }]
        return []

    monkeypatch.setattr("app.rag.retrieval.hybrid.dense_search", mock_dense_search)
    monkeypatch.setattr("app.rag.retrieval.hybrid.lexical_search", mock_lexical_search)

    # Call retrieval route for repo1 with patch_id
    response = client.post(
        f"/v1/repositories/{repo1.id}/retrieve",
        json={
            "query": "helper function validation",
            "top_k": 5,
            "patch_id": patch_draft.id
        },
        headers=auth_headers
    )
    assert response.status_code == 200, response.text
    items = response.json()["data"]["items"]
    
    # Assertions:
    # 1. c2 (src/utils.py) must be completely excluded because it is DELETED in the patch.
    # 2. pc1 (src/helper.py) must be present as it is ADDED.
    # 3. c1 (src/main.py) is modified but might be merged/present (depending on whether modified files are excluded or not).
    paths = {item["path"] for item in items}
    assert "src/helper.py" in paths
    assert "src/utils.py" not in paths

def test_patch_applied_lifecycle_cleanup(client, auth_headers, test_setup_retrieval, db_session, monkeypatch):
    repo1, repo2, patch_draft, snap1, snap2 = test_setup_retrieval

    # Mock conflict checks and sandbox commands
    monkeypatch.setattr(ConflictService, "detect_drift", lambda self, repo_id, patch_draft: False)
    monkeypatch.setattr("app.services.sandbox_manager.SandboxManager.apply_patch_files", lambda self, *a, **k: None)
    monkeypatch.setattr("app.services.indexing_service.IndexingService._resolve_repo_root", lambda *a, **k: Path("/mock/cache/repo1"))

    # Mock indexing call to perform a fake index update
    def mock_queue_repository_indexing(session, repository_row, **kwargs):
        # Insert a new production code chunk to simulate reindexing
        c_new = db_models.CodeChunk(
            id="c1-new", repo_id=repo1.repo_id, repository_id=repo1.id, snapshot_id="snap-post-apply",
            commit_sha="commit-new", path="src/main.py", content="print('hello repo1 patched')",
            language="python", symbol="main", chunk_type="generic", start_line=1, end_line=1,
            status="ACTIVE", content_hash="h1-new", qdrant_point_id="qp1-new"
        )
        session.add(c_new)
        session.commit()
        return {"indexing_job_id": "job-1"}

    # Mocking create_snapshot to return a post snap and insert it to satisfy foreign key constraints
    def mock_create_snapshot(session, repository_id, commit_sha, *args, **kwargs):
        snap = db_models.RepositorySnapshot(
            id="snap-post-apply",
            repository_id=repository_id,
            commit_sha=commit_sha,
            files_count=1,
            chunks_count=1,
            status="ACTIVE",
            index_status="COMPLETE"
        )
        session.add(snap)
        session.commit()
        return "snap-post-apply"

    monkeypatch.setattr("app.services.indexing_helpers.create_snapshot", mock_create_snapshot)

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="commit-new\n")
        
        # Intercept apply endpoint or mock reindexing helper
        with patch("app.api.v1.repositories.router.service.queue_repository_indexing", mock_queue_repository_indexing):
            response = client.post(
                f"/v1/repositories/{repo1.id}/patches/{patch_draft.id}/apply",
                headers=auth_headers
            )
            assert response.status_code == 200, response.text

            # Verify patch status is APPLIED
            db_session.refresh(patch_draft)
            assert patch_draft.status == "APPLIED"

            # Verify patch_chunks and patch vectors have been removed
            p_chunks = db_session.query(db_models.PatchChunk).filter_by(patch_id=patch_draft.id).all()
            assert len(p_chunks) == 0
