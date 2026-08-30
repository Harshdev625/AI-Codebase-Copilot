from __future__ import annotations

import subprocess
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

from app.models.domain_models import CodeChunk
from app.core.config import settings
from app.rag.embeddings.provider import validate_embedding_dimension
from app.rag.retrieval.hybrid import _to_vector_literal, reciprocal_rank_fusion
from app.services.indexing_service import IndexingService
from app.tools.file_tools import read_file


class _Response:
    def __init__(self, payload: dict | None = None, should_raise: Exception | None = None) -> None:
        self._payload = payload or {}
        self._should_raise = should_raise

    def raise_for_status(self) -> None:
        if self._should_raise is not None:
            raise self._should_raise

    def json(self) -> dict:
        return self._payload


class _MappingsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def mappings(self):
        return self

    def __iter__(self):
        return iter(self._rows)


class _Session:
    def __init__(self, rows=None, fail_on_execute: bool = False, fail_on_commit: bool = False):
        self.rows = rows or []
        self.fail_on_execute = fail_on_execute
        self.fail_on_commit = fail_on_commit
        self.execute_calls = 0
        self.commits = 0
        self.rollbacks = 0

    def execute(self, *_args, **_kwargs):
        self.execute_calls += 1
        if self.fail_on_execute:
            raise RuntimeError("execute failed")
        return _MappingsResult(self.rows)

    def commit(self):
        self.commits += 1
        if self.fail_on_commit:
            raise RuntimeError("commit failed")

    def rollback(self):
        self.rollbacks += 1


def test_file_tools_read_file_limits_content(tmp_path: Path) -> None:
    file_path = tmp_path / "demo.txt"
    file_path.write_text("abcdef", encoding="utf-8")
    assert read_file(str(file_path), max_chars=3) == "abc"


def test_embedding_provider_validation() -> None:
    validate_embedding_dimension([0.1] * settings.vector_dim)
    with pytest.raises(ValueError, match="Embedding dimension mismatch"):
        validate_embedding_dimension([0.1] * 3)


def test_ollama_embedding_provider_success_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.embeddings.ollama_provider as module

    class _FakeClient:
        def __init__(self, response):
            self._response = response

        def post(self, *_args, **_kwargs):
            return self._response

    monkeypatch.setattr(module, "get_http_client", lambda: _FakeClient(_Response({"embedding": [1, 2.5, 3]})))
    provider = module.OllamaEmbeddingProvider()
    provider.use_nvidia = False
    assert provider.embed_text("x") == [1.0, 2.5, 3.0]

    monkeypatch.setattr(module, "get_http_client", lambda: _FakeClient(_Response({"embedding": [4, 5]})))
    assert provider.embed_text("y") == [4.0, 5.0]


def test_ollama_embedding_provider_error_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.embeddings.ollama_provider as module

    class _FakeClient:
        def __init__(self, response):
            self._response = response

        def post(self, *_args, **_kwargs):
            return self._response

    provider = module.OllamaEmbeddingProvider()
    provider.use_nvidia = False

    connect_exc = httpx.ConnectError("no", request=httpx.Request("POST", "http://x"))
    monkeypatch.setattr(module, "get_http_client", lambda: _FakeClient(_Response(should_raise=connect_exc)))
    with pytest.raises(RuntimeError, match="Could not connect to Ollama"):
        provider.embed_text("z")

    status_exc = httpx.HTTPStatusError(
        "bad",
        request=httpx.Request("POST", "http://x"),
        response=httpx.Response(500),
    )
    monkeypatch.setattr(module, "get_http_client", lambda: _FakeClient(_Response(should_raise=status_exc)))
    with pytest.raises(RuntimeError, match="embedding request failed"):
        provider.embed_text("z")

    monkeypatch.setattr(module, "get_http_client", lambda: _FakeClient(_Response({"foo": "bar"})))
    with pytest.raises(ValueError, match="did not include an embedding"):
        provider.embed_text("z")


