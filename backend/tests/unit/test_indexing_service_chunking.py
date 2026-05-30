import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.indexing_service import IndexingService
from app.core.exceptions import DatabaseException, ExternalServiceError, ValidationException

@pytest.fixture
def indexing_service():
    session = MagicMock()
    service = IndexingService(session=session)
    service.qdrant = MagicMock()
    service.qdrant.ensure_collection = MagicMock()
    return service

def test_generic_chunk_file_basic(indexing_service, tmp_path):
    """generic_chunk_file should split files into 40-line chunks."""
    file_path = tmp_path / "test.js"
    # Create content with 50 lines
    source = "\n".join([f"line {i}" for i in range(50)])
    file_path.write_text(source)

    chunks = indexing_service.generic_chunk_file("repo-1", "abc123", file_path, source)
    assert len(chunks) == 2  # 50 lines / 40 chunk_size = 2 chunks
    assert chunks[0].chunk_type == "generic"
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 40
    assert chunks[1].start_line == 41


def test_generic_chunk_file_truncates_long_content(indexing_service, tmp_path):
    """Content longer than 15000 chars on a line should be truncated."""
    file_path = tmp_path / "large.js"
    # Create one very long line
    long_line = "x" * 20000
    source = long_line
    file_path.write_text(source)

    chunks = indexing_service.generic_chunk_file("repo-1", "abc123", file_path, source)
    assert len(chunks) == 1
    assert len(chunks[0].content) <= 15000 + 20  # truncated + suffix text


def test_generic_chunk_file_empty_source(indexing_service, tmp_path):
    """Empty source should produce 0 chunks."""
    file_path = tmp_path / "empty.py"
    file_path.write_text("")
    chunks = indexing_service.generic_chunk_file("repo-1", "abc123", file_path, "")
    assert chunks == []


def test_assign_repository_ids_and_chunk_ids(indexing_service):
    """Should assign deterministic UUIDs to each chunk."""
    from app.models.domain_models import CodeChunk
    chunks = [
        CodeChunk(
            id="",
            repo_id="repo-1",
            commit_sha="abc123",
            path="test.py",
            language="py",
            symbol="fn",
            chunk_type="function",
            start_line=1,
            end_line=10,
            content="def fn(): pass",
        )
    ]
    indexing_service._assign_repository_ids_and_chunk_ids("rep-uuid", chunks)
    assert chunks[0].repository_id == "rep-uuid"
    assert len(chunks[0].id) == 36  # UUID format

    # Second call with same inputs should give same ID (deterministic)
    first_id = chunks[0].id
    indexing_service._assign_repository_ids_and_chunk_ids("rep-uuid", chunks)
    assert chunks[0].id == first_id


@pytest.mark.asyncio
async def test_index_repository_full_reindex_mode(indexing_service, tmp_path):
    """With full_reindex=True, it should use full mode regardless."""
    # We can only test the discovery phase; don't want real git or embedding calls
    indexing_service._resolve_repo_root = AsyncMock(return_value=tmp_path)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._iter_indexable_files = MagicMock()

    # Provide a real async generator
    async def empty_gen(*args, **kwargs):
        if False:
            yield None
    indexing_service._iter_indexable_files = empty_gen

    # With no repository_id, no deletion happens; with empty file_list no chunks produced
    indexing_service._upsert_chunks = AsyncMock()

    # index_repository with no files will return 0 (no chunks)
    result = await indexing_service.index_repository(
        repo_id="test-repo",
        repository_id=None,
        commit_sha="abc123",
        repo_path=str(tmp_path),
        full_reindex=True,
    )
    assert result == 0  # No files discovered, no chunks
