"""Tests for snapshot restore service."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from app.db.models import ActPatchDraft, ActPatchFile, Repository, User
from app.services.snapshot_restore_service import SnapshotRestoreService


@pytest.fixture
def patch_setup(db_session, tmp_path):
    user = User(
        id=str(uuid.uuid4()),
        email=f"restore-{uuid.uuid4().hex[:6]}@test.com",
        password_hash="hash",
        role="USER",
    )
    repo_path = tmp_path / "repo"
    repo_path.mkdir()
    (repo_path / "src").mkdir()
    (repo_path / "src" / "main.py").write_text("new content", encoding="utf-8")

    repo = Repository(
        id=str(uuid.uuid4()),
        owner_user_id=user.id,
        repo_id="org/restore",
        remote_url="https://github.com/org/restore.git",
        local_path=str(repo_path),
        default_branch="main",
    )
    db_session.add_all([user, repo])
    db_session.flush()

    patch_id = str(uuid.uuid4())
    draft = ActPatchDraft(
        id=patch_id,
        repository_id=repo.id,
        base_commit_sha="abc123",
        status="APPLIED",
        applied_commit_sha_before="abc123",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db_session.add(draft)
    db_session.add(
        ActPatchFile(
            patch_id=patch_id,
            file_path="src/main.py",
            action="MODIFIED",
            file_diff="--- a/src/main.py\n+++ b/src/main.py",
        )
    )
    db_session.commit()
    return draft, repo_path


def test_restore_deletes_added_files(db_session, patch_setup, tmp_path) -> None:
    draft, repo_path = patch_setup
    added = repo_path / "src" / "new.py"
    added.write_text("added", encoding="utf-8")

    draft.patch_files[0].action = "ADDED"
    draft.patch_files[0].file_path = "src/new.py"
    db_session.commit()

    svc = SnapshotRestoreService(db_session)
    svc.restore_pre_apply(draft)
    assert not added.exists()


def test_restore_pre_apply_writes_git_content(db_session, patch_setup) -> None:
    draft, repo_path = patch_setup
    svc = SnapshotRestoreService(db_session)

    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = b"original content"
        svc.restore_pre_apply(draft)

    content = (repo_path / "src" / "main.py").read_text(encoding="utf-8")
    assert content == "original content"
    mock_run.assert_called_once()
