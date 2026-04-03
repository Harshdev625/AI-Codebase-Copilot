from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import main
from app.db import database
from app.graph.nodes.answer import answer_node
from app.graph.nodes.code_understanding import code_understanding_node
from app.graph.nodes.debugger import debugger_node
from app.graph.nodes.documentation import documentation_node
from app.graph.nodes.patch_generation import patch_generation_node
from app.graph.nodes.refactor_advisor import refactor_advisor_node
from app.graph.nodes.retrieval import retrieval_node
from app.graph.nodes.tool_execution import tool_execution_node
from app.graph.nodes.verifier import verifier_node
from app.graph.workflow import build_graph, route_after_retrieval
from app.llm.model_router import OllamaModelRouter, get_model_router
from app.services.cache_service import CacheService
from app.services.qdrant_service import QdrantService
from app.services.query_service import QueryService
from app.tools.git_tools import git_status
from app.tools.terminal_tools import run_command


class _DummyResponse:
    def __init__(
        self,
        payload: dict | None = None,
        should_raise: bool = False,
        status_code: int = 200,
    ) -> None:
        self._payload = payload or {}
        self._should_raise = should_raise
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self._should_raise:
            raise httpx.HTTPStatusError(
                "boom",
                request=httpx.Request("GET", "http://x"),
                response=httpx.Response(self.status_code or 500),
            )

    def json(self) -> dict:
        return self._payload


def test_main_create_app_registers_routes_and_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {"schema": 0}

    def fake_ensure() -> None:
        called["schema"] += 1

    monkeypatch.setattr(main, "ensure_app_schema", fake_ensure)
    app = main.create_app()

    paths = {route.path for route in app.routes}
    assert "/v1/auth/register" in paths
    assert "/v1/projects" in paths
    assert "/v1/chat" in paths
    assert "/v1/admin/system-metrics" in paths

    with TestClient(app):
        pass

    assert called["schema"] == 1


def test_route_after_retrieval_branches() -> None:
    assert route_after_retrieval({"intent": "debug"}) == "debugger"
    assert route_after_retrieval({"intent": "refactor"}) == "refactor_advisor"
    assert route_after_retrieval({"intent": "docs"}) == "documentation"
    assert route_after_retrieval({"intent": "other"}) == "code_understanding"


def test_build_graph_returns_compiled_graph() -> None:
    graph = build_graph()
    assert graph is not None
    assert hasattr(graph, "invoke")


def test_answer_node_covers_all_sections() -> None:
    out = answer_node(
        {
            "analysis": "A",
            "refactor_plan": "R",
            "documentation": "D",
            "tool_results": [{"output": "T"}],
            "patch": "P",
            "verification": {"confidence": 0.8, "retrieved_count": 3},
        }
    )
    assert "A" in out["answer"]
    assert "R" in out["answer"]
    assert "D" in out["answer"]
    assert "Tool results: T" in out["answer"]
    assert "Patch suggestion" in out["answer"]
    assert "confidence=0.8" in out["answer"]


def test_answer_node_empty_default() -> None:
    out = answer_node({})
    assert out["answer"] == "No answer generated."


def test_code_understanding_node_with_and_without_context() -> None:
    empty = code_understanding_node({"retrieved_context": []})
    assert "No relevant code context" in empty["analysis"]

    filled = code_understanding_node(
        {"retrieved_context": [{"path": "app/x.py", "symbol": "fn"}]}
    )
    assert "app/x.py" in filled["analysis"]
    assert "fn" in filled["analysis"]


def test_debugger_node_with_and_without_context() -> None:
    empty = debugger_node({"retrieved_context": []})
    assert empty["confidence"] == 0.25

    filled = debugger_node({"retrieved_context": [{"path": "a.py", "symbol": "do"}]})
    assert "a.py" in filled["analysis"]
    assert filled["confidence"] == 0.62


