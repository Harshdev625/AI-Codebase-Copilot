import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
from app.services.validation_engine import ValidationEngine
from app.services.validation_providers import (
    PythonValidationProvider,
    TypeScriptValidationProvider
)

@pytest.fixture
def validation_engine():
    return ValidationEngine()

def test_provider_dispatch(validation_engine):
    py_provider = validation_engine.get_provider("src/main.py")
    ts_provider = validation_engine.get_provider("src/index.ts")
    js_provider = validation_engine.get_provider("src/app.js")
    unknown_provider = validation_engine.get_provider("src/data.txt")
    
    assert isinstance(py_provider, PythonValidationProvider)
    assert isinstance(ts_provider, TypeScriptValidationProvider)
    assert isinstance(js_provider, TypeScriptValidationProvider)
    assert unknown_provider is None

def test_python_ast_validation(tmp_path):
    provider = PythonValidationProvider()
    
    # Valid Python
    valid_file = tmp_path / "valid.py"
    valid_file.write_text("def hello():\n    print('world')\n")
    success, msg = provider.validate_ast(tmp_path, valid_file)
    assert success is True
    
    # Invalid Python
    invalid_file = tmp_path / "invalid.py"
    invalid_file.write_text("def hello(\n")
    success, msg = provider.validate_ast(tmp_path, invalid_file)
    assert success is False
    assert "SyntaxError" in msg

def test_python_lint_and_format(tmp_path):
    provider = PythonValidationProvider()
    file_path = tmp_path / "foo.py"
    file_path.write_text("x = 1\n")
    
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="OK", stderr="")
        success, msg = provider.run_lint(tmp_path, file_path)
        assert success is True
        
        args = mock_run.call_args[0][0]
        assert "ruff" in args
        assert "check" in args

def test_validation_engine_runs_stages(validation_engine, tmp_path):
    # Mock providers
    mock_provider = MagicMock()
    mock_provider.validate_ast.return_value = (True, "AST OK")
    mock_provider.run_format_check.return_value = (True, "Format OK")
    mock_provider.run_lint.return_value = (True, "Lint OK")
    mock_provider.run_type_check.return_value = (True, "Type OK")
    mock_provider.run_tests.return_value = (True, "Tests OK")
    
    # Ensure file exists in sandbox path
    (tmp_path / "main.py").write_text("# dummy python file")
    
    with patch.object(validation_engine, "get_provider", return_value=mock_provider):
        success, logs = validation_engine.validate_patch(
            sandbox_path=tmp_path,
            patch_id="patch-123",
            modified_files=["main.py"]
        )
        
        assert success is True
        assert "AST OK" in logs
        assert "Tests OK" in logs

def test_validation_engine_fails_on_stage(validation_engine, tmp_path):
    mock_provider = MagicMock()
    mock_provider.validate_ast.return_value = (True, "AST OK")
    mock_provider.run_format_check.return_value = (False, "Formatter failed")
    
    # Ensure file exists in sandbox path
    (tmp_path / "main.py").write_text("# dummy python file")
    
    with patch.object(validation_engine, "get_provider", return_value=mock_provider):
        success, logs = validation_engine.validate_patch(
            sandbox_path=tmp_path,
            patch_id="patch-123",
            modified_files=["main.py"]
        )
        
        assert success is False
        assert "Formatter failed" in logs
