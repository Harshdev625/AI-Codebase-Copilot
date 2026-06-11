from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import subprocess
import os
import stat
from pathspec import PathSpec
from pathspec.patterns import GitWildMatchPattern

from app.services.indexing_service import IndexingService


@pytest.fixture
def mock_qdrant():
    qdrant = MagicMock()
    qdrant.upsert_points = AsyncMock()
    qdrant.delete_points_for_repository = AsyncMock()
    return qdrant


@pytest.fixture
def mock_embedding_provider():
    provider = MagicMock()
    provider.get_embedding = AsyncMock(return_value=[0.1] * 1536)
    return provider


@pytest.fixture
def indexing_service(mock_qdrant, mock_embedding_provider):
    with patch("app.services.indexing_service.QdrantService", return_value=mock_qdrant):
        with patch("app.services.indexing_service.get_embedding_provider", return_value=mock_embedding_provider):
            session = MagicMock()
            return IndexingService(session=session)


def test_slugify_repo_id(indexing_service):
    assert indexing_service._slugify_repo_id("org/repo-name_123") == "org_repo-name_123"
    assert indexing_service._slugify_repo_id("user!@#repo") == "user___repo"


def test_is_low_signal_file(indexing_service, tmp_path):
    repo_root = tmp_path / "repo"
    
    # Test low signal dirs
    node_modules_file = repo_root / "node_modules" / "test.js"
    assert indexing_service._is_low_signal_file(node_modules_file, repo_root) is True
    
    venv_file = repo_root / ".venv" / "lib" / "test.py"
    assert indexing_service._is_low_signal_file(venv_file, repo_root) is True
    
    # Test specific file names
    min_js = repo_root / "src" / "app.min.js"
    assert indexing_service._is_low_signal_file(min_js, repo_root) is True
    
    map_file = repo_root / "src" / "app.js.map"
    assert indexing_service._is_low_signal_file(map_file, repo_root) is True
    
    # Test valid files
    valid_file = repo_root / "src" / "app.py"
    assert indexing_service._is_low_signal_file(valid_file, repo_root) is False


@pytest.mark.asyncio
async def test_run_git_success(indexing_service):
    with patch("subprocess.run") as mock_run:
        mock_process = MagicMock(returncode=0, stdout="git output\n", stderr="")
        mock_run.return_value = mock_process
        
        result = await indexing_service._run_git(["status"])
        assert result.returncode == 0
        assert result.stdout == "git output\n"
        mock_run.assert_called_once()


@pytest.mark.asyncio
async def test_run_git_timeout(indexing_service):
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="git status", timeout=300)
        
        with pytest.raises(RuntimeError, match="Git command timed out"):
            await indexing_service._run_git(["status"])


@pytest.mark.asyncio
async def test_run_git_called_process_error(indexing_service):
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(returncode=1, cmd="git status", stderr="git error")
        
        with pytest.raises(RuntimeError, match="Git command failed: git error"):
            await indexing_service._run_git(["status"])


def test_format_process_error(indexing_service):
    exc1 = subprocess.CalledProcessError(1, "cmd", stderr="my stderr")
    assert indexing_service._format_process_error(exc1, "default") == "my stderr"
    
    exc2 = subprocess.CalledProcessError(1, "cmd", output="my stdout")
    assert indexing_service._format_process_error(exc2, "default") == "my stdout"
    
    exc3 = subprocess.CalledProcessError(1, "cmd")
    assert indexing_service._format_process_error(exc3, "default") == "git exited with code 1"
    
    exc4 = ValueError("custom error")
    assert indexing_service._format_process_error(exc4, "default") == "custom error"


@pytest.mark.asyncio
async def test_resolve_repo_root_local_path(indexing_service, tmp_path):
    repo_dir = tmp_path / "my_repo"
    repo_dir.mkdir()
    
    # Path provided
    root = await indexing_service._resolve_repo_root("repo1", str(repo_dir), None, None)
    assert root == repo_dir


