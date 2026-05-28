import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def apply_diff_to_codebase(repo_path: Path, diff: str) -> None:
    """Applies a unified diff patch to the given codebase using git apply."""
    try:
        process = subprocess.run(
            ["git", "apply", "--ignore-space-change", "--ignore-whitespace"],
            input=diff.encode("utf-8"),
            cwd=str(repo_path),
            capture_output=True,
        )
        if process.returncode != 0:
            error_msg = process.stderr.decode("utf-8")
            logger.error(f"Failed to apply patch: {error_msg}")
            raise RuntimeError(f"Patch application failed: {error_msg}")
    except FileNotFoundError:
        raise RuntimeError("git is not installed or available in PATH")
    except Exception as exc:
        raise RuntimeError(f"Unexpected error applying patch: {str(exc)}") from exc
