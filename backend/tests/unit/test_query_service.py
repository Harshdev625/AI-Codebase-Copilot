from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.services.query_service import QueryService
from app.models.api_models import ChatRequest
from app.rag.retrieval.service import RetrievalService
from app.rag.embeddings.provider import EmbeddingProvider
from app.db.models import Repository


@pytest.fixture
def mock_retrieval_service():
    service = MagicMock(spec=RetrievalService)
    service.retrieve = AsyncMock(return_value=[])
    return service


@pytest.fixture
def mock_embedding_provider():
    provider = MagicMock(spec=EmbeddingProvider)
    provider.get_embedding = AsyncMock(return_value=[0.1] * 1536)
    return provider


@pytest.fixture
def query_service(mock_retrieval_service):
    with patch("app.services.query_service.get_retrieval_service", return_value=mock_retrieval_service):
        with patch("app.services.query_service.get_model_router", return_value=MagicMock()):
            with patch("app.services.query_service.get_cache_service", return_value=MagicMock()):
                session = AsyncMock()
                service = QueryService(session=session)
                service.retrieval_service = mock_retrieval_service
                return service


@pytest.mark.asyncio
async def test_run_returns_dict(query_service):
    # Mock prepare_generation and finalize_result since run() calls them
    query_service.prepare_generation = AsyncMock(
        return_value=({"patch_proposal": None}, "Context", "cache_key", False)
    )
    query_service.finalize_result = AsyncMock(
        return_value={"answer": "Mocked LLM answer", "session_id": "sid"}
    )
    query_service._get_llm_answer_with_timeout = AsyncMock(return_value="Mocked LLM answer")
    query_service.build_deterministic_answer = MagicMock(return_value=None)
    query_service._ensure_session = AsyncMock(return_value="sid")
    
    result = await query_service.run(
        repository_id="r1",
        repo_id="test-repo",
        query="what does main do?",
        user_id="u1"
    )
    
    assert "answer" in result
    assert result["answer"] == "Mocked LLM answer"
    assert result["session_id"] == "sid"


@pytest.mark.asyncio
async def test_run_raises_no_context_error_if_repo_not_indexed(query_service):
    from app.core.exceptions import NoContextError
    
    # Mock prepare_generation to raise NoContextError directly
    query_service.prepare_generation = AsyncMock(side_effect=NoContextError("index first"))
    query_service._ensure_session = AsyncMock(return_value="sid")
    
    with pytest.raises(NoContextError):
        await query_service.run(
            repository_id="r1",
            repo_id="test-repo",
            query="what does main do?",
            user_id="u1"
        )
