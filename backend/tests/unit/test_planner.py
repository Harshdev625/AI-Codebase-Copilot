"""Unit tests for the keyword-based planner node."""
import pytest

from app.graph.nodes.planner import planner_node


def _run(query: str) -> str:
    result = planner_node({"query": query, "repo_id": "repo"})
    return result["intent"]


def test_refactor_intent():
    assert _run("refactor the auth module") == "refactor"


def test_debug_intent_error():
    assert _run("there is an error in the login flow") == "debug"


def test_debug_intent_exception():
    assert _run("exception raised in UserService") == "debug"


def test_debug_intent_traceback():
    assert _run("traceback shows null pointer") == "debug"


def test_tool_intent_run():
    assert _run("run pytest tests/") == "tool"


def test_tool_intent_git():
    assert _run("git status of my repo") == "tool"


def test_docs_intent_document():
    assert _run("document the API endpoints") == "docs"


def test_docs_intent_readme():
    assert _run("generate readme for the project") == "docs"


def test_default_search_intent():
    assert _run("where is the payment processing logic?") == "search"


def test_search_intent_architecture_question():
    assert _run("how does the retrieval pipeline work?") == "search"


def test_refactor_takes_priority_over_default():
    # "refactor" keyword should be matched first
    assert _run("I want to refactor the database layer") == "refactor"
