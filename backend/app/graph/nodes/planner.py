import logging

from app.graph.state import CopilotState


logger = logging.getLogger(__name__)


def planner_node(state: CopilotState) -> CopilotState:
    query = state["query"].lower()
    logger.debug("graph_planner - request query=%s", query[:200])
    if "refactor" in query:
        intent = "refactor"
    elif any(token in query for token in ["error", "exception", "traceback", "debug"]):
        intent = "debug"
    elif any(token in query for token in ["run ", "terminal", "git "]):
        intent = "tool"
    elif any(token in query for token in ["document", "docs", "readme", "architecture", "design", "structure", "overview"]):
        intent = "docs"
    else:
        intent = "search"
    logger.debug("graph_planner - response intent=%s", intent)
    return {"intent": intent}
