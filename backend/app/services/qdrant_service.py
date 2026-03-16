from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


class QdrantService:
    def __init__(self) -> None:
        self.base_url = settings.qdrant_url.rstrip("/")
        self.collection = settings.qdrant_collection
        self.timeout = settings.ollama_timeout_seconds

    def ensure_collection(self) -> None:
        payload = {
            "vectors": {
                "size": settings.vector_dim,
                "distance": "Cosine",
            }
        }
        try:
            response = httpx.put(
                f"{self.base_url}/collections/{self.collection}",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Failed to ensure Qdrant collection: {exc}") from exc

    def upsert_points(self, points: list[dict[str, Any]]) -> None:
        if not points:
            return
        payload = {"points": points}
        try:
            response = httpx.put(
                f"{self.base_url}/collections/{self.collection}/points",
                json=payload,
                timeout=max(self.timeout, 120.0),
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Failed to upsert vectors into Qdrant: {exc}") from exc

    def search(self, vector: list[float], repo_id: str, limit: int) -> list[dict[str, Any]]:
        payload = {
            "vector": vector,
            "limit": limit,
            "with_payload": True,
            "filter": {
                "must": [
                    {
                        "key": "repo_id",
                        "match": {"value": repo_id},
                    }
                ]
            },
        }
        try:
            response = httpx.post(
                f"{self.base_url}/collections/{self.collection}/points/search",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Failed to search Qdrant: {exc}") from exc

        body = response.json()
        return list(body.get("result", []))