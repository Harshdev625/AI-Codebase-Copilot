from app.graph.state import CopilotState


def answer_node(state: CopilotState) -> CopilotState:
    analysis = state.get("analysis", "")
    refactor_plan = state.get("refactor_plan", "")
    documentation = state.get("documentation", "")
    verification = state.get("verification", {})
    tools = state.get("tool_results", [])
    patch = state.get("patch", "")

    parts = [analysis] if analysis else []
    if refactor_plan:
        parts.append(refactor_plan)
    if documentation:
        parts.append(documentation)
    if tools:
        parts.append("Tool results: " + " | ".join([t.get("output", "") for t in tools]))
    if patch:
        parts.append("Patch suggestion:\n" + patch)
    if verification:
        parts.append(
            "Verification: "
            + f"confidence={verification.get('confidence')} "
            + f"retrieved_count={verification.get('retrieved_count')}"
        )

    return {"answer": "\n\n".join(parts) if parts else "No answer generated."}
