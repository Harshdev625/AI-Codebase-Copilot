from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.http_client import get_http_client


logger = logging.getLogger(__name__)


class OllamaEmbeddingProvider:
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_embedding_model
        self.timeout = settings.ollama_timeout_seconds

    def embed_text(self, text: str) -> list[float]:
        logger.debug("ollama_embed - request model=%s text_chars=%s", self.model, len(text))
        try:
            response = get_http_client().post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.ConnectError as exc:
            logger.exception("ollama_embed - connection failed base_url=%s", self.base_url)
            raise RuntimeError(
                f"Could not connect to Ollama at {self.base_url}. "
                "Ensure Ollama is running and accessible."
            ) from exc
        except httpx.HTTPError as exc:
            logger.exception("ollama_embed - request failed model=%s", self.model)
            raise RuntimeError(f"Ollama embedding request failed: {exc}") from exc

        payload: dict[str, Any] = response.json()

        if isinstance(payload.get("embedding"), list):
            vector = [float(value) for value in payload["embedding"]]
            logger.debug("ollama_embed - response vector_dim=%s", len(vector))
            return vector

        if isinstance(payload.get("embeddings"), list) and payload["embeddings"]:
            first = payload["embeddings"][0]
            if isinstance(first, list):
                vector = [float(value) for value in first]
                logger.debug("ollama_embed - response vector_dim=%s", len(vector))
                return vector

        logger.error("ollama_embed - malformed response keys=%s", sorted(payload.keys()))
        raise ValueError("Ollama response did not include an embedding vector")