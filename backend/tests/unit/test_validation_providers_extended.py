"""Extended unit tests for validation provider edge cases."""

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.services.validation_providers import PythonValidationProvider, TypeScriptValidationProvider


def test_python_validate_ast_read_error(tmp_path):
    provider = PythonValidationProvider()
    missing = tmp_path / "missing.py"
    success, msg = provider.validate_ast(tmp_path, missing)
    assert success is False
    assert "AST Error" in msg


def test_python_run_cmd_tool_not_found(tmp_path):
    provider = PythonValidationProvider()
    file_path = tmp_path / "foo.py"
    file_path.write_text("x = 1\n")
    with patch("subprocess.run", side_effect=FileNotFoundError("ruff")):
        success, msg = provider.run_lint(tmp_path, file_path)
    assert success is True
    assert "not installed" in msg


def test_python_run_cmd_timeout(tmp_path):
    provider = PythonValidationProvider()
    file_path = tmp_path / "foo.py"
    file_path.write_text("x = 1\n")
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="ruff", timeout=60)):
        success, msg = provider.run_format_check(tmp_path, file_path)
    assert success is False
    assert "timed out" in msg


def test_python_run_cmd_failure_output(tmp_path):
    provider = PythonValidationProvider()
    file_path = tmp_path / "foo.py"
    file_path.write_text("x = 1\n")
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="lint error")
        success, msg = provider.run_type_check(tmp_path, file_path)
    assert success is False
    assert "failed" in msg


def test_python_run_tests_invokes_pytest(tmp_path):
    provider = PythonValidationProvider()
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="1 passed", stderr="")
        success, msg = provider.run_tests(tmp_path, [])
    assert success is True
    assert mock_run.call_args[0][0][0] == "pytest"


def test_typescript_validate_ast_skipped(tmp_path):
    provider = TypeScriptValidationProvider()
    file_path = tmp_path / "index.ts"
    file_path.write_text("export const x = 1;\n")
    success, msg = provider.validate_ast(tmp_path, file_path)
    assert success is True
    assert "skipped" in msg.lower()


def test_typescript_run_cmd_tool_not_found(tmp_path):
    provider = TypeScriptValidationProvider()
    file_path = tmp_path / "index.ts"
    file_path.write_text("export const x = 1;\n")
    with patch("subprocess.run", side_effect=FileNotFoundError("npx")):
        success, msg = provider.run_lint(tmp_path, file_path)
    assert success is True
    assert "not installed" in msg


def test_typescript_run_cmd_timeout(tmp_path):
    provider = TypeScriptValidationProvider()
    file_path = tmp_path / "index.ts"
    file_path.write_text("export const x = 1;\n")
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="eslint", timeout=60)):
        success, msg = provider.run_format_check(tmp_path, file_path)
    assert success is False
    assert "timed out" in msg


def test_typescript_run_tests_invokes_npm(tmp_path):
    provider = TypeScriptValidationProvider()
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        success, msg = provider.run_tests(tmp_path, [])
    assert success is True
    assert mock_run.call_args[0][0][0] == "npm"