def test_embedding_provider_factory(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.embeddings.provider as provider_module

    class Dummy:
        pass

    # get_embedding_provider is decorated with @lru_cache, so we must
    # clear the cached instance before the monkeypatched constructor
    # can take effect.
    provider_module.get_embedding_provider.cache_clear()
    monkeypatch.setattr(provider_module, "OllamaEmbeddingProvider", lambda: Dummy())
    assert isinstance(provider_module.get_embedding_provider(), Dummy)
    # Clean up so other tests get a fresh provider
    provider_module.get_embedding_provider.cache_clear()


def test_hybrid_utilities_and_dense_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.retrieval.hybrid as hybrid

    assert reciprocal_rank_fusion([["a", "b"], ["b", "c"]])[:2] == ["b", "a"]
    assert _to_vector_literal([1, 2.345678912]) == "[1.00000000,2.34567891]"

    class Embedder:
        def embed_text(self, text: str) -> list[float]:
            return [0.1] * settings.vector_dim

    monkeypatch.setattr(hybrid, "get_embedding_provider", lambda: Embedder())

    session = _Session(rows=[{"id": "1", "path": "a.py", "symbol": "f", "content": "x", "score": 0.9}])
    embedding = [0.1] * settings.vector_dim
    out = hybrid._dense_search_postgres_with_embedding(session, "r", embedding, top_k=1)
    assert out[0]["id"] == "1"

    class Qdrant:
        def search(self, vector: list[float], repository_id: str, limit: int, patch_id: str | None = None):
            _ = (vector, repository_id, limit, patch_id)
            return [{"id": "1", "score": 0.8}]

    monkeypatch.setattr(hybrid, "QdrantService", lambda: Qdrant())
    out_dense = hybrid.dense_search(session, "r", "q", top_k=1)
    assert out_dense[0]["id"] == "1"


def test_hybrid_dense_fallback_and_lexical_and_merge(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.retrieval.hybrid as hybrid

    class Embedder:
        def embed_text(self, text: str) -> list[float]:
            return [0.1] * settings.vector_dim

    monkeypatch.setattr(hybrid, "get_embedding_provider", lambda: Embedder())

    class BrokenQdrant:
        def search(self, vector: list[float], repository_id: str, limit: int):
            _ = repository_id
            raise RuntimeError("qdrant down")

    monkeypatch.setattr(hybrid, "QdrantService", lambda: BrokenQdrant())
    monkeypatch.setattr(
        hybrid,
        "_dense_search_postgres_with_embedding",
        lambda session, repository_id, embedding, top_k=20: [{"id": "d1", "path": "a", "symbol": "s", "content": "c", "score": 0.7}],
    )

    session = _Session(rows=[{"id": "l1", "path": "b", "symbol": "s", "content": "c", "score": 0.5}])

    lexical = hybrid.lexical_search(session, "r", "q", top_k=1)
    assert lexical[0]["id"] == "l1"

    monkeypatch.setattr(
        hybrid,
        "dense_search",
        lambda *_args, **_kwargs: [{"id": "d1", "path": "a", "symbol": "s", "content": "c", "score": 0.7}],
    )
    monkeypatch.setattr(
        hybrid,
        "lexical_search",
        lambda *_args, **_kwargs: [{"id": "l1", "path": "b", "symbol": "s", "content": "c", "score": 0.5}],
    )
    merged = hybrid.hybrid_retrieve(_Session(), "r", "q", top_k=2)
    assert {item["id"] for item in merged} == {"d1", "l1"}


def test_hybrid_dense_returns_empty_when_embedding_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.retrieval.hybrid as hybrid

    class BrokenEmbedder:
        def embed_text(self, text: str) -> list[float]:
            raise RuntimeError("ollama unavailable")

    monkeypatch.setattr(hybrid, "get_embedding_provider", lambda: BrokenEmbedder())
    assert hybrid.dense_search(_Session(), "r", "q") == []



