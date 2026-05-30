import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.indexing_service import IndexingService
from app.core.exceptions import DatabaseException

@pytest.fixture
def indexing_service():
    session = MagicMock()
    service = IndexingService(session=session)
    service.qdrant = MagicMock()
    service.qdrant.ensure_collection = MagicMock()
    return service

@pytest.mark.asyncio
async def test_delete_repository_chunks_for_paths_empty(indexing_service, tmp_path):
    """Empty relative_paths should return early without touching DB or Qdrant."""
    await indexing_service._delete_repository_chunks_for_paths("test-repo", tmp_path, set())
    indexing_service.session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_delete_repository_chunks_for_paths_collect_ids_exception(indexing_service, tmp_path):
    repo_root = tmp_path
    
    # Ensure qdrant doesn't blow up
    indexing_service.qdrant.ensure_collection = MagicMock()
    # Mock session.execute to raise Exception (collect ids phase)
    indexing_service.session.execute.side_effect = Exception("DB error")
    
    with pytest.raises(DatabaseException, match="Failed to collect chunk IDs for deletion"):
        await indexing_service._delete_repository_chunks_for_paths("test-repo", repo_root, {"file1.txt"})
        
    indexing_service.session.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_delete_repository_chunks_for_paths_db_delete_exception(indexing_service, tmp_path):
    repo_root = tmp_path
    
    # Mock collect IDs to succeed (returns rows with chunk IDs)
    mock_result = MagicMock()
    mock_result.mappings.return_value.all.return_value = [{"id": "chunk1"}]
    
    call_count = [0]
    def mock_execute(stmt, params):
        call_count[0] += 1
        if "SELECT id" in str(stmt):
            return mock_result
        raise Exception("Delete error")
        
    indexing_service.session.execute.side_effect = mock_execute
    indexing_service._delete_qdrant_with_retry = AsyncMock()
    
    with pytest.raises(DatabaseException, match="Failed to delete chunks for specific paths"):
        await indexing_service._delete_repository_chunks_for_paths("test-repo", repo_root, {"file1.txt"})
        
    indexing_service._delete_qdrant_with_retry.assert_called_once()
    indexing_service.session.rollback.assert_called_once()
