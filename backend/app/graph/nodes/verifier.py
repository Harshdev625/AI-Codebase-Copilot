from app.graph.state import CopilotState


def verifier_node(state: CopilotState) -> CopilotState:
    retrieved = state.get("retrieved_context", [])
    confidence = float(state.get("confidence", 0.4))
    if retrieved:
        confidence = min(0.95, confidence + 0.2)
    else:
        confidence = max(0.1, confidence - 0.2)

    verification = {
        "retrieved_count": len(retrieved),
        "has_analysis": bool(state.get("analysis") or state.get("refactor_plan") or state.get("documentation")),
        "confidence": round(confidence, 2),
    }
    return {"verification": verification, "confidence": confidence}