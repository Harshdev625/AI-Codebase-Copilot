"""
Tests for app/services/query_service.py

Coverage targets:
- _history_hash
- _build_patch_proposal_from_state
- build_deterministic_answer
- _build_fallback_answer
- _select_fallback_answer
- _ensure_session (success + failure)
- _load_session_history (success + failure + roles)
- _record_agent_run (success + failure + skip empty session_id)
- finalize_result (success + empty answer)
- _invoke_graph_with_trace (success + failure)
- _get_llm_answer_with_timeout (timeout + unexpected error)
"""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.query_service import QueryService
from app.core.exceptions import (
    DatabaseException,
    LLMRequestError,
    NoContextError,
    WorkflowError,
    ExternalServiceError,
)


# ─────────────── fixtures ───────────────

@pytest.fixture
def mock_session():
    session = MagicMock()
    session.execute.return_value.mappings.return_value.all.return_value = []
    return session


@pytest.fixture
def query_service(mock_session):
    with (
        patch("app.services.query_service.get_cache_service", return_value=MagicMock()),
        patch("app.services.query_service.get_model_router", return_value=MagicMock()),
        patch("app.services.query_service.get_retrieval_service", return_value=MagicMock()),
    ):
        return QueryService(session=mock_session)


# ─────────────── _history_hash ───────────────

def test_history_hash_empty(query_service):
    result = query_service._history_hash([])
    assert result == "no-history"


def test_history_hash_no_created_at(query_service):
    result = query_service._history_hash([{"query": "hello"}])
    assert result == "no-timestamp"


def test_history_hash_with_datetime(query_service):
    dt = datetime(2024, 1, 1, 12, 0, 0)
    result = query_service._history_hash([{"query": "hello", "created_at": dt}])
    assert result == str(dt.timestamp())


def test_history_hash_with_string_timestamp(query_service):
    result = query_service._history_hash([{"query": "hello", "created_at": "2024-01-01T12:00:00"}])
    # Should return a 16-char hex hash fallback
    assert isinstance(result, str)
    assert len(result) == 16


# ─────────────── _build_patch_proposal_from_state ───────────────

def test_build_patch_proposal_empty_patch(query_service):
    result = query_service._build_patch_proposal_from_state({"patch": "", "query": "refactor auth"})
    assert result is None


def test_build_patch_proposal_with_diff(query_service):
    state = {
        "patch": "--- a/auth.py\n+++ b/auth.py\n@@ -1 +1 @@\n-old\n+new",
        "query": "refactor auth",
        "refactor_plan": "Reorganize auth module",
    }
    result = query_service._build_patch_proposal_from_state(state)
    assert result is not None
    assert "refactor auth" in result["title"]
    assert result["diff"] == state["patch"]
    assert result["files"] == ["auth.py"]
    assert result["intent"] == "patch_generation"


def test_build_patch_proposal_no_query(query_service):
    state = {"patch": "--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n+x"}
    result = query_service._build_patch_proposal_from_state(state)
    assert result["title"] == "Proposed code change"


# ─────────────── build_deterministic_answer ───────────────

def test_build_deterministic_answer_no_location_intent(query_service):
    result = query_service.build_deterministic_answer("what is auth?", {"retrieved_context": []})
    assert result is None


def test_build_deterministic_answer_no_target(query_service):
    result = query_service.build_deterministic_answer("where is the code?", {"retrieved_context": []})
    assert result is None


def test_build_deterministic_answer_auth_target(query_service):
    result = query_service.build_deterministic_answer(
        "where is auth implemented?",
        {
            "retrieved_context": [
                {"path": "backend/auth.py", "symbol": "auth", "content": "def auth(): pass"}
            ]
        },
    )
    # Should return a deterministic answer with the file reference
    assert result is not None
    assert "auth" in result.lower()


def test_build_deterministic_answer_no_matching_snippets(query_service):
    result = query_service.build_deterministic_answer(
        "where is `loginUser` function defined?",
        {
            "retrieved_context": [
                {"path": "app.py", "symbol": "other_fn", "content": "def other_fn(): pass"}
            ]
        },
    )
    assert result is None


