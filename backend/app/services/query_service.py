from __future__ import annotations

from sqlalchemy.orm import Session

from app.graph.workflow import compiled_graph


class QueryService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def run(self, repo_id: str, query: str) -> dict:
        state = {
            "repo_id": repo_id,
            "query": query,
            "session": self.session,
        }
        return compiled_graph.invoke(state)
