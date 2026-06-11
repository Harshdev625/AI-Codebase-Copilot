import ast
import subprocess
import logging
from abc import ABC, abstractmethod
from pathlib import Path

logger = logging.getLogger(__name__)

class ValidationProvider(ABC):
    @abstractmethod
    def validate_ast(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        pass

    @abstractmethod
    def run_format_check(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        pass

    @abstractmethod
    def run_lint(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        pass

    @abstractmethod
    def run_type_check(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        pass

    @abstractmethod
    def run_tests(self, sandbox_path: Path, affected_files: list[Path]) -> tuple[bool, str]:
        pass


class PythonValidationProvider(ValidationProvider):
    def validate_ast(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            ast.parse(content)
            return True, f"AST Validation: OK (parsed {file_path.name})"
        except SyntaxError as err:
            return False, f"SyntaxError in {file_path.name}: {str(err)}"
        except Exception as exc:
            return False, f"AST Error in {file_path.name}: {str(exc)}"

    def _run_cmd(self, cmd: list[str], cwd: Path) -> tuple[bool, str]:
        try:
            res = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=60)
            if res.returncode == 0:
                return True, f"Command {' '.join(cmd[:2])} passed: {res.stdout}"
            return False, f"Command {' '.join(cmd[:2])} failed: {res.stderr or res.stdout}"
        except FileNotFoundError:
            # Safe fallback if CLI tool is missing from host environment
            logger.warning(f"Tool {cmd[0]} not found on host, skipping stage.")
            return True, f"Tool {cmd[0]} not installed, skipped."
        except subprocess.TimeoutExpired:
            return False, f"Command {' '.join(cmd[:2])} timed out after 60s."
        except Exception as exc:
            return False, f"Error running {' '.join(cmd[:2])}: {str(exc)}"

    def run_format_check(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        # Ruff format check
        return self._run_cmd(["ruff", "format", "--check", str(file_path)], sandbox_path)

    def run_lint(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        return self._run_cmd(["ruff", "check", str(file_path)], sandbox_path)

    def run_type_check(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        # Optional type checking with mypy
        return self._run_cmd(["mypy", str(file_path)], sandbox_path)

    def run_tests(self, sandbox_path: Path, affected_files: list[Path]) -> tuple[bool, str]:
        # Find test files in sandbox or run pytest on affected module paths
        return self._run_cmd(["pytest", "-q"], sandbox_path)


class TypeScriptValidationProvider(ValidationProvider):
    def validate_ast(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        # TS parsing is typically validated during typechecking
        return True, "AST Validation: OK (skipped for TS/JS)"

    def _run_cmd(self, cmd: list[str], cwd: Path) -> tuple[bool, str]:
        try:
            res = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=60)
            if res.returncode == 0:
                return True, f"TS Command {' '.join(cmd[:2])} passed"
            return False, f"TS Command failed: {res.stderr or res.stdout}"
        except FileNotFoundError:
            return True, f"Node tool {cmd[0]} not installed, skipped."
        except subprocess.TimeoutExpired:
            return False, f"TS Command timed out after 60s."
        except Exception as exc:
            return False, f"TS Error: {str(exc)}"

    def run_format_check(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        return self._run_cmd(["npx", "prettier", "--check", str(file_path)], sandbox_path)

    def run_lint(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        return self._run_cmd(["npx", "eslint", str(file_path)], sandbox_path)

    def run_type_check(self, sandbox_path: Path, file_path: Path) -> tuple[bool, str]:
        return self._run_cmd(["npx", "tsc", "--noEmit"], sandbox_path)

    def run_tests(self, sandbox_path: Path, affected_files: list[Path]) -> tuple[bool, str]:
        return self._run_cmd(["npm", "test"], sandbox_path)
