from app.graph.state import CopilotState


def documentation_node(state: CopilotState) -> CopilotState:
    snippets = state.get("retrieved_context", [])
    if not snippets:
        return {
            "documentation": "Documentation draft unavailable because no context was retrieved.",
            "confidence": 0.2,
        }

    lines = ["## Generated Documentation Draft", "", "### Relevant Files"]
    for item in snippets[:5]:
        path = item.get("path", "unknown")
        symbol = item.get("symbol") or "module"
        lines.append(f"- {path} ({symbol})")

    lines.extend(
        [
            "",
            "### Summary",
            "This area contains logic related to the requested topic. Consider adding purpose, inputs/outputs, and failure modes.",
        ]
    )
    return {"documentation": "\n".join(lines), "confidence": 0.55}