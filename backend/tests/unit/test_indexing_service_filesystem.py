import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.indexing_service import IndexingService
from app.core.exceptions import ValidationException, ExternalServiceError
from app.core.config import settings

@pytest.fixture
def indexing_service():
    session = MagicMock()
    return IndexingService(session=session)

@pytest.mark.asyncio
async def test_resolve_repo_root_no_url(indexing_service):
    with pytest.raises(ValidationException, match="Provide either repo_path or repo_url"):
        await indexing_service._resolve_repo_root(
            repo_id="test",
            repo_path=None,
            repo_url=None,
            repo_ref=None
        )

@pytest.mark.asyncio
async def test_resolve_repo_root_clone(indexing_service, tmp_path):
    repo_url = "https://github.com/test/test.git"
    target = tmp_path / "cache" / "test"
    target.parent.mkdir(parents=True, exist_ok=True)
    
    indexing_service._cache_root = MagicMock(return_value=tmp_path / "cache")
    indexing_service._kill_git_processes = MagicMock()
    indexing_service._force_delete_directory = MagicMock()
    indexing_service._run_git = AsyncMock()
    
    result = await indexing_service._resolve_repo_root(
        repo_id="test",
        repo_path=None,
        repo_url=repo_url,
        repo_ref="main"
    )
    
    assert result.name == "test"
    assert indexing_service._run_git.call_count >= 1
    
    # Test Exception
    indexing_service._run_git.side_effect = Exception("Clone failed")
    with pytest.raises(ExternalServiceError):
        await indexing_service._resolve_repo_root(
            repo_id="test",
            repo_path=None,
            repo_url=repo_url,
            repo_ref="main"
        )

@pytest.mark.asyncio
async def test_iter_git_listed_files_filters(indexing_service, tmp_path):
    mock_run_git = AsyncMock()
    # files separated by \0:
    # 1. empty string
    # 2. non_existent.py
    # 3. bad_suffix.invalid
    # 4. low_signal.py
    # 5. large_file.py
    # 6. valid_file.py
    mock_run_git.return_value = MagicMock(stdout="\x00non_existent.py\x00bad_suffix.invalid\x00low_signal.py\x00large_file.py\x00valid_file.py\x00")
    indexing_service._run_git = mock_run_git
    
    (tmp_path / "bad_suffix.invalid").write_text("a")
    (tmp_path / "low_signal.py").write_text("a")
    (tmp_path / "large_file.py").write_text("a" * (settings.max_index_file_size_bytes + 1))
    (tmp_path / "valid_file.py").write_text("a")
    
    indexing_service._is_low_signal_file = MagicMock(side_effect=lambda p, r: "low_signal" in p.name)
    
    files = [f async for f in indexing_service._iter_git_listed_files(tmp_path)]
    assert len(files) == 4
    names = {f.name for f in files}
    assert names == {"bad_suffix.invalid", "low_signal.py", "large_file.py", "valid_file.py"}

def test_is_ignored_dot(indexing_service, tmp_path):
    spec = MagicMock()
    assert indexing_service._is_ignored(spec, tmp_path, tmp_path) is False

@pytest.mark.asyncio
async def test_iter_indexable_files_fallback(indexing_service, tmp_path):
    spec = MagicMock()
    spec.match_file.return_value = False
    
    # Fallback to os.walk when _iter_git_listed_files yields nothing and used_git_listing is False
    async def mock_iter(*args, **kwargs):
        # yields nothing
        if False:
            yield None
    indexing_service._iter_git_listed_files = mock_iter
    
    # Create files for os.walk
    (tmp_path / "valid.py").write_text("a")
    (tmp_path / "large.py").write_text("a" * (settings.max_index_file_size_bytes + 1))
    
    indexing_service._is_low_signal_file = MagicMock(return_value=False)
    
    files = [f async for f in indexing_service._iter_indexable_files(tmp_path, spec)]
    assert len(files) == 2
    names = {f.name for f in files}
    assert names == {"valid.py", "large.py"}
