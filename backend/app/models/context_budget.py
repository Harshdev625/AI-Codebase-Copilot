from pydantic import BaseModel

class ContextBudgetRequest(BaseModel):
    scope_paths: list[str] = []
    attached_files: list[str] = []
    session_id: str | None = None
