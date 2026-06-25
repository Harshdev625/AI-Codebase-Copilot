from __future__ import annotations

import logging
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import ActPatchDraft, ActPatchFile, AgentRun, ChangeSet, ChatSession, Message, Repository
from app.core.exceptions import LLMRequestError
from app.services.plan_parser import (
    plan_to_act_prompt,
    write_all_plan_artifacts,
    enrich_plan_json,
    collect_act_target_files,
    build_act_repair_prompt,
)
from app.utils.diff_utils import split_unified_diff

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = frozenset({"CANCELLED", "ROLLED_BACK", "APPLIED"})


class ChangeSetService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def _record_agent_run(
        self,
        *,
        user_id: str,
        repository_id: str,
        query: str,
        intent: str,
        status: str,
        change_set_id: str,
        plan_version: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        diagnostics: dict[str, Any] = {"change_set_id": change_set_id}
        if plan_version is not None:
            diagnostics["plan_version"] = plan_version
        if extra:
            diagnostics.update(extra)
        run = AgentRun(
            id=str(uuid.uuid4()),
            user_id=user_id,
            repository_id=repository_id,
            query=query[:2000],
            intent=intent,
            status=status,
            diagnostics=diagnostics,
            finished_at=datetime.now(timezone.utc),
        )
        self.session.add(run)

    def get_for_session(self, *, session_id: str, user_id: str) -> ChangeSet | None:
        return (
            self.session.query(ChangeSet)
            .filter(
                ChangeSet.chat_session_id == session_id,
                ChangeSet.user_id == user_id,
                ~ChangeSet.status.in_(list(TERMINAL_STATUSES)),
            )
            .order_by(ChangeSet.updated_at.desc())
            .first()
        )

    def get_by_id(self, change_set_id: str, user_id: str) -> ChangeSet:
        row = (
            self.session.query(ChangeSet)
            .filter(ChangeSet.id == change_set_id, ChangeSet.user_id == user_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Change set not found")
        return row

    def create_or_update_plan(
        self,
        *,
        repository_id: str,
        chat_session_id: str,
        user_id: str,
        plan_json: dict[str, Any],
        plan_markdown: str,
        source_message_id: str | None = None,
        query: str = "",
    ) -> ChangeSet:
        chat_session = (
            self.session.query(ChatSession)
            .filter(
                ChatSession.id == chat_session_id,
                ChatSession.user_id == user_id,
                ChatSession.is_deleted.is_(False),
            )
            .first()
        )
        if not chat_session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        existing = self.get_for_session(session_id=chat_session_id, user_id=user_id)
        now = datetime.now(timezone.utc)

        if existing and existing.status in {"PLANNING", "PLAN_READY", "PLAN_APPROVED", "PATCH_REJECTED"}:
            prior_status = existing.status
            existing.plan_json = plan_json
            existing.plan_markdown = plan_markdown
            existing.plan_version += 1
            existing.status = "PLAN_READY"
            existing.approved_at = None
            existing.approved_by = None
            if prior_status == "PATCH_REJECTED":
                existing.patch_id = None
            existing.source_message_id = source_message_id
            existing.updated_at = now
            row = existing
        else:
            row = ChangeSet(
                id=str(uuid.uuid4()),
                repository_id=repository_id,
                chat_session_id=chat_session_id,
                user_id=user_id,
                status="PLAN_READY",
                plan_version=1,
                plan_json=plan_json,
                plan_markdown=plan_markdown,
                source_message_id=source_message_id,
            )
            self.session.add(row)

        repo_row = self.session.query(Repository).filter(Repository.id == repository_id).first()
        repo_slug = str(repo_row.repo_id) if repo_row and repo_row.repo_id else repository_id
        plan_file_path, plan_json, _task_files = write_all_plan_artifacts(
            repo_slug=repo_slug,
            change_set_id=row.id,
            plan_version=row.plan_version,
            plan_json=plan_json,
            plan_markdown=plan_markdown,
            status=row.status,
            query=query,
        )
        row.plan_json = plan_json
        row.plan_file_path = plan_file_path

        meta = dict(chat_session.session_metadata or {})
        meta["active_change_set_id"] = row.id
        chat_session.session_metadata = meta

        self._record_agent_run(
            user_id=user_id,
            repository_id=repository_id,
            query="plan_update",
            intent="plan",
            status="PLAN_READY",
            change_set_id=row.id,
            plan_version=row.plan_version,
        )
        self.session.commit()
        self.session.refresh(row)
        return row

    def build_plan_followup_query(self, session_id: str, user_id: str, user_query: str) -> str:
        """Wrap a PLAN-mode chat message with the current plan for revision context."""
        row = self.get_for_session(session_id=session_id, user_id=user_id)
        if not row:
            return user_query
        plan_body = (row.plan_markdown or "").strip()
        if not plan_body and row.plan_json:
            plan_body = str(row.plan_json.get("summary") or "")
        if not plan_body:
            return user_query
        excerpt = plan_body[:12000]
        return (
            "Update the implementation plan based on the user's message. "
            "Use PLAN mode structure and include a machine-readable ```json block.\n\n"
            f"User message:\n{user_query.strip()}\n\n"
            f"Current plan (version {row.plan_version}):\n{excerpt}"
        )

    def update_plan_manual(
        self,
        change_set_id: str,
        user_id: str,
        plan_json: dict[str, Any],
        plan_markdown: str | None = None,
    ) -> ChangeSet:
        row = self.get_by_id(change_set_id, user_id)
        if row.status not in {"PLAN_READY", "PLAN_APPROVED"}:
            raise HTTPException(status_code=409, detail=f"Cannot edit plan in status {row.status}")
        row.plan_json = plan_json
        if plan_markdown is not None:
            row.plan_markdown = plan_markdown
        row.plan_version += 1
        if row.status == "PLAN_APPROVED":
            row.status = "PLAN_READY"
            row.approved_at = None
            row.approved_by = None
        row.updated_at = datetime.now(timezone.utc)
        repo_row = self.session.query(Repository).filter(Repository.id == row.repository_id).first()
        repo_slug = str(repo_row.repo_id) if repo_row and repo_row.repo_id else row.repository_id
        plan_file_path, updated_json, _task_files = write_all_plan_artifacts(
            repo_slug=repo_slug,
            change_set_id=row.id,
            plan_version=row.plan_version,
            plan_json=plan_json,
            plan_markdown=plan_markdown or row.plan_markdown or "",
            status=row.status,
        )
        row.plan_json = updated_json
        row.plan_file_path = plan_file_path
        self.session.commit()
        self.session.refresh(row)
        return row

    def approve(self, change_set_id: str, user_id: str, approved_by: str) -> ChangeSet:
        row = self.get_by_id(change_set_id, user_id)
        if row.status != "PLAN_READY":
            raise HTTPException(status_code=409, detail=f"Cannot approve plan in status {row.status}")
        row.status = "PLAN_APPROVED"
        row.approved_at = datetime.now(timezone.utc)
        row.approved_by = approved_by
        row.updated_at = datetime.now(timezone.utc)
        repo_row = self.session.query(Repository).filter(Repository.id == row.repository_id).first()
        repo_slug = str(repo_row.repo_id) if repo_row and repo_row.repo_id else row.repository_id
        plan_file_path, updated_json, _task_files = write_all_plan_artifacts(
            repo_slug=repo_slug,
            change_set_id=row.id,
            plan_version=row.plan_version,
            plan_json=row.plan_json or {},
            plan_markdown=row.plan_markdown or "",
            status=row.status,
        )
        row.plan_json = updated_json
        row.plan_file_path = plan_file_path
        self._record_agent_run(
            user_id=user_id,
            repository_id=row.repository_id,
            query="plan_approve",
            intent="approve",
            status="PLAN_APPROVED",
            change_set_id=row.id,
            plan_version=row.plan_version,
        )
        self.session.commit()
        self.session.refresh(row)
        return row

    def cancel(self, change_set_id: str, user_id: str) -> ChangeSet:
        row = self.get_by_id(change_set_id, user_id)
        if row.status in TERMINAL_STATUSES:
            raise HTTPException(status_code=409, detail="Change set already terminal")
        row.status = "CANCELLED"
        row.updated_at = datetime.now(timezone.utc)
        self.session.commit()
        self.session.refresh(row)
        return row

    def _diff_to_patch_files(self, diff: str) -> list[dict[str, str]]:
        per_file = split_unified_diff(diff)
        files: list[dict[str, str]] = []
        for path, file_diff in per_file.items():
            action = "MODIFIED"
            if "--- /dev/null" in file_diff or file_diff.lstrip().startswith("--- /dev/null"):
                action = "ADDED"
            elif "+++ /dev/null" in file_diff:
                action = "DELETED"
            files.append({"file_path": path, "action": action, "file_diff": file_diff})
        return files

    def _create_patch_draft(
        self,
        *,
        repository_id: str,
        base_commit_sha: str,
        diff: str,
    ) -> ActPatchDraft:
        patch_id = str(uuid.uuid4())
        draft = ActPatchDraft(
            id=patch_id,
            repository_id=repository_id,
            base_commit_sha=base_commit_sha,
            status="DRAFT",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        self.session.add(draft)
        for pf in self._diff_to_patch_files(diff):
            self.session.add(
                ActPatchFile(
                    patch_id=patch_id,
                    file_path=pf["file_path"],
                    action=pf["action"],
                    file_diff=pf["file_diff"],
                )
            )
        self.session.flush()
        return draft

    def _validate_patch_internal(self, repository_id: str, patch_id: str) -> str:
        from app.services.sandbox_manager import SandboxManager
        from app.services.validation_engine import ValidationEngine

        draft = (
            self.session.query(ActPatchDraft)
            .filter(ActPatchDraft.id == patch_id, ActPatchDraft.repository_id == repository_id)
            .first()
        )
        if not draft:
            raise HTTPException(status_code=404, detail="Patch draft not found")

        repo = self.session.query(Repository).filter(Repository.id == repository_id).first()
        if not repo or not repo.local_path:
            raise HTTPException(status_code=400, detail="Repository local path not configured")

        sandbox_manager = SandboxManager()
        validation_engine = ValidationEngine()
        draft.status = "REVIEW"
        self.session.flush()

        sandbox_path = None
        try:
            sandbox_path = sandbox_manager.create_sandbox(
                patch_id=patch_id,
                repository_path=Path(repo.local_path),
                commit_sha=draft.base_commit_sha,
            )
            sandbox_manager.apply_patch_files(sandbox_path, draft.patch_files)
            success, logs = validation_engine.validate_patch(
                sandbox_path=sandbox_path,
                patch_id=patch_id,
                modified_files=[f.file_path for f in draft.patch_files],
            )
            draft.status = "APPROVED" if success else "REJECTED"
            draft.validation_logs = logs
        except Exception as exc:
            draft.status = "REJECTED"
            draft.validation_logs = f"Validation exception: {exc}"
        finally:
            if sandbox_path:
                try:
                    sandbox_manager.destroy_sandbox(patch_id, Path(repo.local_path))
                except Exception:
                    pass
        self.session.flush()
        return draft.status

    async def start_act(
        self,
        change_set_id: str,
        user_id: str,
        query_service: Any,
        *,
        repo_row: dict[str, Any],
    ) -> ChangeSet:
        row = self.get_by_id(change_set_id, user_id)
        if row.status == "PATCH_REJECTED" and not row.patch_id:
            row.status = "PLAN_APPROVED"
            row.updated_at = datetime.now(timezone.utc)
            self.session.flush()
        if row.status != "PLAN_APPROVED":
            raise HTTPException(status_code=403, detail="Plan must be approved before ACT execution")

        row.status = "ACTING"
        row.updated_at = datetime.now(timezone.utc)
        self.session.flush()

        plan_json = enrich_plan_json(row.plan_json or {}, row.plan_markdown or "")
        act_query = plan_to_act_prompt(plan_json)
        repository_id = str(repo_row["id"])
        repo_id = str(repo_row.get("repo_id") or repository_id)

        act_scope_paths = collect_act_target_files(plan_json, row.plan_markdown or "")

        from app.services.repository_cache import resolve_act_file_paths, resolve_repository_workspace
        from app.services.query_service import _agent_debug_log

        workspace = resolve_repository_workspace(repo_id, repo_row.get("local_path"))
        resolved_paths = resolve_act_file_paths(
            act_scope_paths,
            workspace,
            local_path=repo_row.get("local_path"),
        )
        if resolved_paths:
            act_scope_paths = resolved_paths
        attached_files = act_scope_paths[:8] if act_scope_paths else None

        _agent_debug_log(
            location="change_set_service.py:start_act",
            message="ACT starting",
            data={
                "change_set_id": change_set_id,
                "raw_scope_paths": collect_act_target_files(plan_json, row.plan_markdown or ""),
                "resolved_scope_paths": act_scope_paths,
                "attached_files": attached_files or [],
                "plan_steps": len(plan_json.get("steps") or []),
                "workspace_found": bool(workspace),
            },
            hypothesis_id="H4-plan-files",
        )

        try:
            result = await query_service.run(
                repository_id=repository_id,
                repo_id=repo_id,
                query=act_query,
                user_id=user_id,
                session_id=row.chat_session_id,
                chat_mode="ACT",
                scope_paths=act_scope_paths or None,
                attached_files=attached_files,
            )
        except LLMRequestError as exc:
            row.status = "PLAN_APPROVED"
            self.session.commit()
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            row.status = "PLAN_APPROVED"
            self.session.commit()
            raise HTTPException(status_code=503, detail=f"ACT execution failed: {exc}") from exc

        patch_text = query_service.extract_patch_from_text(str(result.get("answer") or ""))
        if not patch_text:
            proposal = result.get("patch_proposal") or {}
            patch_text = str(proposal.get("diff") or "").strip()

        if not patch_text:
            repair_query = build_act_repair_prompt(
                act_query=act_query,
                invalid_response=str(result.get("answer") or ""),
            )
            _agent_debug_log(
                location="change_set_service.py:start_act",
                message="ACT retry with repair prompt",
                data={"answer_preview": str(result.get("answer") or "")[:500]},
                hypothesis_id="H5-repair-retry",
            )
            try:
                retry_result = await query_service.run(
                    repository_id=repository_id,
                    repo_id=repo_id,
                    query=repair_query,
                    user_id=user_id,
                    session_id=row.chat_session_id,
                    chat_mode="ACT",
                    scope_paths=act_scope_paths or None,
                    attached_files=attached_files,
                )
                result = retry_result
                patch_text = query_service.extract_patch_from_text(str(result.get("answer") or ""))
                if not patch_text:
                    proposal = result.get("patch_proposal") or {}
                    patch_text = str(proposal.get("diff") or "").strip()
            except (LLMRequestError, Exception):
                pass

        if not patch_text:
            row.status = "PLAN_APPROVED"
            self.session.commit()
            _agent_debug_log(
                location="change_set_service.py:start_act",
                message="ACT patch extraction failed",
                data={
                    "answer_preview": str(result.get("answer") or "")[:800],
                    "llm_fallback": bool(result.get("_llm_fallback")),
                },
                hypothesis_id="H3-extract-patch",
            )
            if result.get("_llm_fallback"):
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "ACT failed: the language model did not respond in time or was unavailable. "
                        "Try again, use a faster model, or increase OLLAMA_ACT_TIMEOUT_SECONDS."
                    ),
                )
            raise HTTPException(
                status_code=422,
                detail=(
                    "ACT mode did not produce a valid patch. "
                    "The model returned prose instead of a ```diff block. "
                    "Try Act again or revise the plan with clearer file targets."
                ),
            )

        base_sha = str(repo_row.get("latest_indexed_commit") or "HEAD")
        draft = self._create_patch_draft(
            repository_id=repository_id,
            base_commit_sha=base_sha,
            diff=patch_text,
        )
        row.patch_id = draft.id
        row.status = "PATCH_READY"
        self.session.flush()

        row.status = "VALIDATING"
        self.session.flush()
        patch_status = self._validate_patch_internal(repository_id, draft.id)
        row.status = "PATCH_APPROVED" if patch_status == "APPROVED" else "PATCH_REJECTED"

        self._record_agent_run(
            user_id=user_id,
            repository_id=repository_id,
            query=act_query[:500],
            intent="act",
            status=row.status,
            change_set_id=row.id,
            plan_version=row.plan_version,
            extra={"patch_id": draft.id, "patch_status": patch_status},
        )
        self.session.commit()
        self.session.refresh(row)
        return row

    def mark_applied(self, change_set_id: str, user_id: str) -> ChangeSet:
        row = self.get_by_id(change_set_id, user_id)
        if row.status != "PATCH_APPROVED":
            raise HTTPException(status_code=409, detail="Patch must be approved before marking applied")
        row.status = "APPLIED"
        row.updated_at = datetime.now(timezone.utc)
        if row.patch_id:
            patch = self.session.query(ActPatchDraft).filter(ActPatchDraft.id == row.patch_id).first()
            if patch:
                patch.status = "APPLIED"
        self._record_agent_run(
            user_id=user_id,
            repository_id=row.repository_id,
            query="apply",
            intent="apply",
            status="APPLIED",
            change_set_id=row.id,
            plan_version=row.plan_version,
            extra={"patch_id": row.patch_id},
        )
        self.session.commit()
        self.session.refresh(row)
        return row

    def rollback(self, change_set_id: str, user_id: str) -> ChangeSet:
        from app.services.snapshot_restore_service import SnapshotRestoreService

        row = self.get_by_id(change_set_id, user_id)
        if row.status != "APPLIED":
            raise HTTPException(status_code=409, detail="Only applied change sets can be rolled back")
        if not row.patch_id:
            raise HTTPException(status_code=409, detail="No patch linked to change set")

        patch = (
            self.session.query(ActPatchDraft)
            .filter(ActPatchDraft.id == row.patch_id)
            .first()
        )
        if not patch:
            raise HTTPException(status_code=404, detail="Patch not found")

        restore = SnapshotRestoreService(self.session)
        restore.restore_pre_apply(patch)

        patch.status = "ROLLED_BACK"
        row.status = "ROLLED_BACK"
        row.updated_at = datetime.now(timezone.utc)
        self._record_agent_run(
            user_id=user_id,
            repository_id=row.repository_id,
            query="rollback",
            intent="rollback",
            status="ROLLED_BACK",
            change_set_id=row.id,
            plan_version=row.plan_version,
            extra={"patch_id": row.patch_id},
        )
        self.session.commit()
        self.session.refresh(row)
        return row

    def to_response(self, row: ChangeSet) -> dict[str, Any]:
        patch_status = None
        if row.patch_id:
            patch = self.session.query(ActPatchDraft).filter(ActPatchDraft.id == row.patch_id).first()
            patch_status = patch.status if patch else None
        plan_json = enrich_plan_json(row.plan_json or {}, row.plan_markdown or "")
        plan_task_files: list[dict[str, Any]] = []
        for step in plan_json.get("steps") or []:
            if not isinstance(step, dict):
                continue
            sid = str(step.get("id") or "")
            plan_task_files.append(
                {
                    "id": sid,
                    "title": str(step.get("title") or f"Step {sid}"),
                    "path": step.get("task_file_path"),
                    "done": bool(step.get("done", False)),
                    "files": [str(f) for f in (step.get("files") or []) if f],
                    "description": str(step.get("description") or ""),
                }
            )
        return {
            "id": row.id,
            "repository_id": row.repository_id,
            "chat_session_id": row.chat_session_id,
            "status": row.status,
            "plan_version": row.plan_version,
            "plan_json": plan_json,
            "plan_markdown": row.plan_markdown,
            "plan_file_path": row.plan_file_path,
            "plan_task_files": plan_task_files,
            "source_message_id": row.source_message_id,
            "patch_id": row.patch_id,
            "patch_status": patch_status,
            "approved_at": row.approved_at.isoformat() if row.approved_at else None,
            "approved_by": row.approved_by,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
