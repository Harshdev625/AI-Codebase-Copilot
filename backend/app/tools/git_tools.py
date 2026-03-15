import subprocess


def git_status(repo_path: str) -> str:
    result = subprocess.run(
        ["git", "-C", repo_path, "status", "--short"],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip() or "clean"
