from app.graph.state import CopilotState
from app.graph.nodes.common import build_context, llm_try


def documentation_node(state: CopilotState) -> CopilotState:
    snippets = state.get("retrieved_context", [])
    if not snippets:
        return {
            "documentation": "Documentation draft unavailable because no context was retrieved.",
            "confidence": 0.2,
        }

    generated = ""
    query = str(state.get("query", "")).strip()
    if query:
        context = build_context(snippets)
        prompt = (
            "Generate concise technical documentation for this code area: purpose, key modules, "
            "inputs/outputs, failure modes, and maintenance notes. "
            f"User request: {query}"
        )
        generated = llm_try(prompt=prompt, context=context)
    if generated:
        return {"documentation": generated, "confidence": 0.76}

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