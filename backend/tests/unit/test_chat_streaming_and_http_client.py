from __future__ import annotations

import json

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_http_client_singleton_and_safe_close() -> None:
    from app.core.http_client import _safe_close_client, get_http_client

    client1 = get_http_client()
    client2 = get_http_client()
    assert client1 is client2
    assert isinstance(client1, httpx.Client)

    # Ensure close helper never raises.
    _safe_close_client(httpx.Client())


def test_common_build_context_and_llm_try(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.graph.nodes.common as common

    snippets = [
        {"path": "a.py", "symbol": "fn", "content": "def fn(): pass"},
        {"path": "b.py", "symbol": None, "content": "x = 1"},
    ]

    ctx = common.build_context(snippets, limit=2, max_chars=10_000)
    assert "File: a.py" in ctx
    assert "File: b.py" in ctx

    truncated = common.build_context(snippets, limit=2, max_chars=5)
    assert len(truncated) == 5

    class _Router:
        def chat(self, prompt: str, context: str = "") -> str:
            return " ok "

    monkeypatch.setattr(common, "get_model_router", lambda: _Router())
    assert common.llm_try("q", context="c") == "ok"

    class _FailingRouter:
        def chat(self, prompt: str, context: str = "") -> str:
            raise RuntimeError("down")

    monkeypatch.setattr(common, "get_model_router", lambda: _FailingRouter())
    assert common.llm_try("q") == ""


def _make_chat_test_app(monkeypatch: pytest.MonkeyPatch, fake_query_service_cls) -> TestClient:
    import app.api.v1.chat as chat_module

    app = FastAPI()
    app.include_router(chat_module.router, prefix="/v1")

    # Avoid auth + real DB usage.
    app.dependency_overrides[chat_module.get_current_user] = lambda: {"id": "u1"}

    def _override_db_session():
        yield object()

    app.dependency_overrides[chat_module.get_db_session] = _override_db_session

    monkeypatch.setattr(chat_module, "ensure_repository_access", lambda *_args, **_kwargs: {"id": "r1"})
    monkeypatch.setattr(chat_module, "QueryService", fake_query_service_cls)

    return TestClient(app)


def test_chat_stream_from_cache_emits_start_chunk_done(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeQueryService:
        def __init__(self, session):
            self.session = session

        def prepare_generation(self, repository_id: str, repo_id: str, query: str):
            _ = repository_id
            return (
                {
                    "answer": "cached-answer",
                    "intent": "explain",
                    "retrieved_context": [{"path": "x"}],
                },
                "",
                "k",
                True,
            )

        def finalize_result(self, *_args, **_kwargs):
            raise AssertionError("should not finalize cached results")

        @property
        def model_router(self):
            raise AssertionError("should not call model router for cache hit")

    client = _make_chat_test_app(monkeypatch, FakeQueryService)
    resp = client.post("/v1/chat/stream", json={"repo_id": "repo", "query": "hey"})
    assert resp.status_code == 200

    events = [json.loads(line) for line in resp.text.splitlines() if line.strip()]
    assert events[0]["data"]["type"] == "start"
    assert any(e["data"].get("type") == "chunk" for e in events)
    assert events[-1]["data"]["type"] == "done"


def test_chat_stream_non_cached_streams_and_finalizes(monkeypatch: pytest.MonkeyPatch) -> None:
    finalized = {"called": 0}

    class FakeModelRouter:
        def stream_chat(self, prompt: str, context: str = ""):
            assert prompt == "hey"
            assert "File:" in context
            yield "a"
            yield "b"

    class FakeQueryService:
        def __init__(self, session):
            self.session = session
            self._router = FakeModelRouter()

        def prepare_generation(self, repository_id: str, repo_id: str, query: str):
            _ = repository_id
            return (
                {
                    "intent": "explain",
                    "retrieved_context": [{"path": "a.py", "symbol": "m", "content": "x"}],
                },
                "File: a.py | Symbol: m\nx",
                "k",
                False,
            )

        def finalize_result(self, *_args, **_kwargs):
            finalized["called"] += 1
            return {}

        @property
        def model_router(self):
            return self._router

    client = _make_chat_test_app(monkeypatch, FakeQueryService)
    resp = client.post("/v1/chat/stream", json={"repo_id": "repo", "query": "hey"})
    assert resp.status_code == 200

    events = [json.loads(line) for line in resp.text.splitlines() if line.strip()]
    chunks = [e["data"]["delta"] for e in events if e["data"].get("type") == "chunk"]
    assert "".join(chunks) == "ab"
    assert events[-1]["data"]["type"] == "done"
    assert finalized["called"] == 1


def test_chat_stream_llm_failure_emits_error_event(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeModelRouter:
        def stream_chat(self, *_args, **_kwargs):
            raise RuntimeError("down")

    class FakeQueryService:
        def __init__(self, session):
            self.session = session
            self._router = FakeModelRouter()

        def prepare_generation(self, *_args, **_kwargs):
            return (
                {"intent": "explain", "retrieved_context": []},
                "context",
                "k",
                False,
            )

        def finalize_result(self, *_args, **_kwargs):
            raise AssertionError("should not finalize when LLM fails")

        @property
        def model_router(self):
            return self._router

    client = _make_chat_test_app(monkeypatch, FakeQueryService)
    resp = client.post("/v1/chat/stream", json={"repo_id": "repo", "query": "hey"})
    assert resp.status_code == 200

    events = [json.loads(line) for line in resp.text.splitlines() if line.strip()]
    assert any(e["success"] is False for e in events)


def test_chat_no_indexed_context_maps_to_409(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import main as main_module
    import app.api.v1.chat as chat_module

    class FakeQueryService:
        def __init__(self, session):
            self.session = session

        def run(self, *_args, **_kwargs):
            raise chat_module.NoIndexedContextError("index first")

    monkeypatch.setattr(main_module, "ensure_app_schema", lambda: None)
    app = main_module.create_app()

    app.dependency_overrides[chat_module.get_current_user] = lambda: {"id": "u1"}

    def _override_db_session():
        yield object()

    app.dependency_overrides[chat_module.get_db_session] = _override_db_session
    monkeypatch.setattr(chat_module, "ensure_repository_access", lambda *_args, **_kwargs: {"id": "r1"})
    monkeypatch.setattr(chat_module, "QueryService", FakeQueryService)

    client = TestClient(app)
    resp = client.post("/v1/chat", json={"repo_id": "repo", "query": "hey"})
    assert resp.status_code == 409
    body = resp.json()
    assert body["success"] is False
    assert "index" in body["error"].lower()
