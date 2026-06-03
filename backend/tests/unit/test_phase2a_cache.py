import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path
from app.services.indexing_service import IndexingService
from app.core.exceptions import ExternalServiceError

@pytest.fixture
def mock_qdrant():
    qdrant = MagicMock()
    qdrant.ensure_collection = MagicMock()
    return qdrant

@pytest.fixture
def indexing_service(mock_qdrant):
    with patch("app.services.indexing_service.QdrantService", return_value=mock_qdrant):
        session = MagicMock()
        return IndexingService(session=session)

@pytest.mark.asyncio
async def test_cache_reuse_success(indexing_service, tmp_path):
    repo_id = "test-repo"
    repo_url = "https://github.com/org/repo.git"
    repo_ref = "main"
    repository_id = "repo-uuid-123"
    
    # Setup mock cache directory
    cache_dir = tmp_path / "repos" / "test-repo"
    cache_dir.mkdir(parents=True)
    meta_file = cache_dir / "cache_meta.json"
    
    with meta_file.open("w", encoding="utf-8") as f:
        json.dump({
            "repository_id": repository_id,
            "repo_url": repo_url,
            "branch": repo_ref,
            "latest_commit_sha": "commit123",
            "cache_schema_version": 2,
            "indexer_version": "1.0.0",
            "last_accessed_at": 100.0
        }, f)
        
    with patch.object(indexing_service, "_cache_root", return_value=tmp_path / "repos"), \
         patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git:
        
        # Mock rev-parse to return the latest commit sha
        mock_proc = MagicMock()
        mock_proc.stdout = "commit123\n"
        mock_git.return_value = mock_proc
        
        root = await indexing_service._resolve_repo_root(
            repo_id=repo_id,
            repo_path=None,
            repo_url=repo_url,
            repo_ref=repo_ref,
            repository_id=repository_id
        )
        
        assert root == cache_dir
        # _run_git should have been called for fetch, checkout, reset, clean, rev-parse
        assert mock_git.call_count >= 2

@pytest.mark.asyncio
async def test_cache_invalidation_stale_branch(indexing_service, tmp_path):
    repo_id = "test-repo"
    repo_url = "https://github.com/org/repo.git"
    repo_ref = "main"
    repository_id = "repo-uuid-123"
    
    cache_dir = tmp_path / "repos" / "test-repo"
    cache_dir.mkdir(parents=True)
    meta_file = cache_dir / "cache_meta.json"
    
    # Mismatched branch in cache meta
    with meta_file.open("w", encoding="utf-8") as f:
        json.dump({
            "repository_id": repository_id,
            "repo_url": repo_url,
            "branch": "feature-branch",
            "latest_commit_sha": "commit123",
            "cache_schema_version": 2,
            "indexer_version": "1.0.0",
            "last_accessed_at": 100.0
        }, f)
        
    with patch.object(indexing_service, "_cache_root", return_value=tmp_path / "repos"), \
         patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git, \
         patch.object(indexing_service, "_force_delete_directory") as mock_delete:
         
        mock_proc = MagicMock()
        mock_proc.stdout = "commit123\n"
        mock_git.return_value = mock_proc
        
        await indexing_service._resolve_repo_root(
            repo_id=repo_id,
            repo_path=None,
            repo_url=repo_url,
            repo_ref=repo_ref,
            repository_id=repository_id
        )
        
        # Basic validation failed, so force delete and recloning must be triggered
        mock_delete.assert_called_once_with(cache_dir)

@pytest.mark.asyncio
async def test_cache_invalidation_changed_url(indexing_service, tmp_path):
    repo_id = "test-repo"
    repo_url = "https://github.com/org/repo.git"
    repo_ref = "main"
    repository_id = "repo-uuid-123"
    
    cache_dir = tmp_path / "repos" / "test-repo"
    cache_dir.mkdir(parents=True)
    meta_file = cache_dir / "cache_meta.json"
    
    # Mismatched repo_url in cache meta
    with meta_file.open("w", encoding="utf-8") as f:
        json.dump({
            "repository_id": repository_id,
            "repo_url": "https://github.com/different/repo.git",
            "branch": repo_ref,
            "latest_commit_sha": "commit123",
            "cache_schema_version": 2,
            "indexer_version": "1.0.0",
            "last_accessed_at": 100.0
        }, f)
        
    with patch.object(indexing_service, "_cache_root", return_value=tmp_path / "repos"), \
         patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git, \
         patch.object(indexing_service, "_force_delete_directory") as mock_delete:
         
        mock_proc = MagicMock()
        mock_proc.stdout = "commit123\n"
        mock_git.return_value = mock_proc
        
        await indexing_service._resolve_repo_root(
            repo_id=repo_id,
            repo_path=None,
            repo_url=repo_url,
            repo_ref=repo_ref,
            repository_id=repository_id
        )
        
        mock_delete.assert_called_once_with(cache_dir)

