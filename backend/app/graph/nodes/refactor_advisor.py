from app.graph.state import CopilotState
from app.graph.nodes.common import build_context, llm_try


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
    plan = ""
    query = str(state.get("query", "")).strip()
    if query:
        context = build_context(snippets)
        prompt = (
            "Create a focused refactor plan with ordered steps, separation-of-concerns improvements, "
            "and testing impact. Keep it specific to the provided code and user request. "
            f"User request: {query}"
        )
        plan = llm_try(prompt=prompt, context=context)
    if not plan:
        plan = (
            f"Refactor target: {path} ({symbol}). "
            "Plan: extract side-effect-heavy blocks into pure functions, add explicit types/interfaces, "
            "and separate orchestration from domain logic to improve testability."
        )
        confidence = 0.58
    else:
        confidence = 0.74

    return {"refactor_plan": plan, "confidence": confidence}