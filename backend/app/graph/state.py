from typing import Any, Literal, TypedDict


class CopilotState(TypedDict, total=False):
    repo_id: str
    repository_id: str
    project_id: str
    query: str
    intent: Literal["search", "debug", "refactor", "docs", "tool", "patch_generation"]
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
    patch_proposal: dict[str, Any]
    answer: str
    session: Any
