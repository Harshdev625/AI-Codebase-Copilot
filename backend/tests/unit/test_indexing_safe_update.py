"""Tests for safe update-index flow (delete after upsert, discovery guards)."""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.exceptions import ValidationException
from app.services.indexing_service import IndexingService


@pytest.fixture
def indexing_service():
    with patch("app.services.indexing_service.QdrantService"):
        session = MagicMock()
        return IndexingService(session=session)


@pytest.mark.asyncio
async def test_empty_discovery_aborts_when_chunks_exist(indexing_service):
    mock_root = MagicMock(spec=Path)
    mock_root.__truediv__ = lambda self, other: MagicMock(spec=Path, exists=MagicMock(return_value=False))
    mock_root.exists.return_value = True

    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._count_repository_chunks = MagicMock(return_value=42)

    async def _empty_files(*_args, **_kwargs):
        if False:
            yield  # pragma: no cover

    indexing_service._iter_indexable_files = _empty_files

    with patch("app.services.indexing_service.settings") as mock_settings:
        mock_settings.indexing_force_full_reindex = False
        mock_settings.indexing_incremental_enabled = True

        with pytest.raises(ValidationException, match="File discovery found 0 files"):
            await indexing_service.index_repository(
                repo_id="repo-1",
                repository_id="repo-db-1",
                commit_sha="local-working-copy",
                full_reindex=False,
            )


@pytest.mark.asyncio
async def test_incremental_no_changes_skips_delete_and_upsert(indexing_service):
    mock_root = MagicMock(spec=Path)
    mock_root.exists.return_value = True
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._delete_repository_chunks_for_paths = AsyncMock()
    indexing_service._upsert_chunks = AsyncMock()
    indexing_service._apply_post_index_cleanup = AsyncMock()
    indexing_service._count_repository_chunks = MagicMock(return_value=5)
    indexing_service._count_indexed_repository_files = MagicMock(return_value=1)

    async def _one_file(*_args, **_kwargs):
        yield Path("README.md")

    indexing_service._iter_indexable_files = _one_file

    with patch(
        "app.services.indexing_service.upsert_file_records",
        new_callable=AsyncMock,
        return_value=(1, [], []),
    ):
        with patch("app.services.indexing_service.settings") as mock_settings:
            mock_settings.indexing_force_full_reindex = False
            mock_settings.indexing_incremental_enabled = True

            result = await indexing_service.index_repository(
                repo_id="repo-1",
                repository_id="repo-db-1",
                commit_sha="local-working-copy",
                full_reindex=False,
            )

    assert result == 0
    indexing_service._upsert_chunks.assert_not_called()
    indexing_service._apply_post_index_cleanup.assert_not_called()
    indexing_service._delete_repository_chunks_for_paths.assert_not_called()


@pytest.mark.asyncio
async def test_cleanup_runs_after_upsert_not_before(indexing_service):
    mock_root = MagicMock(spec=Path)
    mock_root.exists.return_value = True
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._assign_repository_ids_and_chunk_ids = MagicMock()
    indexing_service._apply_post_index_cleanup = AsyncMock()
    indexing_service._delete_all_repository_chunks = AsyncMock()

    call_order: list[str] = []

    async def _upsert(chunks):
        call_order.append("upsert")
        return None

    async def _cleanup(**_kwargs):
        call_order.append("cleanup")

    indexing_service._upsert_chunks = _upsert
    indexing_service._apply_post_index_cleanup = _cleanup

    readme = MagicMock(spec=Path)
    readme.exists.return_value = True
    readme.suffix = ".md"
    readme.read_text.return_value = "# Hello"
    readme.name = "README.md"
    readme.relative_to.return_value.as_posix.return_value = "README.md"

    async def _files(*_args, **_kwargs):
        yield readme

    indexing_service._iter_indexable_files = _files
    indexing_service.generic_chunk_file = MagicMock(return_value=[])

    with patch(
        "app.services.indexing_service.upsert_file_records",
        new_callable=AsyncMock,
        return_value=(1, [readme], []),
    ):
        with patch("app.services.indexing_service.create_snapshot", new_callable=AsyncMock):
            with patch("app.services.indexing_service.settings") as mock_settings:
                mock_settings.indexing_force_full_reindex = False
                mock_settings.indexing_incremental_enabled = True

                await indexing_service.index_repository(
                    repo_id="repo-1",
                    repository_id="repo-db-1",
                    commit_sha="local-working-copy",
                    full_reindex=False,
                )

    assert call_order == ["upsert", "cleanup"]
    indexing_service._delete_all_repository_chunks.assert_not_called()


