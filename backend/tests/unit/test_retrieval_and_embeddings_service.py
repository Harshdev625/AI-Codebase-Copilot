from __future__ import annotations

import pytest

from app.core.exceptions import DatabaseException, ExternalServiceError
import app.rag.embeddings.provider as embed_module
import app.rag.retrieval.service as retrieval_module


class _Dialect:
    name = "postgresql"


class _Bind:
    dialect = _Dialect()


class _Session:
    bind = _Bind()


def test_retrieve_repository_cache_hit(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Cache:
        def get_json(self, _key: str):
            return {"items": [{"path": "a.py", "symbol": "s", "content": "x"}]}

    monkeypatch.setattr(retrieval_module, "get_cache_service", lambda: _Cache())
    monkeypatch.setattr(retrieval_module, "hybrid_retrieve", lambda *args, **kwargs: pytest.fail("unexpected db"))

    service = retrieval_module.RetrievalService(_Session())
    results = service.retrieve_repository(repository_id="r1", query="x", top_k=5)

    assert results[0]["path"] == "a.py"


def test_retrieve_repository_cache_error_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Cache:
        def get_json(self, _key: str):
            raise ExternalServiceError("Redis", "boom")

        def set_json(self, *_args, **_kwargs):
            raise ExternalServiceError("Redis", "boom")

    monkeypatch.setattr(retrieval_module, "get_cache_service", lambda: _Cache())
    monkeypatch.setattr(
        retrieval_module,
        "hybrid_retrieve",
        lambda *args, **kwargs: [
            {
                "repository_id": "r1",
                "path": "a.py",
                "symbol": "s",
                "content": "alpha beta",
                "score": 0.9,
            }
        ],
    )

    service = retrieval_module.RetrievalService(_Session())
    results = service.retrieve_repository(repository_id="r1", query="alpha", top_k=5)

    assert results
    assert results[0]["path"] == "a.py"


def test_retrieve_repository_db_error_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Cache:
        def get_json(self, _key: str):
            return None

        def set_json(self, *_args, **_kwargs):
            return True

    monkeypatch.setattr(retrieval_module, "get_cache_service", lambda: _Cache())
    monkeypatch.setattr(retrieval_module, "hybrid_retrieve", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("db")))

    service = retrieval_module.RetrievalService(_Session())
    with pytest.raises(DatabaseException, match="retrieve repository context"):
        service.retrieve_repository(repository_id="r1", query="alpha", top_k=5)


def test_embed_text_cached_cache_failure_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Cache:
        def get_json(self, _key: str):
            raise ExternalServiceError("Redis", "boom")

        def set_json(self, *_args, **_kwargs):
            raise ExternalServiceError("Redis", "boom")

    class _Provider:
        def embed_text(self, _text: str) -> list[float]:
            return [0.1, 0.2]

    monkeypatch.setattr(embed_module, "get_cache_service", lambda: _Cache())
    monkeypatch.setattr(embed_module, "get_embedding_provider", lambda: _Provider())
    monkeypatch.setattr(embed_module.settings, "vector_dim", 2)

    vector = embed_module.embed_text_cached("hello world")
    assert vector == [0.1, 0.2]


def test_embed_text_cached_provider_error(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Cache:
        def get_json(self, _key: str):
            return None

        def set_json(self, *_args, **_kwargs):
            return True

    class _Provider:
        def embed_text(self, _text: str) -> list[float]:
            raise RuntimeError("down")

    monkeypatch.setattr(embed_module, "get_cache_service", lambda: _Cache())
    monkeypatch.setattr(embed_module, "get_embedding_provider", lambda: _Provider())
    monkeypatch.setattr(embed_module.settings, "vector_dim", 2)

    with pytest.raises(ExternalServiceError):
        embed_module.embed_text_cached("hello world")
