import logging

from app.graph.state import CopilotState
from app.graph.nodes.common import build_context, llm_try


logger = logging.getLogger(__name__)


def code_understanding_node(state: CopilotState) -> CopilotState:
    logger.debug("graph_code_understanding - request")
    snippets = state.get("retrieved_context", [])
    if not snippets:
        return {"analysis": "No relevant code context was retrieved."}

    top = snippets[0]
    path = top.get("path", "unknown")
    symbol = top.get("symbol") or "unknown"
    analysis = ""
    query = str(state.get("query", "")).strip()
    if query:
        context = build_context(snippets)
        prompt = (
            "Analyze the retrieved repository context and explain implementation details, "
            "data flow, and key dependencies that answer the user query. "
            f"User query: {query}"
        )
        analysis = llm_try(prompt=prompt, context=context)
    if not analysis:
        analysis = (
            f"Most relevant implementation appears in {path} (symbol: {symbol}). "
            "Use this as the starting point for explanation/debugging."
        )
    logger.debug("graph_code_understanding - response analysis_chars=%s", len(analysis))
    return {"analysis": analysis}
