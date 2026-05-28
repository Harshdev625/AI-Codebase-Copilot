import logging
from abc import ABC, abstractmethod
import hashlib
from functools import lru_cache

from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.rag.embeddings.ollama_provider import OllamaEmbeddingProvider
from app.services.cache_service import get_cache_service


logger = logging.getLogger(__name__)


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed_text(self, text: str) -> list[float]:
        raise NotImplementedError


def validate_embedding_dimension(embedding: list[float]) -> None:
    expected_dim = settings.vector_dim
    actual_dim = len(embedding)
    if actual_dim != expected_dim:
        logger.error("embedding_validation - dimension mismatch actual=%s expected=%s", actual_dim, expected_dim)
        raise ValueError(
            f"Embedding dimension mismatch: got {actual_dim}, expected VECTOR_DIM={expected_dim}. "
            "Update VECTOR_DIM or switch to a model with matching embedding size."
        )


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    """Return a cached singleton embedding provider instance."""
    logger.debug("embedding_provider - creating OllamaEmbeddingProvider singleton")
    return OllamaEmbeddingProvider()


def embed_text_cached(text: str) -> list[float]:
    normalized = " ".join(text.split())
    text_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
    cache_key = f"emb:v1:{settings.ollama_embedding_model}:{text_hash}"

    cache = get_cache_service()
    try:
        cached = cache.get_json(cache_key)
    except ExternalServiceError as exc:
        logger.warning("embedding_cache - read failed key=%s error=%s", cache_key, exc)
        cached = None
    if cached and isinstance(cached.get("vector"), list):
        vector = [float(value) for value in cached["vector"]]
        validate_embedding_dimension(vector)
        return vector

    try:
        vector = get_embedding_provider().embed_text(text)
    except Exception as exc:
        logger.exception("embedding_provider - request failed")
        raise ExternalServiceError(service_name="Ollama", underlying_error=str(exc)) from exc
    validate_embedding_dimension(vector)
    try:
        cache.set_json(cache_key, {"vector": vector}, ttl_seconds=3600)
    except ExternalServiceError as exc:
        logger.warning("embedding_cache - write failed key=%s error=%s", cache_key, exc)
    return vector


def embed_texts_cached(texts: list[str]) -> list[list[float]]:
    return [embed_text_cached(text) for text in texts]
