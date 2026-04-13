"""
Drop project tables from the database.
Uses psycopg v3 (already a project dependency).

Usage:
    # Clear only indexed chunks (keeps users/projects/repos intact):
    python backend/scripts/clear_db.py

    # Full reset — drops ALL application tables:
    python backend/scripts/clear_db.py --full

Environment variables (with defaults from config):
    POSTGRES_DB       aicc
    POSTGRES_USER     postgres
    POSTGRES_PASSWORD mypassword
    POSTGRES_HOST     localhost
    POSTGRES_PORT     5432
"""
import os
import sys

import psycopg

DB_NAME = os.getenv("POSTGRES_DB", "aicc")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "mypassword")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")

# Only index data — safe to clear and re-index
INDEX_TABLES = ["code_chunks", "indexing_jobs", "repository_snapshots"]

# All application tables in FK-safe drop order (children before parents)
ALL_TABLES = [
    "code_chunks",
    "indexing_jobs",
    "repository_snapshots",
    "agent_runs",
    "messages",
    "conversations",
    "repositories",
    "project_memberships",
    "projects",
    "users",
]


def drop_tables(tables: list[str]) -> None:
    conninfo = (
        f"dbname={DB_NAME} user={DB_USER} password={DB_PASSWORD} "
        f"host={DB_HOST} port={DB_PORT}"
    )
    try:
        with psycopg.connect(conninfo, autocommit=True) as conn:
            with conn.cursor() as cur:
                for table in tables:
                    cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")  # noqa: S608
                    print(f"Dropped table: {table}")
        print("Database cleanup complete.")
    except psycopg.OperationalError as exc:
        print(f"Could not connect to database: {exc}")
        print(f"  host={DB_HOST}  port={DB_PORT}  db={DB_NAME}  user={DB_USER}")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    full_reset = "--full" in sys.argv
    tables = ALL_TABLES if full_reset else INDEX_TABLES
    mode = "FULL RESET" if full_reset else "index-only reset"
    print(f"Running {mode} — dropping: {', '.join(tables)}")
    drop_tables(tables)
