"""Unit tests for graph workflow routing and answer node (Wave B4)."""

from app.graph.nodes.answer import answer_node
from app.graph.workflow import route_after_reasoning


def test_route_after_reasoning_tool_intent():
    assert route_after_reasoning({"intent": "tool", "query": "explain auth"}) == "tool_execution"


def test_route_after_reasoning_run_prefix():
    assert route_after_reasoning({"intent": "search", "query": "run pytest"}) == "tool_execution"


def test_route_after_reasoning_git_status():
    assert route_after_reasoning({"intent": "search", "query": "show git status"}) == "tool_execution"


def test_route_after_reasoning_default_answer():
    assert route_after_reasoning({"intent": "docs", "query": "architecture overview"}) == "answer"


def test_answer_node_composes_sections_and_trace():
    state = {
        "analysis": "Analysis text",
        "refactor_plan": "Refactor steps",
        "documentation": "Docs section",
        "tool_results": [{"output": "tool ok"}],
        "patch": "diff --git a/x b/x",
        "patch_proposal": {"diff": "patch", "summary": "Fix bug"},
        "verification": {"confidence": 0.8, "retrieved_count": 3},
        "run_trace": [{"node": "reasoning", "label": "Reasoning"}],
    }
    result = answer_node(state)
    assert "Analysis text" in result["answer"]
    assert "Refactor steps" in result["answer"]
    assert "tool ok" in result["answer"]
    assert "diff --git" in result["answer"]
    assert "Patch proposal ready" in result["answer"]
    assert result["run_trace"][-1]["node"] == "answer"
    assert result["run_trace"][-1]["detail"]["retrieved_count"] == 3


def test_answer_node_empty_state_fallback():
    result = answer_node({})
    assert result["answer"] == "No answer generated."
    assert result["run_trace"][-1]["node"] == "answer"
