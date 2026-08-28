from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.http_client import get_http_client


logger = logging.getLogger(__name__)


def _response_excerpt(response: httpx.Response | None, limit: int = 800) -> str:
    if response is None:
        return ""
    try:
        text = response.text or ""
    except Exception:
        return "<unreadable>"
    text = text.strip().replace("\n", " ")
    return text[:limit]


class OllamaEmbeddingProvider:
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_embedding_model
        self.use_nvidia = settings.use_nvidia_api
        self.nvidia_key = settings.nvidia_api_key
        self.nvidia_model = settings.nvidia_embedding_model
        self.timeout = settings.ollama_embedding_timeout_seconds

    def embed_text(self, text: str) -> list[float]:
        if self.use_nvidia and self.nvidia_key:
            return self._embed_nvidia(text)
        return self._embed_ollama(text)

    def _embed_nvidia(self, text: str) -> list[float]:
        """Embed text via the NVIDIA NIM embeddings API."""
        logger.debug(
            "nvidia_embed - request model=%s text_chars=%s",
            self.nvidia_model,
            len(text),
        )
        try:
            response = get_http_client().post(
                "https://integrate.api.nvidia.com/v1/embeddings",
                headers={"Authorization": f"Bearer {self.nvidia_key}"},
                json={
                    "input": [text],
                    "model": self.nvidia_model,
                    "input_type": "passage",
                    "encoding_format": "float",
                    "truncate": "END",
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.ConnectError as exc:
            logger.exception("nvidia_embed - connection failed")
            raise RuntimeError("Could not connect to the NVIDIA NIM API.") from exc
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code if exc.response else None
            body_excerpt = _response_excerpt(exc.response)
            logger.warning(
                "nvidia_embed - http failure model=%s status=%s body_excerpt=%s",
                self.nvidia_model,
                status,
                body_excerpt,
            )
            raise RuntimeError(
                f"NVIDIA embedding request failed (status {status}): {body_excerpt or 'no response body'}"
            ) from exc
        except httpx.RequestError as exc:
            logger.exception("nvidia_embed - request failed model=%s", self.nvidia_model)
            raise RuntimeError(f"NVIDIA embedding request failed: {exc}") from exc

        try:
            payload: dict[str, Any] = response.json()
        except ValueError as exc:
            body_excerpt = _response_excerpt(response)
            logger.error(
                "nvidia_embed - invalid json model=%s status=%s body_excerpt=%s",
                self.nvidia_model,
                response.status_code,
                body_excerpt,
            )
            raise ValueError("NVIDIA response did not contain valid JSON") from exc

        data = payload.get("data")
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict) and isinstance(first.get("embedding"), list):
                vector = [float(value) for value in first["embedding"]]
                logger.debug("nvidia_embed - response vector_dim=%s", len(vector))
                return vector

        logger.error("nvidia_embed - malformed response keys=%s", sorted(payload.keys()))
        raise ValueError("NVIDIA response did not include an embedding vector")

    def _embed_ollama(self, text: str) -> list[float]:
        # Truncate to the embedding model's context window. mxbai-embed-large
        # (512 tokens) rejects oversized inputs with a 500 error. A conservative
        # character budget avoids that while preserving the most relevant prefix.
        max_chars = settings.ollama_embedding_max_chars
        if max_chars > 0 and len(text) > max_chars:
            logger.warning(
                "ollama_embed - truncating input model=%s original_chars=%s max_chars=%s",
                self.model,
                len(text),
                max_chars,
            )
            text = text[:max_chars]

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
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code if exc.response else None
            body_excerpt = _response_excerpt(exc.response)
            logger.warning(
                "ollama_embed - http failure model=%s status=%s body_excerpt=%s",
                self.model,
                status,
                body_excerpt,
            )
            raise RuntimeError(
                f"Ollama embedding request failed (status {status}): {body_excerpt or 'no response body'}"
            ) from exc
        except httpx.RequestError as exc:
            logger.exception("ollama_embed - request failed model=%s base_url=%s", self.model, self.base_url)
            raise RuntimeError(f"Ollama embedding request failed: {exc}") from exc

        try:
            payload: dict[str, Any] = response.json()
        except ValueError as exc:
            body_excerpt = _response_excerpt(response)
            logger.error(
                "ollama_embed - invalid json model=%s status=%s body_excerpt=%s",
                self.model,
                response.status_code,
                body_excerpt,
            )
            raise ValueError("Ollama response did not contain valid JSON") from exc

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