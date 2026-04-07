import logging
from pathlib import Path


logger = logging.getLogger(__name__)


def read_file(path: str, max_chars: int = 10_000) -> str:
    logger.info("tool_read_file - request path=%s max_chars=%s", path, max_chars)
    content = Path(path).read_text(encoding="utf-8", errors="ignore")
    truncated = content[:max_chars]
    logger.info("tool_read_file - completed path=%s returned_chars=%s", path, len(truncated))
    return truncated