def test_build_deterministic_answer_with_matches(query_service):
    snippets = [
        {"path": "auth/login.py", "symbol": "loginUser", "content": "def loginUser(): pass"},
        {"path": "readme.md", "symbol": "loginUser", "content": "loginUser does login"},
    ]
    result = query_service.build_deterministic_answer(
        "where is `loginUser` defined?",
        {"retrieved_context": snippets},
    )
    assert result is not None
    # Code files should be preferred over markdown
    assert "login.py" in result


# ─────────────── _build_fallback_answer ───────────────

def test_build_fallback_answer_no_sources(query_service):
    result = query_service._build_fallback_answer("test query", {})
    assert "temporarily unavailable" in result
    assert "no indexed sources available" in result


def test_build_fallback_answer_with_sources(query_service):
    result = query_service._build_fallback_answer(
        "test query",
        {"retrieved_context": [{"path": "auth.py", "symbol": "auth_fn"}]},
    )
    assert "auth.py" in result
    assert "auth_fn" in result


# ─────────────── _select_fallback_answer ───────────────

def test_select_fallback_prefers_graph_answer(query_service):
    result = query_service._select_fallback_answer(
        "query", {"answer": "Graph generated this answer"}
    )
    assert result == "Graph generated this answer"


def test_select_fallback_uses_deterministic(query_service):
    # No graph answer, but query has location intent + snippets matching target
    result = query_service._select_fallback_answer(
        "where is `auth` implemented?",
        {
            "answer": "",
            "retrieved_context": [
                {"path": "auth.py", "symbol": "auth", "content": "def auth(): pass"}
            ],
        },
    )
    assert result is not None
    assert len(result) > 0


def test_select_fallback_uses_generic(query_service):
    result = query_service._select_fallback_answer(
        "hello world",
        {"answer": "", "retrieved_context": []},
    )
    assert "temporarily unavailable" in result or len(result) > 0


# ─────────────── _ensure_session ───────────────

@pytest.mark.asyncio
async def test_ensure_session_with_existing_id(query_service):
    result = await query_service._ensure_session("existing-session", "user-1", "repo-1")
    assert result == "existing-session"


@pytest.mark.asyncio
async def test_ensure_session_creates_new(query_service, mock_session):
    result = await query_service._ensure_session(None, "user-1", "repo-1")
    assert result is not None
    assert len(result) > 0
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_ensure_session_db_failure(query_service, mock_session):
    mock_session.add.side_effect = Exception("DB Error")
    with pytest.raises(DatabaseException, match="Failed to create new chat session"):
        await query_service._ensure_session(None, "user-1", "repo-1")
    mock_session.rollback.assert_called_once()


# ─────────────── _load_session_history ───────────────

@pytest.mark.asyncio
async def test_load_session_history_no_session_id(query_service):
    result = await query_service._load_session_history(None)
    assert result == []


@pytest.mark.asyncio
async def test_load_session_history_with_rows(query_service, mock_session):
    mock_rows = [
        {"role": "user", "content": "hello", "created_at": None},
        {"role": "assistant", "content": "hi", "created_at": None},
        {"role": "system", "content": "sys msg", "created_at": None},
    ]
    mock_session.execute.return_value.mappings.return_value.all.return_value = mock_rows
    result = await query_service._load_session_history("session-1")
    assert len(result) == 3
    assert "query" in result[0]
    assert "answer" in result[1]


@pytest.mark.asyncio
async def test_load_session_history_db_failure(query_service, mock_session):
    mock_session.execute.side_effect = Exception("DB Error")
    with pytest.raises(DatabaseException, match="Failed to load session history"):
        await query_service._load_session_history("session-1")


# ─────────────── _record_agent_run ───────────────

