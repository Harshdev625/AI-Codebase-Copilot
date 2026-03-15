import shlex
import subprocess


def run_command(command: str, cwd: str | None = None) -> str:
    cmd = shlex.split(command)
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)
    output = result.stdout.strip()
    if result.stderr.strip():
        output = f"{output}\n{result.stderr.strip()}".strip()
    return output
