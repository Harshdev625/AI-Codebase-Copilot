import logging
import subprocess
import hashlib
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.models import ActPatchDraft

logger = logging.getLogger(__name__)

class ConflictService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def detect_drift(self, repository_id: str, patch_draft: ActPatchDraft) -> bool:
        """
        Before apply:
        * verify repository HEAD still matches patch base assumptions
        * validate commit ancestry
        * detect patch drift
        If drift detected, status = CONFLICTED and block apply.
        """
        # Fetch repository info
        repo_row = self.session.execute(
            text("SELECT local_path, latest_indexed_commit FROM repositories WHERE id = :id"),
            {"id": repository_id}
        ).mappings().first()
        
        if not repo_row:
            logger.warning(f"Repository {repository_id} not found during conflict check.")
            patch_draft.status = "CONFLICTED"
            self.session.commit()
            return True

        local_path_str = repo_row["local_path"]
        latest_indexed_commit = repo_row["latest_indexed_commit"]
        base_commit_sha = patch_draft.base_commit_sha

        # 1. Verify Repository HEAD on disk / DB matches base assumptions
        current_head_sha = latest_indexed_commit

        if local_path_str:
            repo_path = Path(local_path_str)
            if repo_path.exists() and (repo_path / ".git").exists():
                # Run git rev-parse HEAD to get current HEAD SHA on disk
                cmd = ["git", "-C", str(repo_path), "rev-parse", "HEAD"]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if res.returncode == 0:
                    current_head_sha = res.stdout.strip()

        # If current HEAD on disk / DB doesn't match base commit sha, we must validate ancestry
        if current_head_sha != base_commit_sha:
            logger.info(f"Repository HEAD {current_head_sha} does not match patch base {base_commit_sha}. Checking ancestry...")
            
            # 2. Validate commit ancestry
            if local_path_str:
                repo_path = Path(local_path_str)
                if repo_path.exists() and (repo_path / ".git").exists():
                    # Run git merge-base --is-ancestor <base_commit_sha> <current_head_sha>
                    ancestry_cmd = ["git", "-C", str(repo_path), "merge-base", "--is-ancestor", base_commit_sha, current_head_sha]
                    res_ancestry = subprocess.run(ancestry_cmd, capture_output=True, timeout=120)
                    if res_ancestry.returncode != 0:
                        logger.warning(f"Commit ancestry validation failed: {base_commit_sha} is not an ancestor of {current_head_sha}")
                        patch_draft.status = "CONFLICTED"
                        self.session.commit()
                        return True
                else:
                    # In tests / mocked path, if we can't run git commands, we check if the DB has moved and assume conflict
                    logger.warning("Repository path does not exist or is not a git repository. Assuming conflict due to mismatched commit SHAs.")
                    patch_draft.status = "CONFLICTED"
                    self.session.commit()
                    return True
            else:
                logger.warning("Local path not configured. Assuming conflict.")
                patch_draft.status = "CONFLICTED"
                self.session.commit()
                return True

        # 3. Detect patch drift (verify actual file hashes match expected content_hash_before)
        for pf in patch_draft.patch_files:
            file_path = None
            if local_path_str:
                file_path = Path(local_path_str) / pf.file_path

            # Get hash from database
            db_file_row = self.session.execute(
                text("SELECT hash FROM repository_files WHERE repository_id = :rid AND path = :path"),
                {"rid": repository_id, "path": pf.file_path}
            ).mappings().first()
            db_hash = db_file_row["hash"] if db_file_row else None

            # Get hash from disk if it exists
            disk_hash = None
            if file_path and file_path.exists():
                try:
                    raw = file_path.read_text(encoding="utf-8", errors="ignore")
                    disk_hash = hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()
                except Exception as e:
                    logger.warning(f"Could not compute disk hash for {pf.file_path}: {e}")

            # Check if there is drift
            # If the patch action is ADDED, the file shouldn't exist in DB / disk with different content
            if pf.action == "ADDED":
                if db_hash is not None or disk_hash is not None:
                    logger.warning(f"Drift detected: action is ADDED but file {pf.file_path} already exists.")
                    patch_draft.status = "CONFLICTED"
                    self.session.commit()
                    return True
            else:
                # MODIFIED or DELETED: before hash must match current state
                expected_before = pf.content_hash_before
                # Match disk first (since disk represents the actual workspace), then DB
                actual_hash = disk_hash if disk_hash is not None else db_hash
                if actual_hash != expected_before:
                    logger.warning(
                        f"Drift detected on file {pf.file_path}: "
                        f"expected base hash {expected_before}, but found {actual_hash}."
                    )
                    patch_draft.status = "CONFLICTED"
                    self.session.commit()
                    return True

        logger.info("Conflict check passed: no drift detected.")
        return False

