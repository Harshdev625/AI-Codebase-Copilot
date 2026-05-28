import logging

from langgraph.graph import END, StateGraph

from app.graph.nodes.answer import answer_node
from app.graph.nodes.planner import planner_node
from app.graph.nodes.retrieval import retrieval_node
from app.graph.nodes.reasoning import reasoning_node
from app.graph.nodes.tool_execution import tool_execution_node
from app.graph.state import CopilotState


logger = logging.getLogger(__name__)


def route_after_reasoning(state: CopilotState) -> str:
    intent = str(state.get("intent") or "")
    query = str(state.get("query") or "").lower()
    if intent == "tool" or query.startswith("run ") or "git status" in query:
        return "tool_execution"
    return "answer"


def build_graph():
    logger.info("graph_build - compiling workflow")
    graph = StateGraph(CopilotState)
    graph.add_node("planner", planner_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("tool_execution", tool_execution_node)
    graph.add_node("answer", answer_node)
    graph.add_node("reasoning", reasoning_node)

    graph.set_entry_point("planner")
    # Project.md source-of-truth flow: planner -> retrieval -> reasoning -> tool_execution -> response.
    graph.add_edge("planner", "retrieval")
    graph.add_edge("retrieval", "reasoning")

    graph.add_conditional_edges(
        "reasoning",
        route_after_reasoning,
        {
            "tool_execution": "tool_execution",
            "answer": "answer",
        },
    )
    graph.add_edge("tool_execution", "answer")
    graph.add_edge("answer", END)
    compiled = graph.compile()
    logger.info("graph_build - compiled workflow")
    return compiled


compiled_graph = build_graph()
