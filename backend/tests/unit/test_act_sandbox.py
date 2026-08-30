import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
from app.services.sandbox_manager import SandboxManager
from app.db.models import ActPatchFile

@pytest.fixture
def sandbox_manager():
    return SandboxManager()

def test_create_sandbox(sandbox_manager):
    with patch("subprocess.run") as mock_run, patch("pathlib.Path.mkdir") as mock_mkdir:
        mock_run.return_value = MagicMock(returncode=0)
        cache_path = Path("/mock/cache/repo")
        sandbox_path = Path("/mock/sandbox/patch-123")
        
        path = sandbox_manager.create_sandbox(
            patch_id="patch-123",
            repository_path=cache_path,
            commit_sha="commit-abc",
            sandbox_base_dir=Path("/mock/sandbox")
        )
        
        assert path == sandbox_path
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert "worktree" in args
        assert "add" in args
        assert "--detach" in args
        assert str(sandbox_path) in args
        assert "commit-abc" in args

def test_apply_patch_files(sandbox_manager):
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        sandbox_path = Path("/mock/sandbox/patch-123")
        
        patch_file = ActPatchFile(
            patch_id="patch-123",
            file_path="src/main.py",
            action="MODIFIED",
            file_diff="--- a/src/main.py\n+++ b/src/main.py\n"
        )
        
        sandbox_manager.apply_patch_files(sandbox_path, [patch_file])
        
        assert mock_run.call_count == 1
        call_args = mock_run.call_args[0][0]
        assert "apply" in call_args
        assert "--ignore-space-change" in call_args
        assert mock_run.call_args[1]["input"] == b"--- a/src/main.py\n+++ b/src/main.py\n"

def test_destroy_sandbox(sandbox_manager):
    with patch("subprocess.run") as mock_run:
        with patch("shutil.rmtree") as mock_rmtree:
            mock_run.return_value = MagicMock(returncode=0)
            cache_path = Path("/mock/cache/repo")
            sandbox_path = Path("/mock/sandbox/patch-123")
            
            with patch("pathlib.Path.exists", return_value=True):
                sandbox_manager.destroy_sandbox(
                    patch_id="patch-123",
                    repository_path=cache_path,
                    sandbox_base_dir=Path("/mock/sandbox")
                )
            
            mock_run.assert_called_once()
            args = mock_run.call_args[0][0]
            assert "worktree" in args
            assert "remove" in args
            assert "--force" in args
            assert str(sandbox_path) in args
            
            mock_rmtree.assert_called_once_with(sandbox_path, ignore_errors=True)