@pytest.mark.asyncio
async def test_incremental_repair_when_chunks_missing(indexing_service):
    mock_root = MagicMock(spec=Path)
    mock_root.exists.return_value = True
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._count_repository_chunks = MagicMock(return_value=0)
    indexing_service._count_indexed_repository_files = MagicMock(return_value=3)

    readme = MagicMock(spec=Path)
    readme.exists.return_value = True
    readme.suffix = ".md"
    readme.read_text.return_value = "# Hello"
    readme.name = "README.md"
    readme.relative_to.return_value.as_posix.return_value = "README.md"

    indexing_service._resolve_repair_file_list = MagicMock(return_value=[readme])
    indexing_service._assign_repository_ids_and_chunk_ids = MagicMock()
    indexing_service._apply_post_index_cleanup = AsyncMock()

    async def _files(*_args, **_kwargs):
        yield readme

    indexing_service._iter_indexable_files = _files
    indexing_service.generic_chunk_file = MagicMock(
        return_value=[
            MagicMock(id="chunk-1", content="hello", path="README.md"),
        ]
    )

    async def _upsert(chunks):
        return None

    indexing_service._upsert_chunks = _upsert

    with patch("app.services.indexing_service.chunk_with_tree_sitter", return_value=[]):
        with patch("app.services.indexing_service.chunk_python_file", return_value=[]):
            with patch(
                "app.services.indexing_service.upsert_file_records",
                new_callable=AsyncMock,
                return_value=(1, [], []),
            ):
                with patch("app.services.indexing_service.create_snapshot", new_callable=AsyncMock):
                    with patch("app.services.indexing_service.settings") as mock_settings:
                        mock_settings.indexing_force_full_reindex = False
                        mock_settings.indexing_incremental_enabled = True

                        result = await indexing_service.index_repository(
                            repo_id="repo-1",
                            repository_id="repo-db-1",
                            commit_sha="local-working-copy",
                            full_reindex=False,
                        )

    assert result == 1
    indexing_service._resolve_repair_file_list.assert_called_once()
    indexing_service._apply_post_index_cleanup.assert_called_once()


@pytest.mark.asyncio
async def test_empty_chunk_result_skips_cleanup(indexing_service):
    mock_root = MagicMock(spec=Path)
    mock_root.exists.return_value = True
    indexing_service._resolve_repo_root = AsyncMock(return_value=mock_root)
    indexing_service._load_gitignore_spec = MagicMock()
    indexing_service._update_progress = AsyncMock()
    indexing_service._assign_repository_ids_and_chunk_ids = MagicMock()
    indexing_service._apply_post_index_cleanup = AsyncMock()
    indexing_service._delete_all_repository_chunks = AsyncMock()

    readme = MagicMock(spec=Path)
    readme.exists.return_value = True
    readme.suffix = ".md"
    readme.read_text.return_value = "# Hello"
    readme.name = "README.md"
    readme.relative_to.return_value.as_posix.return_value = "README.md"

    async def _files(*_args, **_kwargs):
        yield readme

    indexing_service._iter_indexable_files = _files
    indexing_service.generic_chunk_file = MagicMock(return_value=[])
    indexing_service._upsert_chunks = AsyncMock()

    with patch("app.services.indexing_service.chunk_with_tree_sitter", return_value=[]):
        with patch("app.services.indexing_service.chunk_python_file", return_value=[]):
            with patch(
                "app.services.indexing_service.upsert_file_records",
                new_callable=AsyncMock,
                return_value=(1, [readme], []),
            ):
                with patch("app.services.indexing_service.create_snapshot", new_callable=AsyncMock):
                    with patch("app.services.indexing_service.settings") as mock_settings:
                        mock_settings.indexing_force_full_reindex = False
                        mock_settings.indexing_incremental_enabled = True

                        result = await indexing_service.index_repository(
                            repo_id="repo-1",
                            repository_id="repo-db-1",
                            commit_sha="local-working-copy",
                            full_reindex=False,
                        )

    assert result == 0
    indexing_service._apply_post_index_cleanup.assert_not_called()
    indexing_service._delete_all_repository_chunks.assert_not_called()
