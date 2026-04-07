import logging
from abc import ABC, abstractmethod

from app.core.config import settings
from app.rag.embeddings.ollama_provider import OllamaEmbeddingProvider


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
