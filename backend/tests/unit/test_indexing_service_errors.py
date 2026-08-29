import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.indexing_service import IndexingService
from app.models.domain_models import CodeChunk

@pytest.fixture
def indexing_service():
    with patch("app.services.indexing_service.QdrantService"):
        session = MagicMock()
        # Mock supports_begin and supports_nested
        session.begin = MagicMock()
        session.begin_nested = MagicMock()
        return IndexingService(session=session)

@pytest.mark.asyncio
async def test_upsert_chunks_db_exceptions(indexing_service):
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
    
    mock_embed = MagicMock(return_value=[0.1] * 1024)
    indexing_service.embedder = MagicMock()
    indexing_service.embedder.embed_text = mock_embed
    indexing_service._prefer_cached_embeddings = False
    
    # First execute fails, second execute (fallback) succeeds
    indexing_service.session.execute = MagicMock(side_effect=[Exception("db error"), None])
    
    with patch.object(indexing_service, "_update_progress", new_callable=AsyncMock):
        await indexing_service._upsert_chunks(chunks)
        
        # It should try with embedding, fail, then try without embedding and succeed.
        assert indexing_service.session.execute.call_count == 2
        # Since it succeeded without embeddings, no point was queued for Qdrant
        indexing_service.qdrant.upsert_points.assert_not_called()

@pytest.mark.asyncio
async def test_upsert_chunks_db_exceptions_both_fail(indexing_service):
    chunks = [
        CodeChunk(
            id="chunk2",
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
    
    # Both execute fail
    indexing_service.session.execute = MagicMock(side_effect=[Exception("db error 1"), Exception("db error 2")])
    
    from app.core.exceptions import DatabaseException
    with patch.object(indexing_service, "_update_progress", new_callable=AsyncMock):
        with pytest.raises(DatabaseException, match="Indexing produced chunks, but none were stored to PostgreSQL."):
            await indexing_service._upsert_chunks(chunks)

@pytest.mark.asyncio
async def test_index_repository_exception_in_loop(indexing_service):
    mock_root = MagicMock()
    mock_root.exists.return_value = True
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    
    indexing_service._git_commit_exists = AsyncMock(return_value=True)
    indexing_service._collect_git_diff_paths = AsyncMock(return_value=(["added.py"], []))
    
    async def mock_async_iter(*args, **kwargs):
        yield MagicMock()
        
    indexing_service._iter_indexable_files = mock_async_iter
    indexing_service.generic_chunk_file = MagicMock(side_effect=Exception("chunking failed"))
    
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
