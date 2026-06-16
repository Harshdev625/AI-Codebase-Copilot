"""Add soft-delete columns to chat_sessions (run once against PostgreSQL)."""

from sqlalchemy import create_engine, text

from app.core.config import settings


def migrate() -> None:
    engine = create_engine(settings.database_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE chat_sessions
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE chat_sessions
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
                """
            )
        )
    print("chat_sessions soft-delete columns ready.")


if __name__ == "__main__":
    migrate()