@pytest.mark.asyncio
async def test_cache_invalidation_diverged_ancestry(indexing_service, tmp_path):
    repo_id = "test-repo"
    repo_url = "https://github.com/org/repo.git"
    repo_ref = "main"
    repository_id = "repo-uuid-123"
    
    cache_dir = tmp_path / "repos" / "test-repo"
    cache_dir.mkdir(parents=True)
    meta_file = cache_dir / "cache_meta.json"
    
    with meta_file.open("w", encoding="utf-8") as f:
        json.dump({
            "repository_id": repository_id,
            "repo_url": repo_url,
            "branch": repo_ref,
            "latest_commit_sha": "commit123",
            "cache_schema_version": 2,
            "indexer_version": "1.0.0",
            "last_accessed_at": 100.0
        }, f)
        
    with patch.object(indexing_service, "_cache_root", return_value=tmp_path / "repos"), \
         patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git, \
         patch.object(indexing_service, "_force_delete_directory") as mock_delete:
         
        # Simulate git merge-base --is-ancestor raising Exception (meaning exit code non-zero, history diverged)
        def git_side_effect(args, **kwargs):
            if "merge-base" in args or "fetch" in args:
                raise Exception("not an ancestor")
            mock_proc = MagicMock()
            mock_proc.stdout = "commit123\n"
            return mock_proc
        mock_git.side_effect = git_side_effect
        
        await indexing_service._resolve_repo_root(
            repo_id=repo_id,
            repo_path=None,
            repo_url=repo_url,
            repo_ref=repo_ref,
            repository_id=repository_id
        )
        
        mock_delete.assert_called_once_with(cache_dir)

@pytest.mark.asyncio
async def test_cache_invalidation_schema_version_mismatch(indexing_service, tmp_path):
    repo_id = "test-repo"
    repo_url = "https://github.com/org/repo.git"
    repo_ref = "main"
    repository_id = "repo-uuid-123"
    
    cache_dir = tmp_path / "repos" / "test-repo"
    cache_dir.mkdir(parents=True)
    meta_file = cache_dir / "cache_meta.json"
    
    # Schema version is 1, not 2
    with meta_file.open("w", encoding="utf-8") as f:
        json.dump({
            "repository_id": repository_id,
            "repo_url": repo_url,
            "branch": repo_ref,
            "latest_commit_sha": "commit123",
            "cache_schema_version": 1,
            "indexer_version": "1.0.0",
            "last_accessed_at": 100.0
        }, f)
        
    with patch.object(indexing_service, "_cache_root", return_value=tmp_path / "repos"), \
         patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git, \
         patch.object(indexing_service, "_force_delete_directory") as mock_delete:
         
        mock_proc = MagicMock()
        mock_proc.stdout = "commit123\n"
        mock_git.return_value = mock_proc
        
        await indexing_service._resolve_repo_root(
            repo_id=repo_id,
            repo_path=None,
            repo_url=repo_url,
            repo_ref=repo_ref,
            repository_id=repository_id
        )
        
        mock_delete.assert_called_once_with(cache_dir)

@pytest.mark.asyncio
async def test_cache_invalidation_indexer_version_mismatch(indexing_service, tmp_path):
    repo_id = "test-repo"
    repo_url = "https://github.com/org/repo.git"
    repo_ref = "main"
    repository_id = "repo-uuid-123"
    
    cache_dir = tmp_path / "repos" / "test-repo"
    cache_dir.mkdir(parents=True)
    meta_file = cache_dir / "cache_meta.json"
    
    # Indexer version is different
    with meta_file.open("w", encoding="utf-8") as f:
        json.dump({
            "repository_id": repository_id,
            "repo_url": repo_url,
            "branch": repo_ref,
            "latest_commit_sha": "commit123",
            "cache_schema_version": 2,
            "indexer_version": "0.9.0",
            "last_accessed_at": 100.0
        }, f)
        
    with patch.object(indexing_service, "_cache_root", return_value=tmp_path / "repos"), \
         patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git, \
         patch.object(indexing_service, "_force_delete_directory") as mock_delete:
         
        mock_proc = MagicMock()
        mock_proc.stdout = "commit123\n"
        mock_git.return_value = mock_proc
        
        await indexing_service._resolve_repo_root(
            repo_id=repo_id,
            repo_path=None,
            repo_url=repo_url,
            repo_ref=repo_ref,
            repository_id=repository_id
        )
        
        mock_delete.assert_called_once_with(cache_dir)
