from sqlalchemy.orm import Session

def is_sqlite_session(session: Session) -> bool:
    bind = getattr(session, "bind", None)
    dialect = getattr(getattr(bind, "dialect", None), "name", None)
    return bool(dialect and str(dialect).lower() == "sqlite")

def get_timestamp_sql(sqlite: bool) -> str:
    return "CURRENT_TIMESTAMP" if sqlite else "NOW()"

def get_jsonb_cast_sql(column_name: str, sqlite: bool) -> str:
    return f":{column_name}" if sqlite else f"CAST(:{column_name} AS jsonb)"
