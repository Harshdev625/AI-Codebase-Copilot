import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.indexing_service import IndexingService
from app.models.domain_models import CodeChunk

@pytest.fixture
def indexing_service():
    with patch("app.services.indexing_service.QdrantService"):
        session = MagicMock()
        return IndexingService(session=session)

@pytest.mark.asyncio
async def test_index_repository_incremental_skip(indexing_service):
    # If the previous commit is identical, incremental should skip
    indexing_service._resolve_repo_root = AsyncMock(return_value=MagicMock())
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._get_previous_completed_commit = MagicMock(return_value="commit1")
    
    with patch("app.services.indexing_service.settings") as mock_settings:
        mock_settings.indexing_force_full_reindex = False
        mock_settings.indexing_incremental_enabled = True
        
        # Act
        result = await indexing_service.index_repository(
            repo_id="test",
            repository_id="test_id",
            commit_sha="commit1",
            full_reindex=False
        )
        assert result == 0

@pytest.mark.asyncio
async def test_index_repository_exception_handling(indexing_service):
    # Should catch and wrap exception
    indexing_service._resolve_repo_root = AsyncMock(side_effect=Exception("resolve failed"))
    indexing_service._format_process_error = MagicMock(return_value="formatted error")
    
    with pytest.raises(Exception):
        await indexing_service.index_repository(
            repo_id="test",
            repository_id="test_id",
            commit_sha="commit1"
        )
        
@pytest.mark.asyncio
async def test_index_repository_incremental_logic(indexing_service):
    # Test incremental logic where previous commit != current commit
    mock_root = MagicMock()
    mock_root.exists.return_value = True
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._get_previous_completed_commit = MagicMock(return_value="commit0")
    
    indexing_service._git_commit_exists = AsyncMock(return_value=True)
    indexing_service._collect_git_diff_paths = AsyncMock(return_value=(["added.py", "modified.py"], ["deleted.py"]))
    
    indexing_service.iter_indexable_files = MagicMock(return_value=[])
    indexing_service._delete_repository_chunks_for_paths = AsyncMock()
    indexing_service._upsert_chunks = AsyncMock()
    
    with patch("app.services.indexing_service.settings") as mock_settings:
        mock_settings.indexing_force_full_reindex = False
        mock_settings.indexing_incremental_enabled = True
        
        result = await indexing_service.index_repository(
            repo_id="test",
            repository_id="test_id",
            commit_sha="commit1",
            full_reindex=False
        )
        
        assert result == 0
        indexing_service._delete_repository_chunks_for_paths.assert_called_once()

@pytest.mark.asyncio
async def test_upsert_chunks_qdrant_exception(indexing_service):
    from app.models.domain_models import CodeChunk
    from app.core.exceptions import ExternalServiceError, DatabaseException
    chunks = [
        CodeChunk(
            id="chunk1",
            repo_id="test",
            repository_id="test_id",
            commit_sha="123",
            path="file.py",
            language="python",
            symbol="",
            chunk_type="generic",
            start_line=1,
            end_line=2,
            content="test"
        )
    ]
    mock_embed = MagicMock(return_value=[0.1] * 768)
    indexing_service.embedder = MagicMock()
    indexing_service.embedder.embed_text = mock_embed
    indexing_service._prefer_cached_embeddings = False
    
    indexing_service.session.execute = MagicMock()
    indexing_service.qdrant.upsert_points = MagicMock(side_effect=ExternalServiceError("qdrant error", "mock_error"))
    
    with patch.object(indexing_service, "_update_progress", new_callable=AsyncMock):
        with pytest.raises(DatabaseException, match="Failed to sync"):
            await indexing_service._upsert_chunks(chunks)

@pytest.mark.asyncio
async def test_index_repository_no_chunks(indexing_service):
    mock_root = MagicMock()
    mock_root.exists.return_value = True
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._get_previous_completed_commit = MagicMock(return_value="commit0")
    
    indexing_service._git_commit_exists = AsyncMock(return_value=True)
    indexing_service._collect_git_diff_paths = AsyncMock(return_value=(["added.py"], []))
    
    indexing_service.iter_indexable_files = MagicMock(return_value=[])
    indexing_service._delete_repository_chunks_for_paths = AsyncMock()
    indexing_service._upsert_chunks = AsyncMock()
    
    with patch("app.services.indexing_service.settings") as mock_settings:
        mock_settings.indexing_force_full_reindex = False
        mock_settings.indexing_incremental_enabled = True
        
        result = await indexing_service.index_repository(
            repo_id="test",
            repository_id="test_id",
            commit_sha="commit1",
            full_reindex=False
        )
        
        assert result == 0
