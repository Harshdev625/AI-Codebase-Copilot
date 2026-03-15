from typing import Any, Literal, TypedDict


class CopilotState(TypedDict, total=False):
    repo_id: str
    query: str
    intent: Literal["search", "debug", "refactor", "docs", "tool"]
    retrieved_context: list[dict[str, Any]]
    analysis: str
    tool_results: list[dict[str, Any]]
    patch: str
    answer: str
    session: Any
