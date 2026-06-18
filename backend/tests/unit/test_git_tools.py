"""Unit tests for git tool helpers."""

from unittest.mock import MagicMock, patch

from app.tools.git_tools import git_status


def test_git_status_returns_stdout(tmp_path):
    with patch("app.tools.git_tools.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout=" M file.py\n", returncode=0)
        assert git_status(str(tmp_path)) == "M file.py"
        mock_run.assert_called_once_with(
            ["git", "-C", str(tmp_path), "status", "--short"],
            capture_output=True,
            text=True,
            check=False,
        )


def test_git_status_clean_when_empty(tmp_path):
    with patch("app.tools.git_tools.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="  \n", returncode=0)
        assert git_status(str(tmp_path)) == "clean"
