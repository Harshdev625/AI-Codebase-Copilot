from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.core.http_client import get_http_client


class QdrantService:
    def __init__(self) -> None:
        self.base_url = settings.qdrant_url.rstrip("/")
        self.collection = settings.qdrant_collection
        self.timeout = settings.qdrant_timeout_seconds

    def ensure_collection(self) -> None:
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
                return
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Failed to ensure Qdrant collection: {exc}") from exc

    def upsert_points(self, points: list[dict[str, Any]]) -> None:
        if not points:
            return
        payload = {"points": points}
        try:
            response = get_http_client().put(
                f"{self.base_url}/collections/{self.collection}/points",
                json=payload,
                timeout=max(self.timeout, 120.0),
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Failed to upsert vectors into Qdrant: {exc}") from exc

    def search(self, vector: list[float], repository_id: str, limit: int) -> list[dict[str, Any]]:
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
            raise RuntimeError(f"Failed to search Qdrant: {exc}") from exc

        body = response.json()
        return list(body.get("result", []))