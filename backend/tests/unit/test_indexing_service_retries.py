import pytest
import os
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
from app.services.indexing_service import IndexingService

@pytest.fixture
def indexing_service():
    session = MagicMock()
    return IndexingService(session=session)

@pytest.mark.asyncio
async def test_delete_dir_with_retry_success(indexing_service, tmp_path):
    target = tmp_path / "test_dir"
    target.mkdir()
    (target / "file.txt").write_text("hello")
    
    await indexing_service._delete_dir_with_retry(target)
    assert not target.exists()

@pytest.mark.asyncio
async def test_delete_dir_with_retry_not_exists(indexing_service, tmp_path):
    target = tmp_path / "not_exist"
    with pytest.raises(RuntimeError, match="Failed to delete directory after multiple attempts"):
        await indexing_service._delete_dir_with_retry(target)

@pytest.mark.asyncio
async def test_delete_dir_with_retry_file(indexing_service, tmp_path):
    target = tmp_path / "file.txt"
    target.write_text("hello")
    
    await indexing_service._delete_dir_with_retry(target)
    assert not target.exists()

@pytest.mark.asyncio
async def test_delete_dir_with_retry_exception(indexing_service, tmp_path):
    target = tmp_path / "test_dir"
    target.mkdir()
    
    original_rmtree = shutil.rmtree
    # Mock shutil.rmtree to fail then succeed
    with patch("app.services.indexing_service.shutil.rmtree") as mock_rmtree:
        # First fail with permission error, second succeed (we must remove it ourselves to simulate success)
        def mock_rm(*args, **kwargs):
            if mock_rmtree.call_count == 1:
                raise PermissionError("Access denied")
            else:
                original_rmtree(target, ignore_errors=True)
                
        mock_rmtree.side_effect = mock_rm
        
        await indexing_service._delete_dir_with_retry(target, delay=0.01)
        assert mock_rmtree.call_count == 2
        assert not target.exists()

def test_on_rm_error():
    indexing_service = IndexingService(session=MagicMock())
    func = MagicMock()
    # It should change permissions and call func
    with patch("app.services.indexing_service.os.chmod") as mock_chmod:
        indexing_service._on_rm_error(func, "path/to/file", None)
        mock_chmod.assert_called_once()
        func.assert_called_once_with("path/to/file")

def test_on_rm_error_exception():
    indexing_service = IndexingService(session=MagicMock())
    func = MagicMock(side_effect=Exception("Failed"))
    with patch("app.services.indexing_service.os.chmod"):
        # Should catch exception and pass
        indexing_service._on_rm_error(func, "path/to/file", None)
