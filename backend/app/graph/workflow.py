from langgraph.graph import END, StateGraph

from app.graph.nodes.answer import answer_node
from app.graph.nodes.code_understanding import code_understanding_node
from app.graph.nodes.patch_generation import patch_generation_node
from app.graph.nodes.planner import planner_node
from app.graph.nodes.retrieval import retrieval_node
from app.graph.nodes.tool_execution import tool_execution_node
from app.graph.state import CopilotState


def route_after_plan(state: CopilotState) -> str:
    return "tool_execution" if state.get("intent") == "tool" else "retrieval"


def route_after_understanding(state: CopilotState) -> str:
    return "patch_generation" if state.get("intent") == "refactor" else "answer"


def build_graph():
    graph = StateGraph(CopilotState)
    graph.add_node("planner", planner_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("code_understanding", code_understanding_node)
    graph.add_node("tool_execution", tool_execution_node)
    graph.add_node("patch_generation", patch_generation_node)
    graph.add_node("answer", answer_node)

    graph.set_entry_point("planner")
    graph.add_conditional_edges(
        "planner",
        route_after_plan,
        {
            "retrieval": "retrieval",
            "tool_execution": "tool_execution",
        },
    )

    graph.add_edge("retrieval", "code_understanding")
    graph.add_edge("tool_execution", "code_understanding")
    graph.add_conditional_edges(
        "code_understanding",
        route_after_understanding,
        {
            "patch_generation": "patch_generation",
            "answer": "answer",
        },
    )
    graph.add_edge("patch_generation", "answer")
    graph.add_edge("answer", END)
    return graph.compile()


compiled_graph = build_graph()
