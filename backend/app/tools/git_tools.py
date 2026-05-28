import logging
import subprocess


logger = logging.getLogger(__name__)


def git_status(repo_path: str) -> str:
    logger.info("tool_git_status - request repo_path=%s", repo_path)
    result = subprocess.run(
        ["git", "-C", repo_path, "status", "--short"],
        capture_output=True,
        text=True,
        check=False,
    )
    status = result.stdout.strip() or "clean"
    return_code = getattr(result, "returncode", "unknown")
    logger.info("tool_git_status - completed repo_path=%s returncode=%s", repo_path, return_code)
    return status
