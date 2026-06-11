import logging
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.services.sandbox_manager import SandboxManager

logger = logging.getLogger(__name__)

class PatchLifecycleService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.sandbox_manager = SandboxManager()

    def cleanup_expired_drafts(self) -> int:
        """
        Queries and purges expired ACT patch drafts and their associated worktrees.
        Returns the number of deleted patch drafts.
        """
        now = datetime.now(timezone.utc)
        expired_drafts = self.session.execute(
            text(
                """
                SELECT id, repository_id FROM act_patch_drafts
                WHERE expires_at <= :now AND status IN ('DRAFT', 'REVIEW', 'FAILED', 'REJECTED', 'CONFLICTED')
                """
            ),
            {"now": now}
        ).mappings().all()

        if not expired_drafts:
            return 0

        deleted_count = 0
        for draft in expired_drafts:
            patch_id = draft["id"]
            repo_id = draft["repository_id"]

            try:
                # Resolve cache repository path to locate the parent worktree DB
                repo_row = self.session.execute(
                    text("SELECT local_path FROM repositories WHERE id = :rid"),
                    {"rid": repo_id}
                ).mappings().first()
                
                cache_path = Path(repo_row["local_path"]) if repo_row and repo_row["local_path"] else None

                if cache_path and cache_path.exists():
                    self.sandbox_manager.destroy_sandbox(patch_id, cache_path)
                
                # Delete the record
                self.session.execute(
                    text("DELETE FROM act_patch_drafts WHERE id = :id"),
                    {"id": patch_id}
                )
                deleted_count += 1
            except Exception as exc:
                logger.error(f"Failed to cleanup expired patch {patch_id}: {exc}")

        if deleted_count > 0:
            self.session.commit()
            logger.info(f"Purged {deleted_count} expired patch drafts.")

        return deleted_count
