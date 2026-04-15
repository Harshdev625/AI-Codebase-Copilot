from __future__ import annotations

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
    snapshot_id: str,
    indexing_job_id: str,
    full_reindex: bool = False,
) -> None:
    logger.info(
        "index_worker - processing job_id=%s repository_id=%s snapshot_id=%s",
        indexing_job_id,
        repository_db_id,
        snapshot_id,
    )
    trigger_repository_indexing(
        repo_id=repo_id,
        repo_path=repo_path,
        repo_url=repo_url,
        repo_ref=repo_ref,
        commit_sha=commit_sha,
        repository_db_id=repository_db_id,
        snapshot_id=snapshot_id,
        indexing_job_id=indexing_job_id,
        full_reindex=bool(full_reindex),
    )
