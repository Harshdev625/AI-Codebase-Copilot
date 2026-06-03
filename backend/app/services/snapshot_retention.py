"""
snapshot_retention.py
---------------------
Background service that enforces per-repository snapshot retention policies.

Policy modes
------------
ALL           – keep every snapshot forever (no cleanup performed)
LAST_N        – keep the N most recent snapshots; always preserve pinned/release ones
IMPORTANT_ONLY – keep only pinned / release snapshots; purge everything else

Cleanup cascades to:
  • code_chunks    (via ON DELETE CASCADE on repository_id + commit_sha filter)
  • graph_nodes    (same)
  • graph_edges    (same, via graph_nodes FK)
  • Qdrant points  (via QdrantService.delete_points_by_ids on orphaned qdrant_point_ids)

The service is intended to be called periodically (e.g. once per hour) by a
background scheduler or a manual admin trigger.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.qdrant_service import QdrantService

logger = logging.getLogger(__name__)

VALID_MODES = {"ALL", "LAST_N", "IMPORTANT_ONLY"}


class SnapshotRetentionService:
    """Enforces snapshot retention policies for all repositories."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.qdrant = QdrantService()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_global_cleanup(self) -> dict[str, Any]:
        """
        Iterate over all repositories that have a non-ALL retention policy
        and enforce their cleanup rules.

        Returns a summary dict suitable for admin dashboard reporting.
        """
        rows = self.session.execute(
            text(
                """
                SELECT id, retain_snapshots_mode, retain_snapshot_count
                FROM repositories
                WHERE retain_snapshots_mode != 'ALL'
                """
            )
        ).mappings().all()

        total_deleted = 0
        errors: list[dict] = []

        for row in rows:
            try:
                deleted = self.enforce_retention(
                    repository_id=str(row["id"]),
                    mode=str(row["retain_snapshots_mode"]),
                    retain_count=int(row["retain_snapshot_count"] or 20),
                )
                total_deleted += deleted
                if deleted:
                    logger.info(
                        "retention_cleanup - repository_id=%s deleted=%s",
                        row["id"],
                        deleted,
                    )
            except Exception as exc:
                logger.error(
                    "retention_cleanup - failed repository_id=%s error=%s",
                    row["id"],
                    exc,
                )
                errors.append({"repository_id": str(row["id"]), "error": str(exc)})

        return {"repositories_processed": len(rows), "snapshots_deleted": total_deleted, "errors": errors}

    def enforce_retention(
        self,
        *,
        repository_id: str,
        mode: str,
        retain_count: int = 20,
    ) -> int:
        """
        Enforce the retention policy for a single repository.

        Returns the number of snapshots deleted.
        """
        if mode not in VALID_MODES:
            logger.warning("retention_enforce - unknown mode=%s, skipping repository_id=%s", mode, repository_id)
            return 0

        if mode == "ALL":
            return 0

        # Fetch all ACTIVE snapshots ordered by indexed_at DESC
        snapshots = self.session.execute(
            text(
                """
                SELECT id, commit_sha, is_pinned, is_release, indexed_at, status
                FROM repository_snapshots
                WHERE repository_id = :repository_id AND status = 'ACTIVE'
                ORDER BY indexed_at DESC
                """
            ),
            {"repository_id": repository_id},
        ).mappings().all()

        if not snapshots:
            return 0

        snapshots_to_delete: list[str] = []

        if mode == "IMPORTANT_ONLY":
            # Delete every snapshot that is neither pinned nor a release
            snapshots_to_delete = [
                str(s["id"])
                for s in snapshots
                if not s["is_pinned"] and not s["is_release"]
            ]

        elif mode == "LAST_N":
            # Always keep pinned / release snapshots
            protected_ids = {
                str(s["id"])
                for s in snapshots
                if s["is_pinned"] or s["is_release"]
            }
            # Among unpinned, keep only the most recent `retain_count`
            unpinned = [s for s in snapshots if str(s["id"]) not in protected_ids]
            eligible_for_deletion = unpinned[retain_count:]  # oldest ones
            snapshots_to_delete = [str(s["id"]) for s in eligible_for_deletion]

        if not snapshots_to_delete:
            return 0

        # Gather commit SHAs for the snapshots we're about to delete
        commit_shas_to_purge: list[str] = [
            str(s["commit_sha"])
            for s in snapshots
            if str(s["id"]) in set(snapshots_to_delete)
        ]

        self._purge_snapshot_data(repository_id, snapshots_to_delete, commit_shas_to_purge)
        return len(snapshots_to_delete)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _purge_snapshot_data(
        self,
        repository_id: str,
        snapshot_ids: list[str],
        commit_shas: list[str],
    ) -> None:
        """
        Delete code_chunks, graph data, and Qdrant points for a set of
        snapshot commit SHAs, then delete the snapshot rows themselves.

        Uses a safe two-phase approach:
          1. Collect Qdrant point IDs before deleting SQL rows.
          2. Delete from Qdrant.
          3. Delete from SQL (cascades to graph_edges via graph_nodes FK).
        """
        if not snapshot_ids or not commit_shas:
            return

        # --- Phase 1: Collect Qdrant point IDs ---
        qdrant_point_ids: list[str] = []
        try:
            # Build parameterised IN clause
            sha_params = {f"sha_{i}": sha for i, sha in enumerate(commit_shas)}
            sha_in_clause = ", ".join(f":sha_{i}" for i in range(len(commit_shas)))

            rows = self.session.execute(
                text(
                    f"""
                    SELECT qdrant_point_id
                    FROM code_chunks
                    WHERE repository_id = :repository_id
                      AND commit_sha IN ({sha_in_clause})
                      AND qdrant_point_id IS NOT NULL
                    """
                ),
                {"repository_id": repository_id, **sha_params},
            ).fetchall()
            qdrant_point_ids = [str(r[0]) for r in rows if r[0]]
        except Exception as exc:
            logger.warning(
                "retention_purge - failed to collect qdrant_point_ids repository_id=%s error=%s",
                repository_id,
                exc,
            )

        # --- Phase 2: Delete from Qdrant ---
        if qdrant_point_ids:
            try:
                self.qdrant.delete_points_by_ids(qdrant_point_ids)
                logger.info(
                    "retention_purge - qdrant deleted repository_id=%s points=%s",
                    repository_id,
                    len(qdrant_point_ids),
                )
            except Exception as exc:
                logger.error(
                    "retention_purge - qdrant deletion failed repository_id=%s error=%s",
                    repository_id,
                    exc,
                )
                # Non-fatal: SQL cleanup proceeds. A reconciliation job will
                # detect and clean orphaned Qdrant points later.
        # --- Phase 3: Transition code_chunks to PURGED status ---
        try:
            sha_params = {f"sha_{i}": sha for i, sha in enumerate(commit_shas)}
            sha_in_clause = ", ".join(f":sha_{i}" for i in range(len(commit_shas)))

            self.session.execute(
                text(
                    f"""
                    UPDATE code_chunks
                    SET status = 'PURGED', purged_at = CURRENT_TIMESTAMP, qdrant_point_id = NULL
                    WHERE repository_id = :repository_id
                      AND commit_sha IN ({sha_in_clause})
                    """
                ),
                {"repository_id": repository_id, **sha_params},
            )
        except Exception as exc:
            self.session.rollback()
            logger.error(
                "retention_purge - code_chunks transition to PURGED failed repository_id=%s error=%s",
                repository_id,
                exc,
            )
            raise

        # --- Phase 4: Soft-archive snapshot rows ---
        try:
            snap_params = {f"snap_{i}": sid for i, sid in enumerate(snapshot_ids)}
            snap_in_clause = ", ".join(f":snap_{i}" for i in range(len(snapshot_ids)))

            self.session.execute(
                text(f"UPDATE repository_snapshots SET status = 'ARCHIVED' WHERE id IN ({snap_in_clause})"),
                snap_params,
            )
            self.session.commit()
            logger.info(
                "retention_purge - complete repository_id=%s snapshots=%s chunks_shas=%s",
                repository_id,
                len(snapshot_ids),
                len(commit_shas),
            )
        except Exception as exc:
            self.session.rollback()
            logger.error(
                "retention_purge - snapshot soft-archival failed repository_id=%s error=%s",
                repository_id,
                exc,
            )
            raise
