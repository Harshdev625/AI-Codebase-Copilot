ALLOWED_COMMAND_PREFIXES = {
    "python",
    "pytest",
    "ruff",
    "mypy",
    "git",
}


def is_command_allowed(command: str) -> bool:
    first = command.strip().split(" ")[0]
    return first in ALLOWED_COMMAND_PREFIXES