@pytest.mark.asyncio
async def test_resolve_repo_root_local_path_not_exists(indexing_service):
    from app.core.exceptions import ValidationException
    with pytest.raises(ValidationException, match="Repository path does not exist"):
        await indexing_service._resolve_repo_root("repo1", "/does/not/exist/ever", None, None)


@pytest.mark.asyncio
async def test_resolve_repo_root_url_clone(indexing_service, tmp_path):
    with patch.object(indexing_service, "_cache_root", return_value=tmp_path):
        with patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git:
            root = await indexing_service._resolve_repo_root("repo_slug", None, "https://github.com/a/b", "main")
            assert root == tmp_path / "repo_slug"
            assert mock_git.call_count >= 1
            args = mock_git.call_args_list[0][0][0]
            assert args == ["clone", "https://github.com/a/b", str(tmp_path / "repo_slug")]


@pytest.mark.asyncio
async def test_resolve_repo_root_url_clone_failure(indexing_service, tmp_path):
    from app.core.exceptions import ExternalServiceError
    with patch.object(indexing_service, "_cache_root", return_value=tmp_path):
        with patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git:
            mock_git.side_effect = RuntimeError("clone failed")
            with pytest.raises(ExternalServiceError, match="Error communicating with external service: Git"):
                await indexing_service._resolve_repo_root("repo_slug", None, "https://github.com/a/b", None)


def test_load_gitignore_spec(indexing_service, tmp_path):
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    gitignore = repo_root / ".gitignore"
    gitignore.write_text("*.log\n# comment\nbuild/")
    
    spec = indexing_service._load_gitignore_spec(repo_root)
    assert indexing_service._is_ignored(spec, repo_root, repo_root / "test.log") is True
    assert indexing_service._is_ignored(spec, repo_root, repo_root / "build", is_dir=True) is True
    assert indexing_service._is_ignored(spec, repo_root, repo_root / "test.py") is False


@pytest.mark.asyncio
async def test_iter_git_listed_files(indexing_service, tmp_path):
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    
    f1 = repo_root / "test.py"
    f2 = repo_root / "test.txt"
    f3 = repo_root / "node_modules" / "test.js" # low signal
    
    f1.write_text("print(1)")
    f2.write_text("text")
    f3.parent.mkdir()
    f3.write_text("console.log(1)")
    
    mock_process = MagicMock()
    mock_process.stdout = "test.py\x00test.txt\x00node_modules/test.js\x00does_not_exist.py\x00"
    
    with patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git:
        mock_git.return_value = mock_process
        
        files = [f async for f in indexing_service._iter_git_listed_files(repo_root)]
        assert len(files) == 3
        assert f1 in files
        assert f2 in files
        assert f3 in files


@pytest.mark.asyncio
async def test_iter_indexable_files_fallback(indexing_service, tmp_path):
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    (repo_root / "test.py").write_text("1")
    (repo_root / "ignored.py").write_text("1")
    (repo_root / ".git").mkdir()
    (repo_root / ".git" / "config").write_text("1")
    
    with patch.object(indexing_service, "_run_git", new_callable=AsyncMock) as mock_git:
        mock_git.side_effect = RuntimeError("git error")
        
        spec = PathSpec.from_lines(GitWildMatchPattern, [".git/", "ignored.py"])
        
        files = [f async for f in indexing_service._iter_indexable_files(repo_root, spec)]
        assert len(files) == 1
        assert files[0].name == "test.py"





def test_on_rm_error(indexing_service, tmp_path):
    f = tmp_path / "readonly.txt"
    f.write_text("test")
    os.chmod(f, stat.S_IREAD)
    
    def fail_remove(p):
        if not os.access(p, os.W_OK):
            raise PermissionError("Access denied")
        os.remove(p)
        
    indexing_service._on_rm_error(fail_remove, str(f), None)
    assert not f.exists()
