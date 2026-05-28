from __future__ import annotations

import asyncio
import logging

from app.api.v1.repositories.service import trigger_repository_indexing


logger = logging.getLogger(__name__)


def run_indexing_job(
    repo_id: str,
    repo_path: str | None,
    repo_url: str | None,
    repo_ref: str | None,
    commit_sha: str,
    repository_db_id: str,
    indexing_job_id: str,
    full_reindex: bool = False,
) -> None:
    logger.info(
        "index_worker - processing job_id=%s repository_id=%s",
        indexing_job_id,
        repository_db_id,
    )
    # PHASE 3: Run the async indexing task in a new event loop
    try:
        asyncio.run(
            trigger_repository_indexing(
                repo_id=repo_id,
                repo_path=repo_path,
                repo_url=repo_url,
                repo_ref=repo_ref,
                commit_sha=commit_sha,
                repository_db_id=repository_db_id,
                indexing_job_id=indexing_job_id,
                full_reindex=bool(full_reindex),
            )
        )
    except Exception as e:
        logger.exception(
            "index_worker - unhandled exception in job_id=%s repository_id=%s error=%s",
            indexing_job_id,
            repository_db_id,
            e,
        )
        # Optionally, update the job status to 'failed' here
        raise
