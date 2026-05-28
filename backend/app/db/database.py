import logging

from sqlalchemy import create_engine
from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

from app.core.config import settings


logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


database_url = settings.database_url or settings.postgres_dsn
url = make_url(database_url)

engine_kwargs: dict[str, object] = {
    "future": True,
    "pool_pre_ping": True,
}
connect_args: dict[str, object] = {}

if url.drivername.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    engine_kwargs["connect_args"] = connect_args
    if url.database in (None, "", ":memory:"):
        engine_kwargs["poolclass"] = StaticPool
    else:
        engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs.update(
        {
            "pool_size": settings.postgres_pool_size,
            "max_overflow": settings.postgres_max_overflow,
            "pool_timeout": settings.postgres_pool_timeout_seconds,
        }
    )

engine = create_engine(database_url, **engine_kwargs)
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
