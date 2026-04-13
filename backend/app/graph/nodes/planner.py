from app.graph.state import CopilotState


def planner_node(state: CopilotState) -> CopilotState:
    query = state["query"].lower()
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
    return {"intent": intent}