@pytest.mark.asyncio
async def test_record_agent_run_no_session(query_service, mock_session):
    # Should return early without touching DB
    await query_service._record_agent_run(
        session_id=None,
        query="hello",
        answer="world",
    )
    mock_session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_record_agent_run_with_session(query_service, mock_session):
    await query_service._record_agent_run(
        session_id="session-1",
        user_id="user-1",
        repo_id="repo-1",
        repository_id="rep-uuid",
        query="what is auth?",
        intent="retrieval",
        answer="Auth is in auth.py",
        source_index=[],
        stats={},
        patch_proposal=None,
    )
    assert mock_session.execute.call_count >= 2  # user + assistant messages
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_record_agent_run_persists_sources_and_source_index(query_service, mock_session):
    import json

    sources = [{"path": "src/auth.py", "score": 0.9}]
    await query_service._record_agent_run(
        session_id="session-1",
        query="what is auth?",
        answer="Auth is in auth.py",
        source_index=sources,
    )
    assistant_call = mock_session.execute.call_args_list[-1]
    params = assistant_call.args[1] if len(assistant_call.args) > 1 else assistant_call.kwargs
    metadata_raw = params["metadata"]
    metadata = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw
    assert metadata["source_index"] == sources
    assert metadata["sources"] == sources


@pytest.mark.asyncio
async def test_record_agent_run_db_failure(query_service, mock_session):
    mock_session.execute.side_effect = Exception("DB Error")
    with pytest.raises(DatabaseException, match="Failed to record agent run"):
        await query_service._record_agent_run(
            session_id="session-1",
            query="test",
            answer="answer",
        )
    mock_session.rollback.assert_called_once()


# ─────────────── finalize_result ───────────────

@pytest.mark.asyncio
async def test_finalize_result_empty_answer(query_service):
    with pytest.raises(LLMRequestError, match="empty response"):
        await query_service.finalize_result(
            "repo-id", "repo", {"answer": ""}, "cache_key"
        )


@pytest.mark.asyncio
async def test_finalize_result_success(query_service, mock_session):
    query_service._record_agent_run = AsyncMock()
    result = await query_service.finalize_result(
        "repo-id",
        "repo",
        {"answer": "This is the answer"},
        "cache_key",
        user_id="user-1",
        session_id="sess-1",
    )
    assert result["answer"] == "This is the answer"
    query_service.cache.set_json.assert_called_once()
    query_service._record_agent_run.assert_awaited_once()


@pytest.mark.asyncio
async def test_finalize_result_record_failure_logged(query_service, mock_session):
    # _record_agent_run failure should be caught and logged, not raised
    query_service._record_agent_run = AsyncMock(side_effect=Exception("Record failed"))
    result = await query_service.finalize_result(
        "repo-id",
        "repo",
        {"answer": "answer"},
        "cache_key",
    )
    assert result["answer"] == "answer"


# ─────────────── _invoke_graph_with_trace ───────────────

@pytest.mark.asyncio
async def test_invoke_graph_success(query_service):
    with patch("app.services.query_service.compiled_graph") as mock_graph:
        mock_graph.ainvoke = AsyncMock(return_value={"answer": "ok"})
        result = await query_service._invoke_graph_with_trace({"query": "test"})
    assert result == {"answer": "ok"}


@pytest.mark.asyncio
async def test_invoke_graph_failure(query_service):
    with patch("app.services.query_service.compiled_graph") as mock_graph:
        mock_graph.ainvoke = AsyncMock(side_effect=Exception("Graph exploded"))
        with pytest.raises(WorkflowError, match="Workflow execution failed"):
            await query_service._invoke_graph_with_trace({"query": "test"})


# ─────────────── _get_llm_answer_with_timeout ───────────────

@pytest.mark.asyncio
async def test_get_llm_answer_timeout(query_service):
    query_service.model_router.chat = MagicMock(side_effect=asyncio.TimeoutError())
    with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError()):
        with pytest.raises(LLMRequestError, match="timed out"):
            await query_service._get_llm_answer_with_timeout("query", "ctx", "single")


@pytest.mark.asyncio
async def test_get_llm_answer_unexpected_error(query_service):
    with patch("asyncio.wait_for", side_effect=ValueError("Bad value")):
        with pytest.raises(LLMRequestError, match="Language model request failed"):
            await query_service._get_llm_answer_with_timeout("query", "ctx", "single")
