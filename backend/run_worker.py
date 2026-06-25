from __future__ import annotations

import logging

from rq import Worker

from app.core.config import settings
from app.queues.indexing_queue import get_indexing_queue, get_redis_connection


logging.basicConfig(
    level=getattr(logging, str(settings.log_level).upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


import sys
from rq import Worker, SimpleWorker

if __name__ == "__main__":
    redis_connection = get_redis_connection()
    queue = get_indexing_queue()
    logger.info("index_worker - listening queue=%s", settings.indexing_queue_name)
    worker_class = SimpleWorker if sys.platform == "win32" else Worker
    worker_class([queue], connection=redis_connection).work(with_scheduler=True)
