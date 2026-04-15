from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.http_client import get_http_client


logger = logging.getLogger(__name__)


class QdrantService:
    def __init__(self) -> None:
        self.base_url = settings.qdrant_url.rstrip("/")
        self.collection = settings.qdrant_collection
        self.timeout = settings.qdrant_timeout_seconds

    def ensure_collection(self) -> None:
        logger.debug("qdrant_ensure_collection - request collection=%s", self.collection)
        payload = {
            "vectors": {
                "size": settings.vector_dim,
                "distance": "Cosine",
            }
        }
        try:
            response = get_http_client().put(
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
            raise RuntimeError(f"Failed to ensure Qdrant collection: {exc}") from exc

    def upsert_points(self, points: list[dict[str, Any]]) -> None:
        if not points:
            return
        logger.debug("qdrant_upsert - request collection=%s points=%s", self.collection, len(points))
        payload = {"points": points}
        try:
            response = get_http_client().put(
                f"{self.base_url}/collections/{self.collection}/points",
                json=payload,
                timeout=max(self.timeout, 120.0),
            )
            response.raise_for_status()
            logger.info("qdrant_upsert - success collection=%s points=%s", self.collection, len(points))
        except httpx.HTTPError as exc:
            logger.exception("qdrant_upsert - failed collection=%s", self.collection)
            raise RuntimeError(f"Failed to upsert vectors into Qdrant: {exc}") from exc

    def delete_points_by_ids(self, point_ids: list[str]) -> None:
        if not point_ids:
            return

        chunk_size = 256
        try:
            for start in range(0, len(point_ids), chunk_size):
                batch = point_ids[start : start + chunk_size]
                response = get_http_client().post(
                    f"{self.base_url}/collections/{self.collection}/points/delete",
                    json={"points": batch},
                    timeout=self.timeout,
                )
                response.raise_for_status()
            logger.debug("qdrant_delete_points - success collection=%s points=%s", self.collection, len(point_ids))
        except httpx.HTTPError as exc:
            logger.exception("qdrant_delete_points - failed collection=%s", self.collection)
            raise RuntimeError(f"Failed to delete vectors from Qdrant: {exc}") from exc

    def delete_points_by_repository(self, repository_id: str) -> None:
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
            response = get_http_client().post(
                f"{self.base_url}/collections/{self.collection}/points/delete",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            logger.debug("qdrant_delete_repo - success collection=%s repository_id=%s", self.collection, repository_id)
        except httpx.HTTPError as exc:
            logger.exception("qdrant_delete_repo - failed repository_id=%s", repository_id)
            raise RuntimeError(f"Failed to delete repository vectors from Qdrant: {exc}") from exc

    def search(self, vector: list[float], repository_id: str, limit: int) -> list[dict[str, Any]]:
        logger.debug(
            "qdrant_search - request collection=%s repository_id=%s limit=%s",
            self.collection,
            repository_id,
            limit,
        )
        payload = {
            "vector": vector,
            "limit": limit,
            "with_payload": True,
            "filter": {
                "must": [
                    {
                        "key": "repository_id",
                        "match": {"value": repository_id},
                    }
                ]
            },
        }
        try:
            response = get_http_client().post(
                f"{self.base_url}/collections/{self.collection}/points/search",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.exception("qdrant_search - failed repository_id=%s", repository_id)
            raise RuntimeError(f"Failed to search Qdrant: {exc}") from exc

        body = response.json()
        result = list(body.get("result", []))
        logger.debug("qdrant_search - response repository_id=%s matches=%s", repository_id, len(result))
        return result