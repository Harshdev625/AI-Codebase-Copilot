"""Reset application data stores.

Modes:
  (default)     Clear vector index + indexing tables only (keeps users/repos/sessions).
  --full        Drop and recreate the entire database schema + Qdrant (+ Redis cache).
  --yes         Skip interactive confirmation (required for --full in non-TTY runs).

Examples:
  python scripts/clear_db.py                  # index-only reset
  python scripts/clear_db.py --full --yes     # delete ALL data
"""

from __future__ import annotations

# ruff: noqa: E402

import argparse
import logging
import sys
from pathlib import Path

# Ensure backend package imports resolve when script is run directly.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import httpx
from sqlalchemy import text

from app.core.config import settings
from app.db.database import engine
from app.db.schema import reset_app_schema

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Tables cleared in index-only mode (search/index artifacts; app data retained).
INDEX_ONLY_TABLES = [
    "patch_chunks",
    "code_chunks",
    "snapshot_files",
    "repository_files",
    "indexing_jobs",
]


def _truncate_table(connection, table: str) -> None:
    dialect = connection.dialect.name
    if dialect == "postgresql":
        connection.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE'))
    elif dialect == "sqlite":
        connection.execute(text("PRAGMA foreign_keys = OFF"))
        connection.execute(text(f'DELETE FROM "{table}"'))
        connection.execute(text("PRAGMA foreign_keys = ON"))
    else:
        connection.execute(text(f'DELETE FROM "{table}"'))
    logger.info("db_clear - cleared table=%s dialect=%s", table, dialect)


def clear_index_only_data() -> None:
    logger.warning("db_clear - index-only reset start")
    with engine.begin() as connection:
        if connection.dialect.name == "sqlite":
            connection.execute(text("PRAGMA foreign_keys = OFF"))
        for table in INDEX_ONLY_TABLES:
            _truncate_table(connection, table)
        if connection.dialect.name == "sqlite":
            connection.execute(text("PRAGMA foreign_keys = ON"))
    logger.warning("db_clear - index-only reset completed")


def clear_vdb() -> None:
    logger.warning("db_clear - vector store reset start")
    qdrant_url = f"{settings.qdrant_url.rstrip('/')}/collections/{settings.qdrant_collection}"
    try:
        response = httpx.delete(qdrant_url, timeout=30.0)
        if response.status_code in (200, 202, 404):
            logger.info(
                "db_clear - qdrant collection delete status=%s (404 = already absent)",
                response.status_code,
            )
        else:
            logger.error(
                "db_clear - qdrant delete unexpected status=%s body=%s",
                response.status_code,
                response.text[:300],
            )
    except Exception as exc:
        logger.error("db_clear - qdrant delete failed error=%s", exc)


def clear_redis_cache() -> None:
    try:
        import redis

        client = redis.Redis.from_url(settings.redis_dsn)
        client.flushdb()
        logger.info("db_clear - redis cache flushed db=%s", settings.redis_db)
    except Exception as exc:
        logger.warning("db_clear - redis flush skipped error=%s", exc)


def clear_all_data() -> None:
    logger.warning("db_clear - FULL reset start (all users, repos, sessions, messages)")
    clear_vdb()
    clear_redis_cache()
    reset_app_schema()
    logger.warning("db_clear - FULL reset completed")


def _confirm_full_reset() -> bool:
    if not sys.stdin.isatty():
        logger.error(
            "db_clear - refusing --full without --yes in non-interactive mode"
        )
        return False
    print(
        "\n*** WARNING: --full will DELETE ALL database data "
        "(users, repositories, chat sessions, messages) and reset Qdrant/Redis. ***\n"
    )
    answer = input("Type 'yes' to continue: ").strip().lower()
    return answer == "yes"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reset AI Codebase Copilot data stores")
    parser.add_argument(
        "--full",
        action="store_true",
        help="Delete ALL data: drop/recreate DB schema, Qdrant collection, Redis cache",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompt for --full",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.full:
        if not args.yes and not _confirm_full_reset():
            logger.error("db_clear - aborted")
            sys.exit(1)
        clear_all_data()
        return

    clear_vdb()
    clear_index_only_data()


if __name__ == "__main__":
    main()
