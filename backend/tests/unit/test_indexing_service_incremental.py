import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.indexing_service import IndexingService
from app.models.domain_models import CodeChunk
from app.core.config import settings

@pytest.fixture
def indexing_service():
    with patch("app.services.indexing_service.QdrantService"):
        session = MagicMock()
        return IndexingService(session=session)


def _mock_root():
    mock_root = MagicMock()
    mock_root.exists.return_value = True
    return mock_root


async def _files_async(*paths: str):
    async def _iter(*_args, **_kwargs):
        for rel in paths:
            yield Path(rel)
    return _iter


@pytest.mark.asyncio
async def test_index_repository_incremental_skip(indexing_service):
    indexing_service._resolve_repo_root = AsyncMock(return_value=_mock_root())
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._count_repository_chunks = MagicMock(return_value=5)
    indexing_service._count_indexed_repository_files = MagicMock(return_value=0)
    indexing_service._iter_indexable_files = await _files_async("README.md")

    with patch(
        "app.services.indexing_service.upsert_file_records",
        new_callable=AsyncMock,
        return_value=(1, [], []),
    ):
        with patch("app.services.indexing_service.settings") as mock_settings:
            mock_settings.indexing_force_full_reindex = False
            mock_settings.indexing_incremental_enabled = True

            result = await indexing_service.index_repository(
                repo_id="test",
                repository_id="test_id",
                commit_sha="commit1",
                full_reindex=False,
            )
    assert result == 0


@pytest.mark.asyncio
async def test_index_repository_exception_handling(indexing_service):
    indexing_service._resolve_repo_root = AsyncMock(side_effect=Exception("resolve failed"))
    indexing_service._format_process_error = MagicMock(return_value="formatted error")

    with pytest.raises(Exception):
        await indexing_service.index_repository(
            repo_id="test",
            repository_id="test_id",
            commit_sha="commit1",
        )


@pytest.mark.asyncio
async def test_index_repository_incremental_deleted_files_only(indexing_service):
    mock_root = _mock_root()
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._count_repository_chunks = MagicMock(return_value=0)
    indexing_service._iter_indexable_files = await _files_async("README.md")
    indexing_service._apply_post_index_cleanup = AsyncMock()

    with patch(
        "app.services.indexing_service.upsert_file_records",
        new_callable=AsyncMock,
        return_value=(0, [], ["deleted.py"]),
    ):
        with patch("app.services.indexing_service.create_snapshot", new_callable=AsyncMock):
            with patch("app.services.indexing_service.settings") as mock_settings:
                mock_settings.indexing_force_full_reindex = False
                mock_settings.indexing_incremental_enabled = True

                result = await indexing_service.index_repository(
                    repo_id="test",
                    repository_id="test_id",
                    commit_sha="commit1",
                    full_reindex=False,
                )

    assert result == 0
    indexing_service._apply_post_index_cleanup.assert_called_once()


@pytest.mark.asyncio
async def test_upsert_chunks_qdrant_exception(indexing_service):
    from app.core.exceptions import ExternalServiceError, DatabaseException
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
            content="test",
        )
    ]
    mock_embed = MagicMock(return_value=[0.1] * settings.vector_dim)
    indexing_service.embedder = MagicMock()
    indexing_service.embedder.embed_text = mock_embed
    indexing_service._prefer_cached_embeddings = False

    indexing_service.session.execute = MagicMock()
    indexing_service.qdrant.upsert_points = MagicMock(side_effect=ExternalServiceError("qdrant error", "mock_error"))

    with patch.object(indexing_service, "_update_progress", new_callable=AsyncMock):
        # When qdrant fails, the code raises DatabaseException (Phase 3 FIX:
        # don't silently fall back, surface the Qdrant sync failure).
        with pytest.raises(DatabaseException, match="Failed to sync"):
            await indexing_service._upsert_chunks(chunks)
        # Verify qdrant was attempted but failed
        indexing_service.qdrant.upsert_points.assert_called_once()


@pytest.mark.asyncio
async def test_index_repository_no_chunks(indexing_service):
    mock_root = _mock_root()
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._count_repository_chunks = MagicMock(return_value=0)
    indexing_service._count_repository_chunks = MagicMock(return_value=0)
    indexing_service._count_indexed_repository_files = MagicMock(return_value=0)
    indexing_service._iter_indexable_files = await _files_async()
    indexing_service._apply_post_index_cleanup = AsyncMock()
    indexing_service._upsert_chunks = AsyncMock()

    with patch(
        "app.services.indexing_service.upsert_file_records",
        new_callable=AsyncMock,
        return_value=(0, [], []),
    ):
        with patch("app.services.indexing_service.settings") as mock_settings:
            mock_settings.indexing_force_full_reindex = False
            mock_settings.indexing_incremental_enabled = True

            result = await indexing_service.index_repository(
                repo_id="test",
                repository_id="test_id",
                commit_sha="commit1",
                full_reindex=False,
            )

    assert result == 0
    indexing_service._upsert_chunks.assert_not_called()
