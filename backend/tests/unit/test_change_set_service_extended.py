"""Additional ChangeSetService coverage."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.db.models import ActPatchDraft, ActPatchFile, ChatSession, Repository, User
from app.services.change_set_service import ChangeSetService


@pytest.fixture
def rollback_setup(db_session, tmp_path):
    user = User(
        id=str(uuid.uuid4()),
        email=f"rb-{uuid.uuid4().hex[:6]}@test.com",
        password_hash="hash",
        role="USER",
    )
    repo_path = tmp_path / "rb-repo"
    repo_path.mkdir()
    repo = Repository(
        id=str(uuid.uuid4()),
        owner_user_id=user.id,
        repo_id="org/rb",
        remote_url="https://github.com/org/rb.git",
        local_path=str(repo_path),
        default_branch="main",
    )
    chat = ChatSession(id=str(uuid.uuid4()), user_id=user.id, repository_id=repo.id, session_mode="PLAN")
    db_session.add_all([user, repo, chat])
    db_session.flush()

    patch_id = str(uuid.uuid4())
    draft = ActPatchDraft(
        id=patch_id,
        repository_id=repo.id,
        base_commit_sha="base",
        status="APPLIED",
        applied_commit_sha_before="base",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    cs = __import__("app.db.models", fromlist=["ChangeSet"]).ChangeSet(
        id=str(uuid.uuid4()),
        repository_id=repo.id,
        chat_session_id=chat.id,
        user_id=user.id,
        status="APPLIED",
        plan_version=1,
        plan_json={"summary": "s", "steps": []},
        patch_id=patch_id,
    )
    db_session.add_all([draft, cs])
    db_session.add(
        ActPatchFile(
            patch_id=patch_id,
            file_path="README.md",
            action="MODIFIED",
            file_diff="--- a/README.md\n+++ b/README.md",
        )
    )
    db_session.commit()
    return user, cs


def test_rollback_marks_change_set_rolled_back(db_session, rollback_setup, monkeypatch) -> None:
    user, cs = rollback_setup
    svc = ChangeSetService(db_session)

    monkeypatch.setattr(
        "app.services.snapshot_restore_service.subprocess.run",
        lambda *a, **k: type("R", (), {"returncode": 0, "stdout": b"old"})(),
    )

    updated = svc.rollback(cs.id, user.id)
    assert updated.status == "ROLLED_BACK"


def test_mark_applied(db_session, rollback_setup) -> None:
    user, cs = rollback_setup
    svc = ChangeSetService(db_session)
    cs.status = "PATCH_APPROVED"
    db_session.commit()
    updated = svc.mark_applied(cs.id, user.id)
    assert updated.status == "APPLIED"


def test_rollback_requires_applied(db_session, rollback_setup) -> None:
    user, cs = rollback_setup
    svc = ChangeSetService(db_session)
    cs.status = "PLAN_READY"
    db_session.commit()
    with pytest.raises(HTTPException) as exc:
        svc.rollback(cs.id, user.id)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_start_act_creates_patch(db_session, monkeypatch) -> None:
    user = User(
        id=str(uuid.uuid4()),
        email=f"act-{uuid.uuid4().hex[:6]}@test.com",
        password_hash="hash",
        role="USER",
    )
    repo = Repository(
        id=str(uuid.uuid4()),
        owner_user_id=user.id,
        repo_id="org/act",
        remote_url="https://github.com/org/act.git",
        local_path="/tmp/act",
        default_branch="main",
    )
    chat = ChatSession(id=str(uuid.uuid4()), user_id=user.id, repository_id=repo.id, session_mode="PLAN")
    db_session.add_all([user, repo, chat])
    db_session.commit()

    svc = ChangeSetService(db_session)
    cs = svc.create_or_update_plan(
        repository_id=repo.id,
        chat_session_id=chat.id,
        user_id=user.id,
        plan_json={"summary": "Add file", "steps": [{"id": "1", "title": "Add", "files": ["a.py"], "description": "x"}]},
        plan_markdown="# Plan",
    )
    svc.approve(cs.id, user.id, user.email)

    diff = """```diff
diff --git a/a.py b/a.py
--- a/a.py
+++ b/a.py
@@ -0,0 +1 @@
+print('hi')
```"""

    class FakeQS:
        @staticmethod
        def extract_patch_from_text(text):
            return "diff --git a/a.py b/a.py\n--- a/a.py\n+++ b/a.py\n@@ -0,0 +1 @@\n+print('hi')"

        async def run(self, **kwargs):
            return {"answer": diff}

    monkeypatch.setattr(
        "app.services.change_set_service.ChangeSetService._validate_patch_internal",
        lambda self, repository_id, patch_id: "APPROVED",
    )

    updated = await svc.start_act(
        cs.id,
        user.id,
        FakeQS(),
        repo_row={"id": repo.id, "repo_id": repo.repo_id, "latest_indexed_commit": "HEAD"},
    )
    assert updated.patch_id is not None
    assert updated.status == "PATCH_APPROVED"
