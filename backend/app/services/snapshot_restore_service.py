from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import ActPatchDraft, Repository
from app.services.repository_cache import resolve_repository_workspace

logger = logging.getLogger(__name__)


class SnapshotRestoreService:
    """Restore repository workspace files to pre-apply state using git."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def restore_pre_apply(self, patch: ActPatchDraft) -> None:
        repo = self.session.query(Repository).filter(Repository.id == patch.repository_id).first()
        if not repo:
            raise ValueError("Repository not found")

        workspace = resolve_repository_workspace(str(repo.repo_id or repo.id), repo.local_path)
        if workspace is None or not workspace.exists():
            raise ValueError("Repository workspace not found on disk")

        restore_sha = patch.applied_commit_sha_before or patch.base_commit_sha
        if not restore_sha:
            raise ValueError("No base commit to restore")

        for pf in patch.patch_files:
            path = pf.file_path
            if pf.action == "ADDED":
                target = workspace / path
                if target.exists():
                    target.unlink()
                continue

            cmd = ["git", "-C", str(workspace), "show", f"{restore_sha}:{path}"]
            result = subprocess.run(cmd, capture_output=True)
            if result.returncode != 0:
                logger.warning("restore - git show failed path=%s sha=%s", path, restore_sha)
                continue

            target = workspace / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(result.stdout)

        logger.info(
            "restore_pre_apply - completed patch_id=%s sha=%s files=%s",
            patch.id,
            restore_sha,
            len(patch.patch_files),
        )
