from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from fastapi import BackgroundTasks

from app.api.v1.repositories.service import trigger_repository_indexing
from app.core.errors import ServiceException
from app.core.security import verify_password
from app.db.database import SessionLocal
from app.db.models import Repository
from app.services.indexing_service import IndexingService

logger = logging.getLogger(__name__)


class IndexingJobStatus:
    """Tracks the status of an indexing job."""
    
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.status = self.PENDING
        self.progress = 0.0  # 0.0 to 1.0
        self.message = ""
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None
        self.error: Optional[str] = None
        self.chunks_processed = 0
        self.chunks_total = 0
    
    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "progress": round(self.progress, 2),
            "message": self.message,
            "chunks_processed": self.chunks_processed,
            "chunks_total": self.chunks_total,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "error": self.error,
        }


# Global job status tracker (in-memory; replace with Redis/database in production)
job_statuses: dict[str, IndexingJobStatus] = {}


def get_job_status(job_id: str) -> IndexingJobStatus | None:
    """Get the status of an indexing job."""
    return job_statuses.get(job_id)


def cancel_job(job_id: str) -> bool:
    """Attempt to cancel an indexing job."""
    job = job_statuses.get(job_id)
    if job and job.status in (job.PENDING, job.IN_PROGRESS):
        job.status = job.CANCELLED
        job.message = "Job cancelled by user"
        return True
    return False


async def run_indexing_job(
    repo_id: str,
    repo_path: str | None,
    repo_url: str | None,
    repo_ref: str | None,
    commit_sha: str,
    repository_db_id: str,
    indexing_job_id: str,
    full_reindex: bool = False,
    background_tasks: BackgroundTasks | None = None,
) -> IndexingJobStatus:
    """
    Run an indexing job with status tracking and cancellation support.
    
    Args:
        repo_id: Repository ID
        repo_path: Local path to repository
        repo_url: Remote repository URL
        repo_ref: Branch/ref to index
        commit_sha: Commit SHA to index
        repository_db_id: Database repository ID
        indexing_job_id: Unique job identifier
        full_reindex: Whether to perform full reindex
        background_tasks: FastAPI BackgroundTasks for status updates
    
    Returns:
        IndexingJobStatus object with job status
    """
    # Initialize job status
    job_status = IndexingJobStatus(indexing_job_id)
    job_statuses[indexing_job_id] = job_status
    
    job_status.status = job_status.IN_PROGRESS
    job_status.started_at = time.time()
    job_status.message = "Indexing started"
    
    logger.info(
        "index_worker - starting job_id=%s repository_id=%s",
        indexing_job_id,
        repository_db_id,
    )
    
    try:
        # Trigger the indexing task
        asyncio.create_task(
            _indexing_task_with_tracking(
                job_status=job_status,
                repo_id=repo_id,
                repo_path=repo_path,
                repo_url=repo_url,
                repo_ref=repo_ref,
                commit_sha=commit_sha,
                repository_db_id=repository_db_id,
                full_reindex=full_reindex,
            )
        )
        
        # If background_tasks provided, schedule status update
        if background_tasks:
            background_tasks.add_task(_monitor_job_status, job_status)
        
        return job_status
    
    except Exception as e:
        job_status.status = job_status.FAILED
        job_status.error = str(e)
        job_status.completed_at = time.time()
        logger.exception("index_worker - job failed job_id=%s", indexing_job_id)
        raise ServiceException(f"Indexing job failed: {e}")


async def _indexing_task_with_tracking(
    job_status: IndexingJobStatus,
    repo_id: str,
    repo_path: str | None,
    repo_url: str | None,
    repo_ref: str | None,
    commit_sha: str,
    repository_db_id: str,
    full_reindex: bool,
) -> None:
    """Internal indexing task with status tracking."""
    try:
        from app.services.indexing_service import IndexingService
        
        indexing_service = IndexingService()
        
        # Get repository info
        repo = await indexing_service.get_repository(repo_id) if hasattr(indexing_service, 'get_repository') else None
        
        # Count total files for progress tracking
        total_files = 0
        if repo_path:
            import os
            for root, dirs, files in os.walk(repo_path):
                # Skip generated directories
                dirs[:] = [d for d in dirs if d not in ('__pycache__', '.git', 'node_modules', 'dist', 'build')]
                total_files += len(files)
        
        job_status.chunks_total = total_files or 1  # Avoid division by zero
        
        # Run the actual indexing
        await trigger_repository_indexing(
            repo_id=repo_id,
            repo_path=repo_path,
            repo_url=repo_url,
            repo_ref=repo_ref,
            commit_sha=commit_sha,
            repository_db_id=repository_db_id,
            indexing_job_id=indexing_job_id,
            full_reindex=full_reindex,
        )
        
        # Mark as completed
        job_status.status = job_status.COMPLETED
        job_status.progress = 1.0
        job_status.message = "Indexing completed successfully"
        job_status.chunks_processed = job_status.chunks_total
        job_status.completed_at = time.time()
        
        logger.info(
            "index_worker - job completed job_id=%s chunks=%s",
            indexing_job_id,
            job_status.chunks_processed,
        )
    
    except asyncio.CancelledError:
        job_status.status = job_status.CANCELLED
        job_status.message = "Job cancelled"
        job_status.error = "Job was cancelled"
        job_status.completed_at = time.time()
        logger.warning("index_worker - job cancelled job_id=%s", indexing_job_id)
        raise
    
    except Exception as e:
        job_status.status = job_status.FAILED
        job_status.error = str(e)
        job_status.progress = min(job_status.progress + 0.5, 1.0)
        job_status.message = f"Indexing failed: {str(e)[:100]}"
        job_status.completed_at = time.time()
        logger.exception(
            "index_worker - job failed job_id=%s error=%s",
            indexing_job_id,
            e,
        )


async def _monitor_job_status(job_status: IndexingJobStatus) -> None:
    """Monitor job status and update periodically."""
    while job_status.status in (job_status.PENDING, job_status.IN_PROGRESS):
        await asyncio.sleep(1.0)
        # In a real implementation, this would update a database or Redis
        # For now, just log the current status
        if job_status.status == job_status.IN_PROGRESS:
            logger.debug(
                "index_worker - job monitoring job_id=%s progress=%.2f%%",
                job_status.job_id,
                job_status.progress * 100,
            )