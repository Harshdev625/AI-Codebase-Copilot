import logging
from abc import ABC, abstractmethod
import hashlib

from app.core.config import settings
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


def get_embedding_provider() -> EmbeddingProvider:
    logger.debug("embedding_provider - using OllamaEmbeddingProvider")
    return OllamaEmbeddingProvider()


def embed_text_cached(text: str) -> list[float]:
    normalized = " ".join(text.split())
    text_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
    cache_key = f"emb:v1:{settings.ollama_embedding_model}:{text_hash}"

    cache = get_cache_service()
    cached = cache.get_json(cache_key)
    if cached and isinstance(cached.get("vector"), list):
        vector = [float(value) for value in cached["vector"]]
        validate_embedding_dimension(vector)
        return vector

    vector = get_embedding_provider().embed_text(text)
    validate_embedding_dimension(vector)
    cache.set_json(cache_key, {"vector": vector}, ttl_seconds=3600)
    return vector


def embed_texts_cached(texts: list[str]) -> list[list[float]]:
    return [embed_text_cached(text) for text in texts]
