import logging
import re

from app.graph.state import CopilotState


logger = logging.getLogger(__name__)


def planner_node(state: CopilotState) -> CopilotState:
    query = state["query"].lower()
    logger.debug("graph_planner - request query=%s", query[:200])
    retrieval_count = len(state.get("retrieved_context") or [])
    confidence = float(state.get("confidence", 0.4))

    if retrieval_count == 0 and any(token in query for token in ["where", "file", "path", "line", "symbol"]):
        intent = "search"
    elif "refactor" in query:
        intent = "refactor"
    elif any(token in query for token in ["test", "unit test", "integration test", "coverage", "assert"]):
        intent = "tool"
    elif any(token in query for token in ["fix", "rewrite", "improve", "optimize", "patch"]):
        intent = "patch_generation"
    elif any(token in query for token in ["error", "exception", "traceback", "debug"]):
        intent = "debug"
    elif any(token in query for token in ["run ", "terminal", "git "]):
        intent = "tool"
    elif re.search(r"\b(architecture|flow|design|overview|readme|documentation)\b", query):
        intent = "docs"
    elif any(token in query for token in ["document", "docs", "readme", "architecture", "design", "structure", "overview"]):
        intent = "docs"
    else:
        intent = "search"
    if confidence < 0.25 and intent in {"docs", "refactor", "patch_generation"}:
        intent = "search"
    logger.debug("graph_planner - response intent=%s retrieval_count=%s confidence=%s", intent, retrieval_count, confidence)
    return {"intent": intent}
