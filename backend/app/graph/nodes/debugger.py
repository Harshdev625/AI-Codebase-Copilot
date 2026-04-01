from app.graph.state import CopilotState
from app.graph.nodes.common import build_context, llm_try


def debugger_node(state: CopilotState) -> CopilotState:
    snippets = state.get("retrieved_context", [])
    if not snippets:
        return {
            "analysis": "No relevant code snippets were retrieved for debugging.",
            "confidence": 0.25,
        }

    top = snippets[0]
    path = top.get("path", "unknown")
    symbol = top.get("symbol") or "unknown"
    summary = ""
    query = str(state.get("query", "")).strip()
    if query:
        context = build_context(snippets)
        prompt = (
            "You are debugging code. Analyze likely failure points, required checks, and concrete fixes "
            "for the user's error report using only the provided code context. "
            f"User report: {query}"
        )
        summary = llm_try(prompt=prompt, context=context)
    if not summary:
        summary = (
            f"Primary debugging candidate: {path} (symbol: {symbol}). "
            "Inspect recent changes and verify assumptions around inputs, null handling, and edge-case control flow."
        )
        confidence = 0.62
    else:
        confidence = 0.78

    return {"analysis": summary, "confidence": confidence}