def test_documentation_node_with_and_without_context() -> None:
    empty = documentation_node({"retrieved_context": []})
    assert "unavailable" in empty["documentation"]

    filled = documentation_node(
        {
            "retrieved_context": [
                {"path": "a.py", "symbol": "do"},
                {"path": "b.py", "symbol": "m"},
            ]
        }
    )
    assert "Generated Documentation Draft" in filled["documentation"]
    assert "a.py (do)" in filled["documentation"]
    assert "b.py (m)" in filled["documentation"]


def test_patch_generation_node_with_and_without_context() -> None:
    empty = patch_generation_node({"retrieved_context": []})
    assert "No patch generated" in empty["patch"]

    filled = patch_generation_node({"retrieved_context": [{"path": "app/file.py"}]})
    assert "diff --git a/app/file.py b/app/file.py" in filled["patch"]


def test_refactor_advisor_node_with_and_without_context() -> None:
    empty = refactor_advisor_node({"retrieved_context": []})
    assert "No code context" in empty["refactor_plan"]

    filled = refactor_advisor_node({"retrieved_context": [{"path": "f.py", "symbol": "X"}]})
    assert "Refactor target: f.py (X)" in filled["refactor_plan"]


def test_retrieval_node_delegates_hybrid_retrieve(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.graph.nodes import retrieval as retrieval_module

    calls: dict[str, object] = {}

    def fake_retrieve(session, repository_id: str, query: str, top_k: int):
        calls["session"] = session
        calls["repository_id"] = repository_id
        calls["query"] = query
        calls["top_k"] = top_k
        return [{"path": "a.py"}]

    monkeypatch.setattr(retrieval_module, "hybrid_retrieve", fake_retrieve)
    session = object()
    out = retrieval_node({"session": session, "repo_id": "r1", "repository_id": "rid1", "query": "q"})

    assert out["retrieved_context"] == [{"path": "a.py"}]
    assert calls == {"session": session, "repository_id": "rid1", "query": "q", "top_k": 8}


def test_tool_execution_node_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.graph.nodes import tool_execution as tool_module

    monkeypatch.setattr(tool_module, "git_status", lambda path: f"status:{path}")
    out_git = tool_execution_node({"query": "please show git status"})
    assert out_git["tool_results"][0]["tool"] == "git_status"

    monkeypatch.setattr(tool_module, "is_command_allowed", lambda command: False)
    out_blocked = tool_execution_node({"query": "run rm -rf /"})
    assert "Blocked by safety policy" in out_blocked["tool_results"][0]["output"]

    monkeypatch.setattr(tool_module, "is_command_allowed", lambda command: True)
    monkeypatch.setattr(tool_module, "run_command", lambda command: "ok")
    out_run = tool_execution_node({"query": "run echo hello"})
    assert out_run["tool_results"][0] == {"tool": "run_command", "output": "ok"}

    out_none = tool_execution_node({"query": "nothing"})
    assert out_none["tool_results"][0]["tool"] == "none"


def test_verifier_node_confidence_adjustment() -> None:
    boosted = verifier_node({"retrieved_context": [{"path": "x"}], "confidence": 0.8, "analysis": "x"})
    assert boosted["confidence"] == 0.95
    assert boosted["verification"]["retrieved_count"] == 1
    assert boosted["verification"]["has_analysis"] is True

    reduced = verifier_node({"retrieved_context": [], "confidence": 0.2})
    assert reduced["confidence"] == pytest.approx(0.1)


def test_ollama_model_router_chat_and_embed(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.llm.model_router as model_router

    class DummyEmbedder:
        def embed_text(self, text: str) -> list[float]:
            return [1.0, float(len(text))]

    captured: dict[str, object] = {}

    class _FakeClient:
        def post(self, url: str, json: dict, timeout: float):
            captured["url"] = url
            captured["json"] = json
            captured["timeout"] = timeout
            return _DummyResponse({"message": {"content": "  hello  "}})

    monkeypatch.setattr(model_router, "get_embedding_provider", lambda: DummyEmbedder())
    monkeypatch.setattr(model_router, "get_http_client", lambda: _FakeClient())
    model_router._get_model_router_singleton.cache_clear()

    router = OllamaModelRouter()
    assert router.chat("What?", context="ctx") == "hello"
    assert "/api/chat" in str(captured["url"])
    assert router.embed("abc") == [1.0, 3.0]


def test_ollama_model_router_chat_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.llm.model_router as model_router

    class DummyEmbedder:
        def embed_text(self, text: str) -> list[float]:
            return [0.0]

    class _FakeClient:
        def post(self, url: str, json: dict, timeout: float):
            return _DummyResponse(should_raise=True)

    monkeypatch.setattr(model_router, "get_embedding_provider", lambda: DummyEmbedder())
    monkeypatch.setattr(model_router, "get_http_client", lambda: _FakeClient())
    model_router._get_model_router_singleton.cache_clear()

    router = OllamaModelRouter()
    with pytest.raises(RuntimeError, match="Ollama chat request failed"):
        router.chat("q")


def test_get_model_router_returns_router(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.llm.model_router as model_router

    class DummyEmbedder:
        def embed_text(self, text: str) -> list[float]:
            return [0.0]

    monkeypatch.setattr(model_router, "get_embedding_provider", lambda: DummyEmbedder())
    model_router._get_model_router_singleton.cache_clear()
    router = get_model_router()
    assert isinstance(router, OllamaModelRouter)


def test_cache_service_get_set_json_with_and_without_client(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.services.cache_service as cache_module

    class FakeRedisClient:
        def __init__(self) -> None:
            self.storage: dict[str, str] = {}
            self.last_set: tuple[str, str, int | None] | None = None

        def get(self, key: str):
            return self.storage.get(key)

        def set(self, key: str, value: str, ex: int | None = None):
            self.storage[key] = value
            self.last_set = (key, value, ex)

    fake_client = FakeRedisClient()

    class FakeRedisModule:
        class Redis:
            @staticmethod
            def from_url(url: str, decode_responses: bool = True):
                return fake_client

    monkeypatch.setattr(cache_module, "redis", FakeRedisModule)
    cache_module._get_redis_client.cache_clear()
    cache_module.get_cache_service.cache_clear()
    service = CacheService()

    assert service.get_json("missing") is None
    service.set_json("k", {"a": 1}, ttl_seconds=42)
    assert service.get_json("k") == {"a": 1}
    assert fake_client.last_set is not None
    assert fake_client.last_set[2] == 42

    fake_client.storage["bad"] = "not-json"
    assert service.get_json("bad") is None

    monkeypatch.setattr(cache_module, "redis", None)
    cache_module._get_redis_client.cache_clear()
    cache_module.get_cache_service.cache_clear()
    no_client = CacheService()
    assert no_client.get_json("x") is None
    no_client.set_json("x", {"ok": True})


def test_query_service_cache_hit_and_miss(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.services.query_service as query_module

    class FakeCache:
        def __init__(self, cached=None):
            self.cached = cached
            self.set_calls: list[tuple[str, dict]] = []

        def get_json(self, key: str):
            return self.cached

        def set_json(self, key: str, value: dict, ttl_seconds: int | None = None):
            self.set_calls.append((key, value))

    class FakeGraph:
        def invoke(self, state: dict):
            return {
                "retrieved_context": [
                    {"path": "a.py", "symbol": "fn", "content": "def fn(): pass"},
                    {"path": "b.py", "symbol": None, "content": "x = 1"},
                ],
                "answer": "from-graph",
            }

    class FakeRouter:
        def chat(self, prompt: str, context: str = "") -> str:
            assert prompt == "What is this?"
            assert "File: a.py" in context
            return "llm answer"

    monkeypatch.setattr(query_module, "compiled_graph", FakeGraph())
    monkeypatch.setattr(query_module, "get_model_router", lambda: FakeRouter())

    hit_cache = FakeCache(cached={"answer": "cached"})
    monkeypatch.setattr(query_module, "get_cache_service", lambda: hit_cache)
    cached_service = QueryService(session=object())
    assert cached_service.run("repo-uuid", "repo", "What is this?") == {"answer": "cached"}

    miss_cache = FakeCache(cached=None)
    monkeypatch.setattr(query_module, "get_cache_service", lambda: miss_cache)
    miss_service = QueryService(session=object())
    out = miss_service.run("repo-uuid", "repo", "What is this?")
    assert out["answer"] == "llm answer"
    assert len(miss_cache.set_calls) == 1


def test_qdrant_service_paths_and_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.services.qdrant_service as qdrant_module

    calls: dict[str, object] = {}

    class _FakeClient:
        def put(self, url: str, json: dict, timeout: float):
            calls["put_url"] = url
            calls["put_payload"] = json
            calls["put_timeout"] = timeout
            return _DummyResponse()

        def post(self, url: str, json: dict, timeout: float):
            calls["post_url"] = url
            calls["post_payload"] = json
            calls["post_timeout"] = timeout
            return _DummyResponse({"result": [{"id": "1"}]})

    monkeypatch.setattr(qdrant_module, "get_http_client", lambda: _FakeClient())

    svc = QdrantService()
    svc.ensure_collection()
    assert "/collections/" in str(calls["put_url"])

    svc.upsert_points([{"id": 1, "vector": [0.1], "payload": {}}])
    assert "/points" in str(calls["put_url"])

    assert svc.search([0.1], repository_id="r1", limit=3) == [{"id": "1"}]
    assert calls["post_payload"]["limit"] == 3

    svc.upsert_points([])

    class _RaisingClient:
        def put(self, url: str, json: dict, timeout: float):
            return _DummyResponse(should_raise=True)

        def post(self, url: str, json: dict, timeout: float):
            return _DummyResponse(should_raise=True)

    monkeypatch.setattr(qdrant_module, "get_http_client", lambda: _RaisingClient())

    with pytest.raises(RuntimeError, match="ensure Qdrant"):
        svc.ensure_collection()
    with pytest.raises(RuntimeError, match="upsert vectors"):
        svc.upsert_points([{"id": 1}])
    with pytest.raises(RuntimeError, match="search Qdrant"):
        svc.search([0.1], repository_id="r1", limit=1)


def test_git_status_and_run_command(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.tools.git_tools as git_module
    import app.tools.terminal_tools as terminal_module

    def fake_subprocess_run_git(cmd, capture_output: bool, text: bool, check: bool, cwd=None):
        return SimpleNamespace(stdout=" M changed.py\n", stderr="")

    monkeypatch.setattr(git_module.subprocess, "run", fake_subprocess_run_git)
    assert git_status(".") == "M changed.py"

    def fake_subprocess_run_git_clean(cmd, capture_output: bool, text: bool, check: bool, cwd=None):
        return SimpleNamespace(stdout="\n", stderr="")

    monkeypatch.setattr(git_module.subprocess, "run", fake_subprocess_run_git_clean)
    assert git_status(".") == "clean"

    def fake_subprocess_run_command(cmd, cwd=None, capture_output: bool = True, text: bool = True, check: bool = False):
        return SimpleNamespace(stdout="out\n", stderr="err\n")

    monkeypatch.setattr(terminal_module.subprocess, "run", fake_subprocess_run_command)
    assert run_command("echo hi") == "out\nerr"


def test_database_get_db_session_closes(monkeypatch: pytest.MonkeyPatch) -> None:
    closed = {"value": False}

    class FakeSession:
        def close(self) -> None:
            closed["value"] = True

    monkeypatch.setattr(database, "SessionLocal", lambda: FakeSession())
    generator = database.get_db_session()
    session = next(generator)
    assert isinstance(session, FakeSession)

    with pytest.raises(StopIteration):
        next(generator)

    assert closed["value"] is True
