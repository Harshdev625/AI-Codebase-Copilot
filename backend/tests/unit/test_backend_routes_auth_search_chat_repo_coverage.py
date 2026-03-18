from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.api.v1.auth import login, register
from app.api.v1.chat import (
    _ensure_membership as chat_ensure_membership,
    _get_conversation,
    chat,
    create_conversation,
    create_message,
    list_messages,
)
from app.api.v1.repositories import (
    _ensure_membership as repo_ensure_membership,
    add_repository,
    create_project,
    get_index_progress,
    list_projects,
    list_repositories,
)
from app.api.v1.search import search
from app.core import security
from app.models.api_models import (
    AddRepositoryRequest,
    AuthLoginRequest,
    AuthRegisterRequest,
    ChatRequest,
    CreateConversationRequest,
    CreateProjectRequest,
    MessageCreateRequest,
    SearchRequest,
)


class _Result:
    def __init__(self, rows=None):
        self.rows = rows or []

    def first(self):
        return self.rows[0] if self.rows else None

    def mappings(self):
        return self

    def all(self):
        return self.rows


class _SessionQueue:
    def __init__(self, results=None):
        self.results = results or []
        self.idx = 0
        self.commits = 0

    def execute(self, *_args, **_kwargs):
        if self.idx < len(self.results):
            rows = self.results[self.idx]
            self.idx += 1
            return _Result(rows)
        self.idx += 1
        return _Result([])

    def commit(self):
        self.commits += 1


def test_security_negative_paths() -> None:
    assert security.verify_password("x", "bad-format") is False

    token = security.create_access_token("u1", expires_seconds=1)
    parts = token.split(".")
    bad_token = f"{parts[0]}.{parts[1]}.invalid"
    with pytest.raises(ValueError, match="Invalid token signature"):
        security.decode_access_token(bad_token)

    payload = security.decode_access_token(token)
    assert payload["sub"] == "u1"


def test_auth_register_login_and_invalid_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    existing_session = _SessionQueue(results=[[{"id": "u1"}]])
    with pytest.raises(HTTPException, match="Email already registered"):
        register(AuthRegisterRequest(email="a@b.com", password="password123", full_name="A"), session=existing_session)

    new_session = _SessionQueue(results=[[]])
    out = register(AuthRegisterRequest(email="c@d.com", password="password123", full_name="C"), session=new_session)
    assert out.email == "c@d.com"

    bad_login_session = _SessionQueue(results=[[{"id": "u1", "password_hash": "x", "is_active": True}]])
    with pytest.raises(HTTPException, match="Invalid credentials"):
        login(AuthLoginRequest(email="a@b.com", password="wrong"), session=bad_login_session)

    pwd_hash = security.hash_password("password123")
    inactive_login_session = _SessionQueue(results=[[{"id": "u1", "password_hash": pwd_hash, "is_active": False}]])
    with pytest.raises(HTTPException, match="User is inactive"):
        login(AuthLoginRequest(email="a@b.com", password="password123"), session=inactive_login_session)

    active_login_session = _SessionQueue(results=[[{"id": "u1", "password_hash": pwd_hash, "is_active": True}]])
    token = login(AuthLoginRequest(email="a@b.com", password="password123"), session=active_login_session)
    assert token.access_token


def test_search_success_and_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.v1.search as search_module

    monkeypatch.setattr(search_module, "ensure_repository_access", lambda session, repo_id, user_id: {"id": "r1"})
    monkeypatch.setattr(search_module, "hybrid_retrieve", lambda session, repo_id, query, top_k: [{"id": "1"}])
    out = search(
        SearchRequest(repo_id="repo", query="find", top_k=2),
        current_user={"id": "u1"},
        session=_SessionQueue(),
    )
    assert len(out.results) == 1

    monkeypatch.setattr(search_module, "hybrid_retrieve", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("down")))
    with pytest.raises(HTTPException, match="down"):
        search(
            SearchRequest(repo_id="repo", query="find", top_k=2),
            current_user={"id": "u1"},
            session=_SessionQueue(),
        )


def test_repository_routes_main_paths() -> None:
    now = datetime.utcnow()
    session = _SessionQueue(
        results=[
            [{"id": "p0", "name": "Proj0", "description": "d0", "created_by": "u1", "created_at": now}],
            [],
            [],
            [{"id": "p1", "name": "P", "description": "d", "created_by": "u1", "created_at": now}],
            [{"id": "m1"}],
            [],
            [{"id": "r1", "project_id": "p1", "repo_id": "repo", "remote_url": "url", "local_path": None, "default_branch": "main", "created_at": now}],
            [{"id": "m1"}],
            [{"id": "r1", "project_id": "p1", "repo_id": "repo", "remote_url": "url", "local_path": None, "default_branch": "main", "created_at": now}],
            [{"id": "s1", "index_status": "running", "stats": {}, "message": "m", "status": "running", "started_at": now}],
        ]
    )

    projects = list_projects(current_user={"id": "u1"}, session=session)
    assert projects[0].id == "p0"

    created_project = create_project(
        CreateProjectRequest(name="Proj", description="desc"),
        current_user={"id": "u1"},
        session=session,
    )
    assert created_project.id == "p1"

    created_repo = add_repository(
        "p1",
        AddRepositoryRequest(repo_id="repo", remote_url="url", default_branch="main"),
        current_user={"id": "u1"},
        session=session,
    )
    assert created_repo.repo_id == "repo"

    repos = list_repositories("p1", current_user={"id": "u1"}, session=session)
    assert repos[0].id == "r1"

    progress = get_index_progress("s1", current_user={"id": "u1"}, session=session)
    assert progress["snapshot_id"] == "s1"


