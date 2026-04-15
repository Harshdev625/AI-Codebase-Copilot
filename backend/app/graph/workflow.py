import logging

from langgraph.graph import END, StateGraph

from app.graph.nodes.answer import answer_node
from app.graph.nodes.code_understanding import code_understanding_node
from app.graph.nodes.debugger import debugger_node
from app.graph.nodes.documentation import documentation_node
from app.graph.nodes.patch_generation import patch_generation_node
from app.graph.nodes.planner import planner_node
from app.graph.nodes.refactor_advisor import refactor_advisor_node
from app.graph.nodes.retrieval import retrieval_node
from app.graph.nodes.tool_execution import tool_execution_node
from app.graph.nodes.verifier import verifier_node
from app.graph.state import CopilotState


logger = logging.getLogger(__name__)


def route_after_retrieval(state: CopilotState) -> str:
    intent = state.get("intent")
    retrieved = state.get("retrieved_context", [])
    confidence = float(state.get("confidence", 0.4))
    logger.debug("graph_route_after_retrieval - intent=%s retrieved=%s confidence=%s", intent, len(retrieved), confidence)

    if not retrieved:
        if intent == "debug":
            return "debugger"
        if intent == "refactor":
            return "refactor_advisor"
        if intent == "docs":
            return "documentation"
        return "code_understanding"

    if confidence < 0.3 and intent in {"patch_generation", "refactor"}:
        return "code_understanding"

    if intent == "patch_generation":
        return "patch_generation"
    if intent == "debug":
        return "debugger"
    if intent == "refactor":
        return "refactor_advisor"
    if intent == "docs":
        return "documentation"
    return "code_understanding"


def route_after_analysis(state: CopilotState) -> str:
    intent = state.get("intent")
    query = str(state.get("query", "")).lower()
    if intent == "tool" or query.startswith("run ") or "git status" in query:
        return "tool_execution"
    return "verifier"


def build_graph():
    logger.info("graph_build - compiling workflow")
    graph = StateGraph(CopilotState)
    graph.add_node("planner", planner_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("code_understanding", code_understanding_node)
    graph.add_node("debugger", debugger_node)
    graph.add_node("refactor_advisor", refactor_advisor_node)
    graph.add_node("documentation", documentation_node)
    graph.add_node("tool_execution", tool_execution_node)
    graph.add_node("patch_generation", patch_generation_node)
    graph.add_node("verifier", verifier_node)
    graph.add_node("answer", answer_node)

    graph.set_entry_point("planner")
    # Project.md source-of-truth flow: planner -> retrieval -> reasoning -> tool_execution -> response.
    graph.add_edge("planner", "retrieval")

    graph.add_conditional_edges(
        "retrieval",
        route_after_retrieval,
        {
            "patch_generation": "patch_generation",
            "debugger": "debugger",
            "refactor_advisor": "refactor_advisor",
            "documentation": "documentation",
            "code_understanding": "code_understanding",
        },
    )

    graph.add_conditional_edges(
        "code_understanding",
        route_after_analysis,
        {
            "tool_execution": "tool_execution",
            "verifier": "verifier",
        },
    )
    graph.add_conditional_edges(
        "debugger",
        route_after_analysis,
        {
            "tool_execution": "tool_execution",
            "verifier": "verifier",
        },
    )
    graph.add_conditional_edges(
        "documentation",
        route_after_analysis,
        {
            "tool_execution": "tool_execution",
            "verifier": "verifier",
        },
    )
    graph.add_edge("refactor_advisor", "patch_generation")
    graph.add_edge("patch_generation", "verifier")
    graph.add_edge("tool_execution", "verifier")
    graph.add_edge("verifier", "answer")
    graph.add_edge("answer", END)
    compiled = graph.compile()
    logger.info("graph_build - compiled workflow")
    return compiled


compiled_graph = build_graph()
