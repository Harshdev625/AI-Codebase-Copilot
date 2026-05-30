"""
Tests for app/graph/nodes/tool_execution.py
Coverage targets:
- tool_execution_node (git_status, run with allowed command, run with blocked command, no-op)
"""
import pytest
from unittest.mock import patch, MagicMock
from app.graph.nodes.tool_execution import tool_execution_node


def test_tool_execution_git_status():
    state = {"query": "git status", "retrieved_context": []}
    with patch("app.graph.nodes.tool_execution.git_status", return_value="M modified_file.py") as mock_git:
        result = tool_execution_node(state)
    assert result["tool_results"][0]["tool"] == "git_status"
    assert "M modified_file.py" in result["tool_results"][0]["output"]
    mock_git.assert_called_once_with(".")


def test_tool_execution_run_allowed_command():
    state = {"query": "run ls -la"}
    with (
        patch("app.graph.nodes.tool_execution.is_command_allowed", return_value=True),
        patch("app.graph.nodes.tool_execution.run_command", return_value="file1\nfile2") as mock_cmd,
    ):
        result = tool_execution_node(state)
    assert result["tool_results"][0]["tool"] == "run_command"
    assert result["tool_results"][0]["output"] == "file1\nfile2"
    mock_cmd.assert_called_once_with("ls -la")


def test_tool_execution_run_blocked_command():
    state = {"query": "run rm -rf /"}
    with (
        patch("app.graph.nodes.tool_execution.is_command_allowed", return_value=False),
        patch("app.graph.nodes.tool_execution.run_command") as mock_cmd,
    ):
        result = tool_execution_node(state)
    assert "Blocked by safety policy" in result["tool_results"][0]["output"]
    mock_cmd.assert_not_called()


def test_tool_execution_no_action():
    state = {"query": "what is the meaning of life?"}
    result = tool_execution_node(state)
    assert result["tool_results"][0]["tool"] == "none"
    assert "No tool action taken" in result["tool_results"][0]["output"]


def test_tool_execution_git_status_case_insensitive():
    """Query with 'git status' anywhere in lowercase."""
    state = {"query": "can you run git status for me?"}
    with patch("app.graph.nodes.tool_execution.git_status", return_value="clean") as mock_git:
        result = tool_execution_node(state)
    assert result["tool_results"][0]["tool"] == "git_status"
    mock_git.assert_called_once()
