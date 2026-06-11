import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path
from pathspec import PathSpec
from pathspec.patterns import GitWildMatchPattern
from app.services.indexing_service import IndexingService
from app.core.exceptions import ValidationException, DatabaseException

@pytest.fixture
def mock_qdrant():
    qdrant = MagicMock()
    qdrant.ensure_collection = MagicMock()
    qdrant.delete_points_by_repository = MagicMock()
    qdrant.delete_points_by_ids = MagicMock()
    return qdrant

@pytest.fixture
def indexing_service(mock_qdrant):
    with patch("app.services.indexing_service.QdrantService", return_value=mock_qdrant):
        session = MagicMock()
        return IndexingService(session=session)

def test_get_previous_completed_commit(indexing_service):
    assert indexing_service._get_previous_completed_commit("repo1") is None

@pytest.mark.asyncio
async def test_git_commit_exists_no_sha(indexing_service, tmp_path):
    assert not await indexing_service._git_commit_exists(tmp_path, "")

@pytest.mark.asyncio
async def test_git_commit_exists_no_git(indexing_service, tmp_path):
    assert not await indexing_service._git_commit_exists(tmp_path, "123")

@pytest.mark.asyncio
async def test_git_commit_exists_success(indexing_service, tmp_path):
    (tmp_path / ".git").mkdir()
    with patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git:
        assert await indexing_service._git_commit_exists(tmp_path, "123")
        mock_git.assert_called_once()

@pytest.mark.asyncio
async def test_git_commit_exists_failure(indexing_service, tmp_path):
    (tmp_path / ".git").mkdir()
    with patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git:
        mock_git.side_effect = RuntimeError("git error")
        assert not await indexing_service._git_commit_exists(tmp_path, "123")

@pytest.mark.asyncio
async def test_collect_git_diff_paths_no_git(indexing_service, tmp_path):
    with pytest.raises(ValidationException, match="not a git checkout"):
        await indexing_service._collect_git_diff_paths(tmp_path, "old", "new")

@pytest.mark.asyncio
async def test_collect_git_diff_paths_no_base(indexing_service, tmp_path):
    (tmp_path / ".git").mkdir()
    with patch.object(indexing_service, "_git_commit_exists", new_callable=AsyncMock) as mock_exists:
        mock_exists.return_value = False
        with pytest.raises(ValidationException, match="Base commit not available locally"):
            await indexing_service._collect_git_diff_paths(tmp_path, "old", "new")

@pytest.mark.asyncio
async def test_collect_git_diff_paths_success(indexing_service, tmp_path):
    (tmp_path / ".git").mkdir()
    with patch.object(indexing_service, "_git_commit_exists", new_callable=AsyncMock) as mock_exists:
        mock_exists.side_effect = [True, True]
        with patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git:
            mock_process = MagicMock()
            mock_process.stdout = "M\tfile1.py\nD\tfile2.py\nR100\told.py\tnew.py\n\t"
            mock_git.return_value = mock_process
            
            changed, deleted = await indexing_service._collect_git_diff_paths(tmp_path, "old", "new")
            
            assert "file1.py" in changed
            assert "new.py" in changed
            assert "file2.py" in deleted
            assert "old.py" in deleted

def test_filter_incremental_files(indexing_service, tmp_path):
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    
    f1 = repo_root / "valid.py"
    f1.write_text("1")
    
    f2 = repo_root / "ignored.py"
    f2.write_text("1")
    
    f3 = repo_root / "invalid.unknown"
    f3.write_text("1")
    
    f4 = repo_root / "node_modules" / "test.js"
    f4.parent.mkdir()
    f4.write_text("1")
    
    f5 = repo_root / "missing.py"
    
    spec = PathSpec.from_lines(GitWildMatchPattern, ["ignored.py"])
    
    paths = {"valid.py", "ignored.py", "invalid.unknown", "node_modules/test.js", "missing.py"}
    filtered = indexing_service._filter_incremental_files(repo_root, spec, paths)
    
    assert len(filtered) == 3
    assert f1 in filtered
    assert f3 in filtered
    assert f4 in filtered

@pytest.mark.asyncio
async def test_delete_qdrant_with_retry_success(indexing_service):
    mock_func = MagicMock()
    await indexing_service._delete_qdrant_with_retry("test", mock_func, "arg1", max_retries=1)
    mock_func.assert_called_once_with("arg1")

@pytest.mark.asyncio
async def test_delete_qdrant_with_retry_failure(indexing_service):
    mock_func = MagicMock(side_effect=RuntimeError("fail"))
    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(RuntimeError, match="Qdrant deletion failed"):
            await indexing_service._delete_qdrant_with_retry("test", mock_func, "arg1", max_retries=1)

@pytest.mark.asyncio
async def test_delete_all_repository_chunks(indexing_service):
    indexing_service.session.execute = MagicMock()
    indexing_service.session.commit = MagicMock()
    
    await indexing_service._delete_all_repository_chunks("repo1")
    indexing_service.session.execute.assert_called_once()
    indexing_service.session.commit.assert_called_once()

@pytest.mark.asyncio
async def test_delete_all_repository_chunks_db_error(indexing_service):
    indexing_service.session.execute = MagicMock(side_effect=Exception("DB error"))
    indexing_service.session.rollback = MagicMock()
    
    with pytest.raises(DatabaseException):
        await indexing_service._delete_all_repository_chunks("repo1")
    indexing_service.session.rollback.assert_called_once()

@pytest.mark.asyncio
async def test_delete_repository_chunks_for_paths(indexing_service, tmp_path):
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    
    indexing_service.session.execute = MagicMock()
    indexing_service.session.commit = MagicMock()
    
    await indexing_service._delete_repository_chunks_for_paths("repo1", repo_root, {"file1.py"})
    # Two-phase delete: collect IDs, then delete rows
    assert indexing_service.session.execute.call_count == 2
    indexing_service.session.commit.assert_called_once()
