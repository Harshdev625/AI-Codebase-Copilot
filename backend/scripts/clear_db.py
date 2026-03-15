"""
Drop all project tables from the database.
Uses psycopg v3 (already a project dependency).

Usage:
    python backend/scripts/clear_db.py

Environment variables (with defaults from config):
    POSTGRES_DB       aicc
    POSTGRES_USER     postgres
    POSTGRES_PASSWORD mypassword
    POSTGRES_HOST     localhost
    POSTGRES_PORT     5432
"""
import os

import psycopg

DB_NAME = os.getenv("POSTGRES_DB", "aicc")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "mypassword")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")

TABLES = ["code_chunks"]


def drop_tables() -> None:
    conninfo = (
        f"dbname={DB_NAME} user={DB_USER} password={DB_PASSWORD} "
        f"host={DB_HOST} port={DB_PORT}"
    )
    try:
        with psycopg.connect(conninfo, autocommit=True) as conn:
            with conn.cursor() as cur:
                for table in TABLES:
                    cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
                    print(f"Dropped table: {table}")
        print("Database cleanup complete.")
    except psycopg.OperationalError as exc:
        print(f"Could not connect to database: {exc}")
        print(f"  host={DB_HOST}  port={DB_PORT}  db={DB_NAME}  user={DB_USER}")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    drop_tables()
