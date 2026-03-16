from app.graph.state import CopilotState


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
    summary = (
        f"Primary debugging candidate: {path} (symbol: {symbol}). "
        "Inspect recent changes and verify assumptions around inputs, null handling, and edge-case control flow."
    )
    return {"analysis": summary, "confidence": 0.62}