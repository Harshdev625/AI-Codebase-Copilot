from __future__ import annotations

import logging
import sys
from pathlib import Path

from sqlalchemy import text

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


INDEX_ONLY_TABLES = [
    "embedding_references",
    "code_graph_edges",
    "code_chunks",
    "indexing_status",
    "indexing_jobs",
    "repository_snapshots",
]


def clear_index_only_data() -> None:
    logger.warning("db_clear - index-only reset start")
    with engine.begin() as connection:
        for table in INDEX_ONLY_TABLES:
            connection.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
            logger.info("db_clear - truncated table=%s", table)
    logger.warning("db_clear - index-only reset completed")


def main() -> None:
    full_reset = "--full" in sys.argv
    if full_reset:
        logger.warning("db_clear - full reset requested")
        reset_app_schema()
        return

    clear_index_only_data()


if __name__ == "__main__":
    main()
