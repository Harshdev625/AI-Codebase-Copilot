from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import redis
from rq import Queue, Retry

from app.core.config import settings


logger = logging.getLogger(__name__)


@lru_cache
def get_redis_connection() -> redis.Redis:
    logger.info("index_queue - connecting redis dsn=%s", settings.redis_dsn)
    return redis.Redis.from_url(settings.redis_dsn)


@lru_cache
def get_indexing_queue() -> Queue:
    return Queue(settings.indexing_queue_name, connection=get_redis_connection())


def enqueue_indexing_job(**job_kwargs: Any):
    retry: Retry | None = None
    if settings.indexing_worker_max_retries > 0:
        retry = Retry(
            max=settings.indexing_worker_max_retries,
            interval=settings.indexing_worker_retry_intervals,
        )

    queue = get_indexing_queue()
    return queue.enqueue(
        "app.workers.indexing_worker.run_indexing_job",
        kwargs=job_kwargs,
        job_id=job_kwargs.get("indexing_job_id"),
        job_timeout=settings.indexing_worker_job_timeout_seconds,
        retry=retry,
        result_ttl=3600,
        failure_ttl=7 * 24 * 3600,
    )
