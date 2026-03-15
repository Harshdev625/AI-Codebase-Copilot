from app.graph.state import CopilotState


def code_understanding_node(state: CopilotState) -> CopilotState:
    snippets = state.get("retrieved_context", [])
    if not snippets:
        return {"analysis": "No relevant code context was retrieved."}

    top = snippets[0]
    path = top.get("path", "unknown")
    symbol = top.get("symbol", "unknown")
    analysis = (
        f"Most relevant implementation appears in {path} (symbol: {symbol}). "
        "Use this as the starting point for explanation/debugging."
    )
    return {"analysis": analysis}