def test_repository_routes_error_paths() -> None:
    with pytest.raises(HTTPException, match="Not authorized"):
        repo_ensure_membership(_SessionQueue(results=[[]]), "p1", "u1")

    with pytest.raises(HTTPException, match="Project creation failed"):
        create_project(
            CreateProjectRequest(name="Proj", description="desc"),
            current_user={"id": "u1"},
            session=_SessionQueue(results=[[], []]),
        )

    with pytest.raises(HTTPException, match="Repository creation failed"):
        add_repository(
            "p1",
            AddRepositoryRequest(repo_id="repo", remote_url="url", default_branch="main"),
            current_user={"id": "u1"},
            session=_SessionQueue(results=[[{"id": "m1"}], []]),
        )

    with pytest.raises(HTTPException, match="Snapshot not found"):
        get_index_progress("missing", current_user={"id": "u1"}, session=_SessionQueue(results=[[]]))


def test_chat_routes_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.v1.chat as chat_module

    monkeypatch.setattr(chat_module, "ensure_repository_access", lambda session, repo_id, user_id: {"id": "r1"})

    class FakeQueryService:
        def __init__(self, session):
            self.session = session

        def run(self, repo_id: str, query: str):
            return {"answer": "hello", "intent": "explain", "retrieved_context": [{"path": "x"}]}

    monkeypatch.setattr(chat_module, "QueryService", FakeQueryService)

    out = chat(ChatRequest(repo_id="repo", query="what?"), current_user={"id": "u1"}, session=_SessionQueue())
    assert out.answer == "hello"

    class FailingQueryService(FakeQueryService):
        def run(self, repo_id: str, query: str):
            raise RuntimeError("llm unavailable")

    monkeypatch.setattr(chat_module, "QueryService", FailingQueryService)
    with pytest.raises(HTTPException, match="llm unavailable"):
        chat(ChatRequest(repo_id="repo", query="what?"), current_user={"id": "u1"}, session=_SessionQueue())


def test_chat_conversation_and_messages_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.v1.chat as chat_module

    now = datetime.utcnow()
    session = _SessionQueue(
        results=[
            [{"id": "m1"}],
            [],
            [{"id": "c1", "project_id": "p1", "user_id": "u1", "title": "t", "created_at": now}],
            [{"id": "c1", "project_id": "p1"}],
            [{"id": "m1"}],
            [{"id": "m1", "conversation_id": "c1", "role": "user", "content": "q", "created_at": now}],
            [{"id": "c1", "project_id": "p1"}],
            [{"id": "m1"}],
            [],
            [],
            [],
            [],
            [
                {"id": "a1", "conversation_id": "c1", "role": "assistant", "content": "ans", "created_at": now},
                {"id": "u1", "conversation_id": "c1", "role": "user", "content": "q", "created_at": now},
            ],
        ]
    )

    class FakeQueryService:
        def __init__(self, db):
            self.db = db

        def run(self, repo_id: str, query: str):
            return {"answer": "ans", "intent": "explain", "retrieved_context": [{"id": "x"}]}

    monkeypatch.setattr(chat_module, "QueryService", FakeQueryService)

    conv = create_conversation(
        "p1",
        CreateConversationRequest(title="t"),
        current_user={"id": "u1"},
        session=session,
    )
    assert conv.id == "c1"

    listed = list_messages("c1", current_user={"id": "u1"}, session=session)
    assert listed[0].conversation_id == "c1"

    created = create_message(
        "c1",
        MessageCreateRequest(repo_id="repo", query="where?"),
        current_user={"id": "u1"},
        session=session,
    )
    assert len(created) == 2


def test_chat_error_helpers() -> None:
    with pytest.raises(HTTPException, match="Conversation not found"):
        _get_conversation(_SessionQueue(results=[[]]), "missing")

    assert _get_conversation(_SessionQueue(results=[[{"id": "c1", "project_id": "p1"}]]), "c1")["id"] == "c1"

    with pytest.raises(HTTPException, match="Not authorized"):
        chat_ensure_membership(_SessionQueue(results=[[]]), "p1", "u1")

    with pytest.raises(HTTPException, match="Conversation creation failed"):
        create_conversation(
            "p1",
            CreateConversationRequest(title="t"),
            current_user={"id": "u1"},
            session=_SessionQueue(results=[[{"id": "m1"}], []]),
        )
