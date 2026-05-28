import logging
import shlex
import subprocess


logger = logging.getLogger(__name__)


def run_command(command: str, cwd: str | None = None) -> str:
    logger.info("tool_run_command - request command=%s cwd=%s", command, cwd)
    cmd = shlex.split(command)
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)
    output = result.stdout.strip()
    if result.stderr.strip():
        output = f"{output}\n{result.stderr.strip()}".strip()
    return_code = getattr(result, "returncode", "unknown")
    logger.info("tool_run_command - completed command=%s returncode=%s", command, return_code)
    return output
