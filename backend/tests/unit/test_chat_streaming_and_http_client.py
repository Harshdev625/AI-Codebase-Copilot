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
    app.include_router(chat_module.router, prefix="/v1/chat")

    # Avoid auth + real DB usage.
    app.dependency_overrides[chat_module.get_current_user] = lambda: {"id": "u1"}

    def _override_db_session():
        yield object()

    app.dependency_overrides[chat_module.get_db_session] = _override_db_session

    monkeypatch.setattr(chat_module, "ensure_repository_access", lambda *_args, **_kwargs: {"id": "r1"})
    monkeypatch.setattr(chat_module, "QueryService", fake_query_service_cls)
    monkeypatch.setattr(chat_module, "_session_usage_totals", lambda _service, _session_id: None)

    return TestClient(app)


def _pipeline_from_prepare(prepare_coro):
    async def stream_generation_pipeline(self, repository_id, repo_id, query, **kwargs):
        result, assembled_context, cache_key, from_cache = await prepare_coro(
            self, repository_id, repo_id, query, **kwargs
        )
        if not from_cache:
            for entry in result.get("run_trace", []):
                if isinstance(entry, dict):
                    yield {"type": "trace_step", "entry": entry}
            for source in list(result.get("retrieved_context") or [])[:8]:
                if isinstance(source, dict):
                    yield {"type": "source", "source": source}
        yield {
            "type": "complete",
            "result": result,
            "assembled_context": assembled_context,
            "cache_key": cache_key,
            "from_cache": from_cache,
        }

    return stream_generation_pipeline


def test_chat_stream_from_cache_emits_start_chunk_done(monkeypatch: pytest.MonkeyPatch) -> None:
    finalized = {"called": 0}

    class FakeQueryService:
        def __init__(self, session):
            self.session = session

        async def prepare_generation(self, repository_id: str, repo_id: str, query: str, *, user_id=None, session_id=None, federated=False, scope_paths=None, chat_mode=None, attached_files=None):
            _ = repository_id
            return (
                {
                    "answer": "cached-answer",
                    "intent": "explain",
                    "retrieved_context": [{"path": "x", "content": "body"}],
                },
                "",
                "k",
                True,
            )

        stream_generation_pipeline = _pipeline_from_prepare(prepare_generation)

        async def _ensure_session(self, session_id, user_id, repository_id):
            return session_id or "new-session"

        async def finalize_result(self, *_args, **kwargs):
            finalized["called"] += 1
            assert kwargs.get("query") == "hey"
            return {}

        @property
        def model_router(self):
            raise AssertionError("should not call model router for cache hit")

    client = _make_chat_test_app(monkeypatch, FakeQueryService)
    resp = client.post("/v1/chat/stream", json={"repo_id": "repo", "query": "hey"})
    assert resp.status_code == 200

    events = [json.loads(line[6:]) for line in resp.text.splitlines() if line.startswith("data: ")]
    data_events = [e["data"] for e in events if e.get("success")]
    assert data_events[0]["type"] == "start"
    assert any(e.get("type") == "source" for e in data_events)
    assert any(e.get("type") == "chunk" for e in data_events)
    assert data_events[-1]["type"] == "done"
    assert finalized["called"] == 1


def test_chat_stream_non_cached_streams_and_finalizes(monkeypatch: pytest.MonkeyPatch) -> None:
    finalized = {"called": 0}

    class FakeModelRouter:
        def stream_chat(self, prompt: str, context: str = "", system_prompt: str = ""):
            assert prompt == "hey"
            assert "File:" in context
            yield "a"
            yield "b"

        def consume_stream_usage(self) -> dict:
            return {}

    class FakeQueryService:
        def __init__(self, session):
            self.session = session
            self._router = FakeModelRouter()

        async def prepare_generation(self, repository_id: str, repo_id: str, query: str, *, user_id=None, session_id=None, federated=False, scope_paths=None, chat_mode=None, attached_files=None):
            _ = repository_id
            return (
                {
                    "intent": "explain",
                    "retrieved_context": [{"path": "a.py", "symbol": "m", "content": "x"}],
                    "run_trace": [
                        {
                            "node": "planner",
                            "label": "Planning intent: search",
                            "detail": {"intent": "search"},
                        },
                        {
                            "node": "retrieval",
                            "label": "Retrieved 1 sources",
                            "detail": {
                                "retrieved_count": 1,
                                "source_preview": [{"path": "a.py", "score": 0.9}],
                            },
                        },
                    ],
                },
                "File: a.py | Symbol: m\nx",
                "k",
                False,
            )

        stream_generation_pipeline = _pipeline_from_prepare(prepare_generation)

        async def _ensure_session(self, session_id, user_id, repository_id):
            return session_id or "new-session"

        async def finalize_result(self, *_args, **_kwargs):
            finalized["called"] += 1
            return {}

        @property
        def model_router(self):
            return self._router

    client = _make_chat_test_app(monkeypatch, FakeQueryService)
    resp = client.post("/v1/chat/stream", json={"repo_id": "repo", "query": "hey"})
    assert resp.status_code == 200

    events = [json.loads(line[6:]) for line in resp.text.splitlines() if line.startswith("data: ")]
    data_events = [e["data"] for e in events if e.get("success")]
    chunks = [e["delta"] for e in data_events if e.get("type") == "chunk"]
    assert "".join(chunks) == "ab"
    assert any(e.get("type") == "trace_step" for e in data_events)
    assert any(e.get("type") == "source" for e in data_events)
    assert data_events[-1]["type"] == "done"
    assert finalized["called"] == 1


def test_chat_stream_llm_failure_emits_error_event(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeModelRouter:
        def stream_chat(self, *_args, **_kwargs):
            raise RuntimeError("down")

    class FakeQueryService:
        def __init__(self, session):
            self.session = session
            self._router = FakeModelRouter()

        async def prepare_generation(self, *_args, **_kwargs):
            return (
                {"intent": "explain", "retrieved_context": []},
                "context",
                "k",
                False,
            )

        stream_generation_pipeline = _pipeline_from_prepare(prepare_generation)

        async def _ensure_session(self, session_id, user_id, repository_id):
            return session_id or "new-session"

        async def finalize_result(self, *_args, **_kwargs):
            raise AssertionError("should not finalize when LLM fails")

        @property
        def model_router(self):
            return self._router

    client = _make_chat_test_app(monkeypatch, FakeQueryService)
    resp = client.post("/v1/chat/stream", json={"repo_id": "repo", "query": "hey"})
    assert resp.status_code == 200

    events = [json.loads(line[6:]) for line in resp.text.splitlines() if line.startswith("data: ")]
    assert any(e["success"] is False for e in events)


def test_chat_no_indexed_context_maps_to_409(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import main as main_module
    import app.api.v1.chat as chat_module

    class FakeQueryService:
        def __init__(self, session):
            self.session = session

        async def run(self, *_args, **_kwargs):
            raise chat_module.NoContextError("index first")

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
    assert "index" in body["error"]["message"].lower()
