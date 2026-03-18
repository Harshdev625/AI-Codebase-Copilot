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

    monkeypatch.setattr(
        module.httpx,
        "post",
        lambda *args, **kwargs: _Response({"embedding": [1, 2.5, 3]}),
    )
    provider = module.OllamaEmbeddingProvider()
    assert provider.embed_text("x") == [1.0, 2.5, 3.0]

    monkeypatch.setattr(
        module.httpx,
        "post",
        lambda *args, **kwargs: _Response({"embeddings": [[4, 5]]}),
    )
    assert provider.embed_text("y") == [4.0, 5.0]


def test_ollama_embedding_provider_error_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.embeddings.ollama_provider as module

    provider = module.OllamaEmbeddingProvider()

    connect_exc = httpx.ConnectError("no", request=httpx.Request("POST", "http://x"))
    monkeypatch.setattr(module.httpx, "post", lambda *args, **kwargs: _Response(should_raise=connect_exc))
    with pytest.raises(RuntimeError, match="Could not connect to Ollama"):
        provider.embed_text("z")

    status_exc = httpx.HTTPStatusError(
        "bad",
        request=httpx.Request("POST", "http://x"),
        response=httpx.Response(500),
    )
    monkeypatch.setattr(module.httpx, "post", lambda *args, **kwargs: _Response(should_raise=status_exc))
    with pytest.raises(RuntimeError, match="embedding request failed"):
        provider.embed_text("z")

    monkeypatch.setattr(module.httpx, "post", lambda *args, **kwargs: _Response({"foo": "bar"}))
    with pytest.raises(ValueError, match="did not include an embedding"):
        provider.embed_text("z")


