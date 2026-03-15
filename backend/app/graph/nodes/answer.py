from app.graph.state import CopilotState


def answer_node(state: CopilotState) -> CopilotState:
    analysis = state.get("analysis", "")
    tools = state.get("tool_results", [])
    patch = state.get("patch", "")

    parts = [analysis] if analysis else []
    if tools:
        parts.append("Tool results: " + " | ".join([t.get("output", "") for t in tools]))
    if patch:
        parts.append("Patch suggestion:\n" + patch)

    return {"answer": "\n\n".join(parts) if parts else "No answer generated."}
