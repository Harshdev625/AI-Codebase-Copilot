"""Unit tests for ChangeSetService state machine."""

from __future__ import annotations

import uuid

import pytest

from app.db.models import ChangeSet, ChatSession, Repository, User
from app.services.change_set_service import ChangeSetService


@pytest.fixture
def change_set_setup(db_session):
    user = User(
        id=str(uuid.uuid4()),
        email=f"cs-{uuid.uuid4().hex[:6]}@test.com",
        password_hash="hash",
        role="USER",
    )
    repo = Repository(
        id=str(uuid.uuid4()),
        owner_user_id=user.id,
        repo_id="org/repo",
        remote_url="https://github.com/org/repo.git",
        local_path="/tmp/repo",
        default_branch="main",
    )
    session = ChatSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        repository_id=repo.id,
        session_mode="PLAN",
    )
    db_session.add_all([user, repo, session])
    db_session.commit()
    return {"user": user, "repo": repo, "session": session}


def test_create_and_approve_plan(db_session, change_set_setup) -> None:
    svc = ChangeSetService(db_session)
    user = change_set_setup["user"]
    repo = change_set_setup["repo"]
    chat = change_set_setup["session"]

    row = svc.create_or_update_plan(
        repository_id=repo.id,
        chat_session_id=chat.id,
        user_id=user.id,
        plan_json={"summary": "Test", "steps": [{"id": "1", "title": "Step", "files": [], "description": "d"}]},
        plan_markdown="# Plan",
    )
    assert row.status == "PLAN_READY"
    assert row.plan_version == 1

    approved = svc.approve(row.id, user.id, user.email)
    assert approved.status == "PLAN_APPROVED"
    assert approved.approved_by == user.email


def test_act_requires_approval(db_session, change_set_setup) -> None:
    import pytest
    from fastapi import HTTPException

    svc = ChangeSetService(db_session)
    user = change_set_setup["user"]
    repo = change_set_setup["repo"]
    chat = change_set_setup["session"]

    row = svc.create_or_update_plan(
        repository_id=repo.id,
        chat_session_id=chat.id,
        user_id=user.id,
        plan_json={"summary": "Test", "steps": []},
        plan_markdown="# Plan",
    )

    class _FakeQuery:
        async def run(self, **kwargs):
            return {"answer": "no patch"}

    with pytest.raises(HTTPException) as exc:
        import asyncio

        asyncio.run(
            svc.start_act(row.id, user.id, _FakeQuery(), repo_row={"id": repo.id, "repo_id": repo.repo_id})
        )
    assert exc.value.status_code == 403


def test_cancel_change_set(db_session, change_set_setup) -> None:
    svc = ChangeSetService(db_session)
    user = change_set_setup["user"]
    repo = change_set_setup["repo"]
    chat = change_set_setup["session"]

    row = svc.create_or_update_plan(
        repository_id=repo.id,
        chat_session_id=chat.id,
        user_id=user.id,
        plan_json={"summary": "Test", "steps": []},
        plan_markdown="# Plan",
    )
    cancelled = svc.cancel(row.id, user.id)
    assert cancelled.status == "CANCELLED"


def test_update_plan_manual_resets_approval(db_session, change_set_setup) -> None:
    svc = ChangeSetService(db_session)
    user = change_set_setup["user"]
    repo = change_set_setup["repo"]
    chat = change_set_setup["session"]

    row = svc.create_or_update_plan(
        repository_id=repo.id,
        chat_session_id=chat.id,
        user_id=user.id,
        plan_json={"summary": "Test", "steps": []},
        plan_markdown="# Plan",
    )
    svc.approve(row.id, user.id, user.email)
    updated = svc.update_plan_manual(
        row.id,
        user.id,
        {"summary": "Updated", "steps": [{"id": "1", "title": "S", "files": [], "description": "d"}]},
    )
    assert updated.status == "PLAN_READY"
    assert updated.plan_version == 2


def test_get_for_session(db_session, change_set_setup) -> None:
    svc = ChangeSetService(db_session)
    user = change_set_setup["user"]
    repo = change_set_setup["repo"]
    chat = change_set_setup["session"]

    row = svc.create_or_update_plan(
        repository_id=repo.id,
        chat_session_id=chat.id,
        user_id=user.id,
        plan_json={"summary": "Test", "steps": []},
        plan_markdown="# Plan",
    )
    found = svc.get_for_session(session_id=chat.id, user_id=user.id)
    assert found is not None
    assert found.id == row.id
    payload = svc.to_response(found)
    assert payload["plan_json"]["summary"] == "Test"
