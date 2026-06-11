from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import CircuitBreakerOpen, ExternalServiceError
from app.core.http_client import get_http_client
from app.core.resilience import get_circuit_breaker, retry


logger = logging.getLogger(__name__)

# PHASE 1 FIX: Circuit breaker for Qdrant — now works with sync methods
qdrant_circuit_breaker = get_circuit_breaker("qdrant")


class QdrantService:
    """Qdrant vector store service.

    PHASE 1 FIX: All methods are now **synchronous** to match:
    - The sync ``httpx.Client`` returned by ``get_http_client()``
    - The sync call-sites in ``hybrid.py``, ``retrieval.py`` graph nodes,
      and ``indexing_service.py``

    Previously every method was ``async def`` (due to ``@retry`` / circuit
    breaker decorators that always wrapped with ``async def``), but was called
    without ``await`` from synchronous code — producing the critical
    ``TypeError: 'coroutine' object is not iterable``.
    """

    def __init__(self) -> None:
        self.base_url = settings.qdrant_url.rstrip("/")
        self.collection = settings.qdrant_collection
        self.timeout = settings.qdrant_timeout_seconds

    @retry(retryable_exceptions=(httpx.HTTPStatusError, httpx.TimeoutException))
    @qdrant_circuit_breaker
    def ensure_collection(self) -> None:
        """Create the Qdrant collection if it does not already exist."""
        logger.debug("qdrant_ensure_collection - request collection=%s", self.collection)
        payload = {
            "vectors": {
                "size": settings.vector_dim,
                "distance": "Cosine",
            }
        }
        try:
            client = get_http_client()
            response = client.put(
                f"{self.base_url}/collections/{self.collection}",
                json=payload,
                timeout=self.timeout,
            )
            # Qdrant returns 409 when the collection already exists.
            if response.status_code == 409:
                logger.debug("qdrant_ensure_collection - already exists collection=%s", self.collection)
                return
            response.raise_for_status()
            logger.info("qdrant_ensure_collection - success collection=%s", self.collection)
        except httpx.HTTPError as exc:
            logger.exception("qdrant_ensure_collection - failed collection=%s", self.collection)
            raise ExternalServiceError(service_name="Qdrant", underlying_error=str(exc)) from exc

    @retry(retryable_exceptions=(httpx.HTTPStatusError, httpx.TimeoutException))
    @qdrant_circuit_breaker
    def upsert_points(self, points: list[dict[str, Any]]) -> None:
        """Upsert embedding points into the Qdrant collection."""
        if not points:
            return
        logger.debug("qdrant_upsert - request collection=%s points=%s", self.collection, len(points))
        payload = {"points": points}
        try:
            client = get_http_client()
            response = client.put(
                f"{self.base_url}/collections/{self.collection}/points",
                json=payload,
                timeout=max(self.timeout, 120.0),
            )
            response.raise_for_status()
            logger.info("qdrant_upsert - success collection=%s points=%s", self.collection, len(points))
        except httpx.HTTPError as exc:
            logger.exception("qdrant_upsert - failed collection=%s", self.collection)
            raise ExternalServiceError(service_name="Qdrant", underlying_error=str(exc)) from exc

    @retry(retryable_exceptions=(httpx.HTTPStatusError, httpx.TimeoutException))
    @qdrant_circuit_breaker
    def delete_points_by_ids(self, point_ids: list[str]) -> None:
        """Delete specific points from Qdrant by their IDs."""
        if not point_ids:
            return

        chunk_size = 256
        try:
            client = get_http_client()
            for start in range(0, len(point_ids), chunk_size):
                batch = point_ids[start : start + chunk_size]
                response = client.post(
                    f"{self.base_url}/collections/{self.collection}/points/delete",
                    json={"points": batch},
                    timeout=self.timeout,
                )
                response.raise_for_status()
            logger.debug("qdrant_delete_points - success collection=%s points=%s", self.collection, len(point_ids))
        except httpx.HTTPError as exc:
            logger.exception("qdrant_delete_points - failed collection=%s", self.collection)
            raise ExternalServiceError(service_name="Qdrant", underlying_error=str(exc)) from exc

    @retry(retryable_exceptions=(httpx.HTTPStatusError, httpx.TimeoutException))
    @qdrant_circuit_breaker
    def delete_points_by_repository(self, repository_id: str) -> None:
        """Delete all points for a repository from Qdrant using a filter."""
        payload = {
            "filter": {
                "must": [
                    {
                        "key": "repository_id",
                        "match": {"value": repository_id},
                    }
                ]
            }
        }
        try:
            client = get_http_client()
            response = client.post(
                f"{self.base_url}/collections/{self.collection}/points/delete",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            logger.debug("qdrant_delete_repo - success collection=%s repository_id=%s", self.collection, repository_id)
        except httpx.HTTPError as exc:
            logger.exception("qdrant_delete_repo - failed repository_id=%s", repository_id)
            raise ExternalServiceError(service_name="Qdrant", underlying_error=str(exc)) from exc

    @retry(retryable_exceptions=(httpx.HTTPStatusError, httpx.TimeoutException))
    @qdrant_circuit_breaker
    def delete_points_by_patch(self, patch_id: str) -> None:
        """Delete all points for a patch from Qdrant using a filter."""
        payload = {
            "filter": {
                "must": [
                    {
                        "key": "patch_id",
                        "match": {"value": patch_id},
                    }
                ]
            }
        }
        try:
            client = get_http_client()
            response = client.post(
                f"{self.base_url}/collections/{self.collection}/points/delete",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            logger.debug("qdrant_delete_patch - success collection=%s patch_id=%s", self.collection, patch_id)
        except httpx.HTTPError as exc:
            logger.exception("qdrant_delete_patch - failed patch_id=%s", patch_id)
            raise ExternalServiceError(service_name="Qdrant", underlying_error=str(exc)) from exc

    @retry(retryable_exceptions=(httpx.HTTPStatusError, httpx.TimeoutException))
    @qdrant_circuit_breaker
    def search(self, vector: list[float], repository_id: str, limit: int, patch_id: str | None = None) -> list[dict[str, Any]]:
        """Search for similar vectors in Qdrant.

        PHASE 1 FIX: Now synchronous.  Previously ``async def`` which caused
        ``TypeError: 'coroutine' object is not iterable`` when called from
        the synchronous ``dense_search()`` in ``hybrid.py``.
        """
        logger.debug(
            "qdrant_search - request collection=%s repository_id=%s limit=%s patch_id=%s",
            self.collection,
            repository_id,
            limit,
            patch_id,
        )
        
        must_filters = []
        must_not_filters = []
        
        if repository_id:
            must_filters.append({
                "key": "repository_id",
                "match": {"value": repository_id},
            })
            
        if patch_id:
            must_filters.append({
                "key": "patch_id",
                "match": {"value": patch_id},
            })
            must_filters.append({
                "key": "is_patch",
                "match": {"value": True},
            })
        else:
            must_not_filters.append({
                "key": "is_patch",
                "match": {"value": True},
            })
            
        filter_payload = {}
        if must_filters:
            filter_payload["must"] = must_filters
        if must_not_filters:
            filter_payload["must_not"] = must_not_filters

        payload = {
            "vector": vector,
            "limit": limit,
            "with_payload": True,
            "filter": filter_payload,
        }
        try:
            client = get_http_client()
            response = client.post(
                f"{self.base_url}/collections/{self.collection}/points/search",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.exception("qdrant_search - failed repository_id=%s", repository_id)
            raise ExternalServiceError(service_name="Qdrant", underlying_error=str(exc)) from exc

        body = response.json()
        result = list(body.get("result", []))
        logger.debug("qdrant_search - response repository_id=%s matches=%s", repository_id, len(result))
        return result