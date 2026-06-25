"""API tests for change-sets router."""

from __future__ import annotations

import uuid

from app.db.models import ChatSession, Repository
from app.services.change_set_service import ChangeSetService


def _seed(db_session, test_user):
    user_id = test_user["id"]
    repo = Repository(
        id=str(uuid.uuid4()),
        owner_user_id=user_id,
        repo_id="org/api-repo",
        remote_url="https://github.com/org/api-repo.git",
        local_path="/tmp/api-repo",
        default_branch="main",
    )
    chat = ChatSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        repository_id=repo.id,
        session_mode="PLAN",
    )
    db_session.add_all([repo, chat])
    db_session.commit()

    svc = ChangeSetService(db_session)
    cs = svc.create_or_update_plan(
        repository_id=repo.id,
        chat_session_id=chat.id,
        user_id=user_id,
        plan_json={
            "summary": "API plan",
            "steps": [{"id": "1", "title": "Step 1", "files": ["a.ts"], "description": "Do it"}],
        },
        plan_markdown="# API plan",
    )
    return chat, cs


def test_get_change_set_for_session(client, auth_headers, db_session, test_user) -> None:
    chat, cs = _seed(db_session, test_user)

    r = client.get(f"/v1/change-sets?session_id={chat.id}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["id"] == cs.id
    assert data["status"] == "PLAN_READY"


def test_approve_plan(client, auth_headers, db_session, test_user) -> None:
    chat, cs = _seed(db_session, test_user)

    r = client.post(f"/v1/change-sets/{cs.id}/approve", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "PLAN_APPROVED"


def test_act_blocked_without_approval(client, auth_headers, db_session, test_user) -> None:
    _, cs = _seed(db_session, test_user)

    r = client.post(f"/v1/change-sets/{cs.id}/act", headers=auth_headers)
    assert r.status_code == 403
