import pytest
from pathlib import Path
from unittest.mock import MagicMock
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
async def test_delete_repository_chunks_for_paths_db_exception(indexing_service, tmp_path):
    repo_root = tmp_path
    
    # Mock session.execute to raise Exception
    indexing_service.session.execute.side_effect = Exception("DB error")
    
    with pytest.raises(DatabaseException, match="Failed to mark chunks as OBSOLETE for specific paths"):
        await indexing_service._delete_repository_chunks_for_paths("test-repo", repo_root, {"file1.txt"})
        
    indexing_service.session.rollback.assert_called_once()
