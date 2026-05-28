from __future__ import annotations

# ruff: noqa: E402

import logging
import sys
from pathlib import Path

import httpx
from sqlalchemy import text

from app.core.config import settings

# Ensure backend package imports resolve when script is run directly.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db.database import engine
from app.db.schema import reset_app_schema


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


INDEX_ONLY_TABLES = ["code_chunks", "indexing_jobs"]


def clear_index_only_data() -> None:
    logger.warning("db_clear - index-only reset start")
    with engine.begin() as connection:
        for table in INDEX_ONLY_TABLES:
            connection.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
            logger.info("db_clear - truncated table=%s", table)
    logger.warning("db_clear - index-only reset completed")

def clear_vdb() -> None:
    logger.warning("db_clear - vector store reset start")
    qdrant_url = f"{settings.qdrant_url.rstrip('/')}/collections/{settings.qdrant_collection}"
    try:
        response = httpx.delete(qdrant_url)
        logger.info("db_clear - qdrant collection deleted status=%s", response.status_code)
    except Exception as e:
        logger.error("db_clear - qdrant delete failed error=%s", e)

def main() -> None:
    full_reset = "--full" in sys.argv
    if full_reset:
        logger.warning("db_clear - full reset requested")
        clear_vdb()
        reset_app_schema()
        return

    clear_vdb()
    clear_index_only_data()


if __name__ == "__main__":
    main()
