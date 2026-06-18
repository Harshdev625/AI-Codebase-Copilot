"""Unit tests for terminal tool helpers."""

from unittest.mock import MagicMock, patch

from app.tools.terminal_tools import run_command


def test_run_command_returns_stdout():
    with patch("app.tools.terminal_tools.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="hello\n", stderr="", returncode=0)
        assert run_command("echo hello") == "hello"
        mock_run.assert_called_once()
        assert mock_run.call_args[0][0] == ["echo", "hello"]


def test_run_command_merges_stderr():
    with patch("app.tools.terminal_tools.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="out", stderr="err", returncode=1)
        assert run_command("cmd") == "out\nerr"


def test_run_command_with_cwd():
    with patch("app.tools.terminal_tools.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="", returncode=0)
        run_command("ls", cwd="/tmp")
        assert mock_run.call_args.kwargs["cwd"] == "/tmp"
