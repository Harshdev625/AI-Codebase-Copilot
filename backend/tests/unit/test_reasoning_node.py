"""
Tests for app/graph/nodes/reasoning.py
Coverage targets:
- _snippet_label
- _bounded_excerpt
- _compute_confidence
- reasoning_node (all intents: code, debug, refactor, docs, patch_generation, tool, unknown)
"""
import pytest
from app.graph.nodes.reasoning import (
    _snippet_label,
    _bounded_excerpt,
    _compute_confidence,
    reasoning_node,
)


# ─────────────── _snippet_label ───────────────

def test_snippet_label_with_path_and_symbol():
    item = {"path": "auth/login.py", "symbol": "login_user"}
    assert _snippet_label(item) == "auth/login.py::login_user"


def test_snippet_label_no_symbol():
    item = {"path": "auth/login.py", "symbol": ""}
    # symbol="" becomes "module" due to `str(item.get("symbol") or "module")`
    result = _snippet_label(item)
    assert result == "auth/login.py::module"


def test_snippet_label_none_values():
    item = {}
    result = _snippet_label(item)
    # Default symbol is "module" which is truthy
    assert result == "unknown::module"


# ─────────────── _bounded_excerpt ───────────────

def test_bounded_excerpt_short_content():
    content = "def foo():\n    return 1"
    result = _bounded_excerpt(content)
    assert "def foo():" in result


def test_bounded_excerpt_long_content():
    # Create many lines with long content
    content = "\n".join(["x" * 100] * 20)
    result = _bounded_excerpt(content, max_lines=4, max_chars=320)
    assert len(result) <= 323  # max_chars + "..."


def test_bounded_excerpt_truncates_with_ellipsis():
    long_line = "a" * 400
    result = _bounded_excerpt(long_line, max_chars=100)
    assert result.endswith("...")
    assert len(result) <= 103  # max_chars + "..."


def test_bounded_excerpt_empty_content():
    result = _bounded_excerpt("")
    assert result == ""


def test_bounded_excerpt_only_empty_lines():
    result = _bounded_excerpt("  \n  \n  ")
    assert result == ""


# ─────────────── _compute_confidence ───────────────

def test_compute_confidence_no_snippets():
    result = _compute_confidence("what is auth?", [])
    assert result == 0.15


def test_compute_confidence_no_tokens():
    # Short words (< 3 chars) are filtered out
    result = _compute_confidence("a b c", [{"path": "a.py", "symbol": "fn", "content": "code"}])
    assert result == 0.45


def test_compute_confidence_with_matches():
    snippets = [
        {"path": "auth/login.py", "symbol": "loginUser", "content": "def loginUser(): pass"},
    ]
    result = _compute_confidence("where is loginUser implemented?", snippets)
    assert 0.35 <= result <= 0.95


def test_compute_confidence_many_snippets():
    snippets = [{"path": f"file{i}.py", "symbol": "fn", "content": "code"} for i in range(10)]
    result = _compute_confidence("what is the code?", snippets)
    # With many snippets but no token matches, should have decent coverage score
    assert 0.35 <= result <= 0.95


# ─────────────── reasoning_node ───────────────

def test_reasoning_node_no_context():
    state = {"query": "what is auth?", "intent": "code", "retrieved_context": [], "run_trace": []}
    result = reasoning_node(state)
    assert "No indexed context" in result["analysis"]
    assert result["confidence"] == 0.15
    assert len(result["run_trace"]) == 1


def test_reasoning_node_code_intent():
    state = {
        "query": "how does login work?",
        "intent": "code",
        "retrieved_context": [{"path": "auth.py", "symbol": "login", "content": "def login(): pass"}],
        "run_trace": [],
    }
    result = reasoning_node(state)
    assert "Relevant indexed locations" in result["analysis"]
    assert result["confidence"] > 0.15


def test_reasoning_node_debug_intent():
    state = {
        "query": "debug login error",
        "intent": "debug",
        "retrieved_context": [{"path": "auth.py", "symbol": "login", "content": "def login(): pass"}],
        "run_trace": [],
    }
    result = reasoning_node(state)
    assert "Debug focus" in result["analysis"]


def test_reasoning_node_refactor_intent():
    state = {
        "query": "refactor auth module",
        "intent": "refactor",
        "retrieved_context": [{"path": "auth.py", "symbol": "auth_fn", "content": "code"}],
        "run_trace": [],
    }
    result = reasoning_node(state)
    assert "refactor_plan" in result
    assert "Refactor plan" in result["refactor_plan"]


def test_reasoning_node_docs_intent():
    state = {
        "query": "document auth module",
        "intent": "docs",
        "retrieved_context": [
            {"path": "auth.py", "symbol": "auth_fn", "content": "def auth_fn(): pass"},
        ],
        "run_trace": [],
    }
    result = reasoning_node(state)
    assert "documentation" in result
    assert "Documentation notes" in result["documentation"]


def test_reasoning_node_docs_intent_empty_excerpt():
    state = {
        "query": "document module",
        "intent": "docs",
        "retrieved_context": [
            {"path": "auth.py", "symbol": "fn", "content": "   "},  # whitespace only = empty excerpt
        ],
        "run_trace": [],
    }
    result = reasoning_node(state)
    assert "documentation" in result


def test_reasoning_node_patch_generation_intent():
    state = {
        "query": "patch auth",
        "intent": "patch_generation",
        "retrieved_context": [{"path": "auth.py", "symbol": "fn", "content": "code"}],
        "run_trace": [],
    }
    result = reasoning_node(state)
    assert "refactor_plan" in result
    assert "Patch planning targets" in result["refactor_plan"]


def test_reasoning_node_tool_intent():
    state = {
        "query": "run git status",
        "intent": "tool",
        "retrieved_context": [{"path": "a.py", "symbol": "fn", "content": "code"}],
        "run_trace": [],
    }
    result = reasoning_node(state)
    assert "Tool execution requested" in result["analysis"]


def test_reasoning_node_unknown_intent_falls_through():
    state = {
        "query": "test query",
        "intent": "unknown",
        "retrieved_context": [{"path": "x.py", "symbol": "y", "content": "code"}],
        "run_trace": [],
    }
    result = reasoning_node(state)
    # No special handling for 'unknown', should fall to base analysis
    assert "Relevant indexed locations" in result["analysis"]


def test_reasoning_node_appends_to_trace():
    existing_trace = [{"node": "planner", "info": "prior"}]
    state = {
        "query": "test",
        "intent": "code",
        "retrieved_context": [],
        "run_trace": existing_trace,
    }
    result = reasoning_node(state)
    assert len(result["run_trace"]) == 2
    assert result["run_trace"][1]["node"] == "reasoning"


def test_reasoning_node_none_state_defaults():
    # Missing keys should use defaults
    state = {}
    result = reasoning_node(state)
    assert "analysis" in result
    assert "confidence" in result
