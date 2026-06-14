"""Tests for graph retrieval node scope_paths wiring."""

from unittest.mock import MagicMock, patch

from app.graph.nodes.retrieval import retrieval_node


def test_retrieval_node_passes_scope_paths():
    mock_session = MagicMock()
    mock_session.execute = MagicMock()
    mock_service = MagicMock()
    mock_service.retrieve_repository.return_value = [
        {"path": "README.md", "symbol": "module", "content": "# Project", "score": 0.9},
    ]

    with patch("app.graph.nodes.retrieval.get_retrieval_service", return_value=mock_service):
        result = retrieval_node(
            {
                "repository_id": "repo-1",
                "query": "tell me about the project",
                "session": mock_session,
                "scope_paths": ["README.md"],
                "run_trace": [],
            }
        )

    mock_service.retrieve_repository.assert_called_once_with(
        repository_id="repo-1",
        query="tell me about the project",
        top_k=8,
        scope_paths=["README.md"],
    )
    assert len(result["retrieved_context"]) == 1
    assert result["run_trace"][-1]["node"] == "retrieval"
    assert "Retrieved 1 sources" in result["run_trace"][-1]["label"]
