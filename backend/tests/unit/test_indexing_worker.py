"""Unit tests for the indexing worker entrypoint."""

from unittest.mock import MagicMock, patch

import pytest

from app.workers.indexing_worker import run_indexing_job


def test_run_indexing_job_delegates_to_trigger():
    mock_trigger = MagicMock()
    with patch("app.workers.indexing_worker.asyncio.run") as mock_run:
        with patch("app.workers.indexing_worker.trigger_repository_indexing", mock_trigger):
            run_indexing_job(
                repo_id="org/repo",
                repo_path=None,
                repo_url="https://github.com/org/repo.git",
                repo_ref="main",
                commit_sha="sha1",
                repository_db_id="db-1",
                indexing_job_id="job-1",
                full_reindex=True,
            )
    mock_run.assert_called_once()
    mock_trigger.assert_called_once_with(
        repo_id="org/repo",
        repo_path=None,
        repo_url="https://github.com/org/repo.git",
        repo_ref="main",
        commit_sha="sha1",
        repository_db_id="db-1",
        indexing_job_id="job-1",
        full_reindex=True,
    )


def test_run_indexing_job_reraises_on_failure():
    with patch("app.workers.indexing_worker.asyncio.run", side_effect=RuntimeError("boom")):
        with pytest.raises(RuntimeError, match="boom"):
            run_indexing_job(
                repo_id="org/repo",
                repo_path=None,
                repo_url=None,
                repo_ref=None,
                commit_sha="sha1",
                repository_db_id="db-1",
                indexing_job_id="job-1",
            )
