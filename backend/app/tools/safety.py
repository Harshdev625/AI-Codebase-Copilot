import logging


ALLOWED_COMMAND_PREFIXES = {
    "python",
    "pytest",
    "ruff",
    "mypy",
    "git",
}


logger = logging.getLogger(__name__)


def is_command_allowed(command: str) -> bool:
    first = command.strip().split(" ")[0]
    allowed = first in ALLOWED_COMMAND_PREFIXES
    logger.debug("tool_safety - command=%s allowed=%s", first, allowed)
    return allowed
