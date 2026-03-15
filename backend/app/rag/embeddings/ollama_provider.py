from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


class OllamaEmbeddingProvider:
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_embedding_model
        self.timeout = settings.ollama_timeout_seconds

    def embed_text(self, text: str) -> list[float]:
        try:
            response = httpx.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.ConnectError as exc:
            raise RuntimeError(
                f"Could not connect to Ollama at {self.base_url}. "
                "Ensure Ollama is running and accessible."
            ) from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Ollama embedding request failed: {exc}") from exc

        payload: dict[str, Any] = response.json()

        if isinstance(payload.get("embedding"), list):
            return [float(value) for value in payload["embedding"]]

        if isinstance(payload.get("embeddings"), list) and payload["embeddings"]:
            first = payload["embeddings"][0]
            if isinstance(first, list):
                return [float(value) for value in first]

        raise ValueError("Ollama response did not include an embedding vector")