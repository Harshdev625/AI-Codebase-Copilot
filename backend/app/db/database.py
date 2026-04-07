import logging

from sqlalchemy import create_engine
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


logger = logging.getLogger(__name__)

engine = create_engine(
    settings.postgres_dsn,
    future=True,
    pool_pre_ping=True,
    pool_size=settings.postgres_pool_size,
    max_overflow=settings.postgres_max_overflow,
    pool_timeout=settings.postgres_pool_timeout_seconds,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@event.listens_for(engine, "before_cursor_execute")
def _before_cursor_execute(_conn, _cursor, statement, parameters, _context, _executemany):
    logger.debug(
        "db_query - execute statement=%s parameters=%s",
        " ".join(str(statement).split())[:300],
        str(parameters)[:300],
    )


@event.listens_for(engine, "handle_error")
def _handle_db_error(exception_context):
    logger.exception("db_query - error original=%s", exception_context.original_exception)


def get_db_session():
    session = SessionLocal()
    try:
        logger.debug("db_session - opened")
        yield session
    except Exception:
        logger.exception("db_session - failure; rolling back")
        session.rollback()
        raise
    finally:
        session.close()
        logger.debug("db_session - closed")
