import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.indexing_service import IndexingService

@pytest.fixture
def indexing_service():
    with patch("app.services.indexing_service.QdrantService"):
        session = MagicMock()
        return IndexingService(session=session)

@pytest.mark.asyncio
async def test_update_progress_no_job(indexing_service):
    await indexing_service._update_progress(None, 1, 10)

@pytest.mark.asyncio
async def test_update_progress_with_job(indexing_service):
    mock_execute = MagicMock()
    indexing_service.session.execute = mock_execute
    indexing_service.session.commit = MagicMock()

    await indexing_service._update_progress(
        indexing_job_id="job1",
        current=1,
        total=10,
        message="test",
        current_file="file1.py",
        elapsed_seconds=1.0,
        extra_stats={"a": 1},
        stage="parsing"
    )

    mock_execute.assert_called_once()
    args, kwargs = mock_execute.call_args
    params = kwargs.get("params") or args[1]
    
    import json
    stats_payload = json.loads(params["stats"])
    
    assert stats_payload["percentage"] == 9
    assert stats_payload["processed_files"] == 1
    assert stats_payload["total_files"] == 10
    assert params["message"] == "test"
    assert stats_payload["current_file"] == "file1.py"
    assert stats_payload["eta_seconds"] == 9

@pytest.mark.asyncio
async def test_update_progress_fallback(indexing_service):
    mock_execute = MagicMock()
    indexing_service.session.execute = mock_execute
    indexing_service.session.commit = MagicMock()

    await indexing_service._update_progress(
        indexing_job_id="job1",
        current=2,
        total=10,
        stage="unknown"
    )

    args, kwargs = mock_execute.call_args
    params = kwargs.get("params") or args[1]
    
    import json
    stats_payload = json.loads(params["stats"])
    assert stats_payload["percentage"] == 20

def test_assign_repository_ids_and_chunk_ids(indexing_service):
    from app.models.domain_models import CodeChunk
    chunks = [
        CodeChunk(
            id="",
            repo_id="test",
            repository_id="",
            commit_sha="123",
            path="file.py",
            language="python",
            symbol="",
            chunk_type="generic",
            start_line=1,
            end_line=2,
            content="test"
        )
    ]
    indexing_service._assign_repository_ids_and_chunk_ids("repo_id_123", chunks)
    assert chunks[0].repository_id == "repo_id_123"
    assert chunks[0].id != ""

def test_generic_chunk_file(indexing_service):
    from pathlib import Path
    source = "\n".join([f"line {i}" for i in range(100)])
    chunks = indexing_service.generic_chunk_file("repo1", "commit1", Path("test.py"), source)
    
    assert len(chunks) == 3
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 40
    assert chunks[1].start_line == 41
    assert chunks[1].end_line == 80
    assert chunks[2].start_line == 81
    assert chunks[2].end_line == 100
    
def test_generic_chunk_file_huge_minified(indexing_service):
    from pathlib import Path
    source = "a" * 20000
    chunks = indexing_service.generic_chunk_file("repo1", "commit1", Path("test.py"), source)
    assert len(chunks) == 1
    assert len(chunks[0].content) <= 15020

@pytest.mark.asyncio
async def test_upsert_chunks_empty(indexing_service):
    await indexing_service._upsert_chunks([])

@pytest.mark.asyncio
async def test_upsert_chunks_success(indexing_service):
    from app.models.domain_models import CodeChunk
    chunks = [
        CodeChunk(
            id="chunk1",
            repo_id="test",
            repository_id="test_id",
            commit_sha="123",
            path="file.py",
            language="python",
            symbol="",
            chunk_type="generic",
            start_line=1,
            end_line=2,
            content="test"
        )
    ]
    
    mock_embed = MagicMock(return_value=[0.1] * 768)
    indexing_service.embedder = MagicMock()
    indexing_service.embedder.embed_text = mock_embed
    indexing_service._prefer_cached_embeddings = False
    
    indexing_service.session.execute = MagicMock()
    indexing_service.session.commit = MagicMock()
    
    with patch.object(indexing_service, "_update_progress", new_callable=AsyncMock) as mock_prog:
        await indexing_service._upsert_chunks(chunks)
        
        indexing_service.qdrant.upsert_points.assert_called_once()
        indexing_service.session.execute.assert_called()

@pytest.mark.asyncio
async def test_upsert_chunks_embedding_failure(indexing_service):
    from app.models.domain_models import CodeChunk
    chunks = [
        CodeChunk(
            id="chunk1",
            repo_id="test",
            repository_id="test_id",
            commit_sha="123",
            path="file.py",
            language="python",
            symbol="",
            chunk_type="generic",
            start_line=1,
            end_line=2,
            content="test"
        )
    ]
    
    mock_embed = MagicMock(side_effect=Exception("embedding failed"))
    indexing_service.embedder = MagicMock()
    indexing_service.embedder.embed_text = mock_embed
    indexing_service._prefer_cached_embeddings = False
    
    indexing_service.session.execute = MagicMock()
    indexing_service.session.commit = MagicMock()
    
    with patch.object(indexing_service, "_update_progress", new_callable=AsyncMock):
        await indexing_service._upsert_chunks(chunks)
        
        indexing_service.session.execute.assert_called()
        indexing_service.qdrant.upsert_points.assert_not_called()
