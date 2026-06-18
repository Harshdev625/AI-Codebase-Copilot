"""Extended QueryService unit tests (touch session, attached files)."""

from unittest.mock import MagicMock, patch

import pytest

from app.db.models import ChatSession


@pytest.fixture
def query_service(mock_session):
    with (
        patch("app.services.query_service.get_cache_service", return_value=MagicMock()),
        patch("app.services.query_service.get_model_router", return_value=MagicMock()),
        patch("app.services.query_service.get_retrieval_service", return_value=MagicMock()),
    ):
        from app.services.query_service import QueryService

        return QueryService(session=mock_session)


@pytest.fixture
def mock_session():
    session = MagicMock()
    session.execute.return_value.mappings.return_value.all.return_value = []
    return session


def test_touch_session_no_row(query_service, mock_session):
    mock_session.query.return_value.filter.return_value.first.return_value = None
    query_service._touch_session("missing", query_text="hello", usage={})
    mock_session.commit.assert_not_called()


def test_touch_session_sets_title_and_usage(query_service, mock_session):
    row = MagicMock(spec=ChatSession)
    row.session_title = ""
    row.session_metadata = {}
    mock_session.query.return_value.filter.return_value.first.return_value = row

    query_service._touch_session(
        "sess-1",
        query_text="Where is authentication handled?",
        usage={"prompt_tokens": 12, "completion_tokens": 8, "total_tokens": 20},
    )

    assert "authentication" in row.session_title
    assert row.session_metadata["title_preview"].startswith("Where is authentication")
    assert row.session_metadata["usage_totals"]["total_tokens"] == 20


def test_touch_session_truncates_long_title(query_service, mock_session):
    row = MagicMock(spec=ChatSession)
    row.session_title = ""
    row.session_metadata = {}
    mock_session.query.return_value.filter.return_value.first.return_value = row

    query_service._touch_session("sess-1", query_text="x" * 80, usage={})
    assert row.session_title.endswith("…")
    assert len(row.session_title) == 61


def test_touch_session_preserves_existing_title(query_service, mock_session):
    row = MagicMock(spec=ChatSession)
    row.session_title = "Existing title"
    row.session_metadata = {}
    mock_session.query.return_value.filter.return_value.first.return_value = row

    query_service._touch_session("sess-1", query_text="New query", usage={})
    assert row.session_title == "Existing title"


def test_load_attached_file_snippets_empty(query_service):
    assert query_service._load_attached_file_snippets(None, ["a.py"]) == []
    assert query_service._load_attached_file_snippets("repo-id", None) == []


def test_load_attached_file_snippets_no_repository(query_service, mock_session):
    mock_session.query.return_value.filter.return_value.first.return_value = None
    assert query_service._load_attached_file_snippets("repo-id", ["main.py"]) == []


def test_load_attached_file_snippets_success(query_service, mock_session, tmp_path):
    repo = MagicMock()
    repo.repo_id = "org/repo"
    repo.local_path = str(tmp_path)
    mock_session.query.return_value.filter.return_value.first.return_value = repo

    content = "print('hello')\n"
    (tmp_path / "main.py").write_text(content, encoding="utf-8")

    with patch("app.services.repository_cache.resolve_repository_workspace", return_value=tmp_path):
        snippets = query_service._load_attached_file_snippets("repo-id", ["main.py"])

    assert len(snippets) == 1
    assert snippets[0]["path"] == "main.py"
    assert snippets[0]["pinned"] is True
    assert "hello" in snippets[0]["content"]


def test_load_attached_file_snippets_truncates_large_files(query_service, mock_session, tmp_path):
    repo = MagicMock()
    repo.repo_id = "org/repo"
    repo.local_path = str(tmp_path)
    mock_session.query.return_value.filter.return_value.first.return_value = repo

    huge = "x" * 60_000
    (tmp_path / "big.txt").write_text(huge, encoding="utf-8")

    with patch("app.services.repository_cache.resolve_repository_workspace", return_value=tmp_path):
        snippets = query_service._load_attached_file_snippets("repo-id", ["big.txt"])

    assert len(snippets) == 1
    assert snippets[0]["content"].endswith("...(truncated)...")
    assert len(snippets[0]["content"]) < len(huge)


def test_load_attached_file_snippets_skips_traversal(query_service, mock_session, tmp_path):
    repo = MagicMock()
    repo.repo_id = "org/repo"
    repo.local_path = str(tmp_path)
    mock_session.query.return_value.filter.return_value.first.return_value = repo

    with patch("app.services.repository_cache.resolve_repository_workspace", return_value=tmp_path):
        snippets = query_service._load_attached_file_snippets("repo-id", ["../secret.py"])

    assert snippets == []


@pytest.mark.asyncio
async def test_prepare_generation_cache_hit(query_service):
    cached_payload = {"answer": "cached answer", "retrieved_context": []}
    query_service.cache.get_json.return_value = cached_payload

    result, context, cache_key, from_cache = await query_service.prepare_generation(
        "repo-uuid",
        "org/repo",
        "hello",
        session_id="sess-1",
    )

    assert from_cache is True
    assert result == cached_payload
    assert context == ""
    assert cache_key.startswith("chat:v3:")


@pytest.mark.asyncio
async def test_prepare_generation_raises_without_repository(query_service):
    from app.core.exceptions import NoContextError

    query_service.cache.get_json.return_value = None
    with pytest.raises(NoContextError, match="Repository context missing"):
        await query_service.prepare_generation(None, None, "hello")
