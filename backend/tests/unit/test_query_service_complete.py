"""Tests for QueryService._complete_after_graph."""

from unittest.mock import MagicMock, patch

import pytest

from app.core.exceptions import NoContextError


@pytest.fixture
def query_service(mock_session):
    with (
        patch("app.services.query_service.get_cache_service", return_value=MagicMock()),
        patch("app.services.query_service.get_model_router", return_value=MagicMock()),
        patch("app.services.query_service.get_retrieval_service", return_value=MagicMock()),
    ):
        from app.services.query_service import QueryService

        svc = QueryService(session=mock_session)
        svc.retrieval_service.retrieve_repository = MagicMock(return_value=[])
        return svc


@pytest.fixture
def mock_session():
    return MagicMock()


@pytest.mark.asyncio
async def test_complete_after_graph_raises_without_context(query_service):
    with pytest.raises(NoContextError, match="No indexed context"):
        await query_service._complete_after_graph(
            {},
            repository_id="repo-uuid",
            repo_id="org/repo",
            query="where is auth?",
            session_id="sess-1",
            scope_paths=None,
            attached_files=None,
            chat_mode="ASK",
            history=[],
        )


@pytest.mark.asyncio
async def test_complete_after_graph_builds_context_from_retrieval(query_service):
    snippet = {"path": "src/auth.py", "content": "def login(): pass", "score": 0.9}
    query_service.retrieval_service.retrieve_repository.return_value = [snippet]

    with patch(
        "app.services.query_service.build_context_packet",
        return_value=("assembled ctx", [{"path": "src/auth.py"}]),
    ):
        result = await query_service._complete_after_graph(
            {},
            repository_id="repo-uuid",
            repo_id="org/repo",
            query="where is auth?",
            session_id="sess-1",
            scope_paths=["src/"],
            attached_files=None,
            chat_mode="ASK",
            history=[],
        )

    assert result["_assembled_context"] == "assembled ctx"
    assert result["source_index"] == [{"path": "src/auth.py"}]
    assert result["query"] == "where is auth?"
    query_service.retrieval_service.retrieve_repository.assert_called_once()


@pytest.mark.asyncio
async def test_complete_after_graph_prepends_attached_snippets(query_service):
    attached = [{"path": "pinned.py", "content": "x", "score": 1.0, "pinned": True, "symbol": "attached"}]
    existing = [{"path": "other.py", "content": "y", "score": 0.5}]
    query_service._load_attached_file_snippets = MagicMock(return_value=attached)

    with patch(
        "app.services.query_service.build_context_packet",
        return_value=("ctx", []),
    ):
        result = await query_service._complete_after_graph(
            {"retrieved_context": existing},
            repository_id="repo-uuid",
            repo_id="org/repo",
            query="explain",
            session_id=None,
            scope_paths=None,
            attached_files=["pinned.py"],
            chat_mode="ASK",
            history=[],
        )

    merged = result["retrieved_context"]
    assert merged[0]["path"] == "pinned.py"
    assert merged[1]["path"] == "other.py"


@pytest.mark.asyncio
async def test_complete_after_graph_adds_patch_proposal(query_service):
    with patch(
        "app.services.query_service.build_context_packet",
        return_value=("ctx", []),
    ):
        result = await query_service._complete_after_graph(
            {
                "patch": "diff --git a/a.py b/a.py\n--- a/a.py\n+++ b/a.py\n",
                "query": "fix login",
                "retrieved_context": [{"path": "a.py", "content": "code", "score": 1.0}],
            },
            repository_id="repo-uuid",
            repo_id="org/repo",
            query="fix login",
            session_id=None,
            scope_paths=None,
            attached_files=None,
            chat_mode="ACT",
            history=[],
        )

    assert result["patch_proposal"] is not None
    assert result["patch_proposal"]["intent"] == "patch_generation"
    assert "a.py" in result["patch_proposal"]["files"]


@pytest.mark.asyncio
async def test_complete_after_graph_prefixes_analysis(query_service):
    with patch(
        "app.services.query_service.build_context_packet",
        return_value=("base ctx", []),
    ):
        result = await query_service._complete_after_graph(
            {
                "analysis": "Graph found auth in src/auth.py",
                "retrieved_context": [{"path": "a.py", "content": "code", "score": 1.0}],
            },
            repository_id="repo-uuid",
            repo_id="org/repo",
            query="q",
            session_id=None,
            scope_paths=None,
            attached_files=None,
            chat_mode="ASK",
            history=[],
        )

    assert "Graph analysis" in result["_assembled_context"]
    assert "base ctx" in result["_assembled_context"]
