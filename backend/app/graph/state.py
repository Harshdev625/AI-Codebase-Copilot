from typing import Any, Literal, TypedDict


class CopilotState(TypedDict, total=False):
    repo_id: str
    query: str
    intent: Literal["search", "debug", "refactor", "docs", "tool"]
    retrieved_context: list[dict[str, Any]]
    retrieval_strategy: str
    plan: str
    analysis: str
    refactor_plan: str
    documentation: str
    verification: dict[str, Any]
    confidence: float
    run_trace: list[dict[str, Any]]
    tool_results: list[dict[str, Any]]
    patch: str
    answer: str
    session: Any
