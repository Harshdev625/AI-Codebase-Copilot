from app.graph.state import CopilotState


def refactor_advisor_node(state: CopilotState) -> CopilotState:
    snippets = state.get("retrieved_context", [])
    if not snippets:
        return {
            "refactor_plan": "No code context found. Re-run retrieval with a narrower query.",
            "confidence": 0.2,
        }

    top = snippets[0]
    path = top.get("path", "unknown")
    symbol = top.get("symbol") or "module"
    plan = (
        f"Refactor target: {path} ({symbol}). "
        "Plan: extract side-effect-heavy blocks into pure functions, add explicit types/interfaces, "
        "and separate orchestration from domain logic to improve testability."
    )
    return {"refactor_plan": plan, "confidence": 0.58}