def test_embedding_provider_factory(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.embeddings.provider as provider_module

    class Dummy:
        pass

    monkeypatch.setattr(provider_module, "OllamaEmbeddingProvider", lambda: Dummy())
    assert isinstance(provider_module.get_embedding_provider(), Dummy)


def test_hybrid_utilities_and_dense_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.retrieval.hybrid as hybrid

    assert reciprocal_rank_fusion([["a", "b"], ["b", "c"]])[:2] == ["b", "a"]
    assert _to_vector_literal([1, 2.345678912]) == "[1.00000000,2.34567891]"

    class Embedder:
        def embed_text(self, text: str) -> list[float]:
            return [0.1] * settings.vector_dim

    monkeypatch.setattr(hybrid, "get_embedding_provider", lambda: Embedder())

    session = _Session(rows=[{"id": "1", "path": "a.py", "symbol": "f", "content": "x", "score": 0.9}])
    out = hybrid._dense_search_postgres(session, "r", "q", top_k=1)
    assert out[0]["id"] == "1"

    class Qdrant:
        def search(self, vector: list[float], repo_id: str, limit: int):
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
        def search(self, vector: list[float], repo_id: str, limit: int):
            raise RuntimeError("qdrant down")

    monkeypatch.setattr(hybrid, "QdrantService", lambda: BrokenQdrant())
    monkeypatch.setattr(
        hybrid,
        "_dense_search_postgres",
        lambda session, repo_id, query, top_k=20: [{"id": "d1", "path": "a", "symbol": "s", "content": "c", "score": 0.7}],
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
    assert hybrid._dense_search_postgres(_Session(), "r", "q") == []


def test_indexing_service_helpers(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import app.services.indexing_service as module

    monkeypatch.setattr(
        module,
        "get_embedding_provider",
        lambda: SimpleNamespace(embed_text=lambda _text: [0.1] * settings.vector_dim),
    )
    monkeypatch.setattr(module, "QdrantService", lambda: SimpleNamespace(ensure_collection=lambda: None, upsert_points=lambda points: None))

    service = IndexingService(_Session())

    assert service._slugify_repo_id("my/repo!!") == "my-repo"
    assert service._slugify_repo_id("...") == "repo"

    monkeypatch.setattr(module.subprocess, "run", lambda *args, **kwargs: (_ for _ in ()).throw(subprocess.TimeoutExpired("git", 1)))
    with pytest.raises(RuntimeError, match="timed out"):
        service._run_git(["status"], timeout=1)

    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    assert service._resolve_repo_root("r", str(repo_dir), None, None) == repo_dir

    with pytest.raises(FileNotFoundError):
        service._resolve_repo_root("r", str(repo_dir / "missing"), None, None)

    with pytest.raises(ValueError, match="Provide either repo_path or repo_url"):
        service._resolve_repo_root("r", None, None, None)

    assert service._resolve_repo_root("r", None, str(repo_dir), None) == repo_dir


def test_indexing_file_iteration_and_gitignore(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import app.services.indexing_service as module

    monkeypatch.setattr(module, "get_embedding_provider", lambda: SimpleNamespace(embed_text=lambda _text: [0.1] * settings.vector_dim))
    monkeypatch.setattr(module, "QdrantService", lambda: SimpleNamespace(ensure_collection=lambda: None, upsert_points=lambda points: None))
    service = IndexingService(_Session())

    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "a.py").write_text("print('a')", encoding="utf-8")
    (repo / "b.bin").write_text("x", encoding="utf-8")

    monkeypatch.setattr(
        service,
        "_run_git",
        lambda args, cwd=None, timeout=300: SimpleNamespace(stdout="a.py\x00b.bin\x00"),
    )
    files = list(service._iter_git_listed_files(repo))
    assert [f.name for f in files] == ["a.py"]

    (repo / ".gitignore").write_text("ignored_dir/\n", encoding="utf-8")
    spec = service._load_gitignore_spec(repo)
    assert service._is_ignored(spec, repo, repo / "ignored_dir", is_dir=True) is True

    ignored = repo / "ignored_dir"
    ignored.mkdir()
    (ignored / "x.py").write_text("x", encoding="utf-8")
    (repo / "ok.py").write_text("x", encoding="utf-8")

    monkeypatch.setattr(service, "_iter_git_listed_files", lambda _repo: iter(()))
    walked = list(service._iter_indexable_files(repo, spec))
    assert any(path.name == "ok.py" for path in walked)
    assert all("ignored_dir" not in str(path) for path in walked)


def test_indexing_progress_and_generic_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.services.indexing_service as module

    monkeypatch.setattr(
        module,
        "get_embedding_provider",
        lambda: SimpleNamespace(embed_text=lambda _text: [0.1] * settings.vector_dim),
    )
    monkeypatch.setattr(module, "QdrantService", lambda: SimpleNamespace(ensure_collection=lambda: None, upsert_points=lambda points: None))

    session = _Session()
    service = IndexingService(session)

    service._update_progress("job-1", 1, 2, "msg")
    assert session.commits == 1

    failing_session = _Session(fail_on_execute=True)
    failing_service = IndexingService(failing_session)
    failing_service._update_progress("job-1", 1, 2, "msg")
    assert failing_session.rollbacks == 1

    source = "\n".join(f"line {i}" for i in range(85))
    chunks = service.generic_chunk_file("repo", "sha", Path("x.py"), source)
    assert len(chunks) == 3
    assert chunks[0].start_line == 1
    assert chunks[-1].end_line == 85


def test_upsert_chunks_and_index_repository_orchestration(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import app.services.indexing_service as module

    class Embedder:
        def __init__(self) -> None:
            self.calls = 0

        def embed_text(self, text: str) -> list[float]:
            self.calls += 1
            if "bad" in text:
                raise RuntimeError("embed fail")
            return [0.1] * settings.vector_dim

    embedder = Embedder()

    qdrant_calls = {"upserts": 0}

    class Qdrant:
        def ensure_collection(self) -> None:
            pass

        def upsert_points(self, points: list[dict]) -> None:
            qdrant_calls["upserts"] += len(points)

    monkeypatch.setattr(module, "get_embedding_provider", lambda: embedder)
    monkeypatch.setattr(module, "QdrantService", lambda: Qdrant())

    session = _Session()
    service = IndexingService(session)

    chunks = [
        CodeChunk(
            id="1",
            repo_id="r",
            commit_sha="s",
            path="a.py",
            language="py",
            symbol="",
            chunk_type="generic",
            start_line=1,
            end_line=1,
            content="ok",
        ),
        CodeChunk(
            id="2",
            repo_id="r",
            commit_sha="s",
            path="b.py",
            language="py",
            symbol="",
            chunk_type="generic",
            start_line=1,
            end_line=1,
            content="bad",
        ),
    ]

    service._upsert_chunks(chunks)
    assert session.commits == 1
    assert qdrant_calls["upserts"] == 1

    empty_session = _Session()
    empty_service = IndexingService(empty_session)
    empty_service._upsert_chunks([])
    assert empty_session.commits == 0

    repo = tmp_path / "repo"
    repo.mkdir()
    py_file = repo / "x.py"
    py_file.write_text("def f():\n    return 1\n", encoding="utf-8")

    monkeypatch.setattr(service, "_resolve_repo_root", lambda *args, **kwargs: repo)
    monkeypatch.setattr(service, "_load_gitignore_spec", lambda root: object())
    monkeypatch.setattr(service, "_iter_indexable_files", lambda root, spec: iter([py_file]))
    monkeypatch.setattr(module, "chunk_python_file", lambda *args, **kwargs: [chunks[0]])

    seen = {"count": 0}

    def fake_upsert(items: list[CodeChunk]) -> None:
        seen["count"] = len(items)

    monkeypatch.setattr(service, "_upsert_chunks", fake_upsert)
    total = service.index_repository("r", "s", repo_path=str(repo), indexing_job_id="job")
    assert total == 1
    assert seen["count"] == 1
