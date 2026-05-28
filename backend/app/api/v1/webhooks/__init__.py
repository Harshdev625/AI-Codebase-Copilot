from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.repositories import service as repositories_service
from app.core.api_response import success_response
from app.core.config import settings
from app.db.database import get_db_session


router = APIRouter(tags=["webhooks"])
logger = logging.getLogger(__name__)


def _normalize_remote_url(value: str | None) -> str:
    if not value:
        return ""
    normalized = str(value).strip().lower()
    normalized = normalized.rstrip("/")
    if normalized.endswith(".git"):
        normalized = normalized[:-4]
    normalized = re.sub(r"^https?://", "", normalized)
    normalized = re.sub(r"^ssh://", "", normalized)
    normalized = normalized.replace("git@github.com:", "github.com/")
    normalized = normalized.replace("git@", "")
    return normalized


def _extract_branch(ref: str | None) -> str | None:
    if not ref:
        return None
    ref_value = str(ref).strip()
    if ref_value.startswith("refs/heads/"):
        return ref_value.replace("refs/heads/", "", 1)
    return ref_value or None


def _is_signature_valid(raw_body: bytes, signature_header: str | None, secret: str) -> bool:
    if not signature_header:
        return False
    if not signature_header.startswith("sha256="):
        return False
    provided = signature_header.split("=", 1)[1].strip()
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(provided, expected)


def _extract_index_requests(event: str, payload: dict) -> list[dict[str, str]]:
    repository = payload.get("repository") if isinstance(payload, dict) else {}
    repository = repository if isinstance(repository, dict) else {}
    repo_url = str(repository.get("clone_url") or repository.get("ssh_url") or repository.get("html_url") or "")
    repo_full_name = str(repository.get("full_name") or "")

    if event == "push":
        if payload.get("deleted"):
            return []
        commit_sha = str(payload.get("after") or "").strip()
        if not commit_sha or set(commit_sha) == {"0"}:
            return []
        branch = _extract_branch(payload.get("ref")) or str(repository.get("default_branch") or "main")
        return [
            {
                "repo_url": repo_url,
                "repo_full_name": repo_full_name,
                "repo_ref": branch,
                "commit_sha": commit_sha,
            }
        ]

    if event == "pull_request":
        action = str(payload.get("action") or "")
        pull_request = payload.get("pull_request") if isinstance(payload, dict) else {}
        pull_request = pull_request if isinstance(pull_request, dict) else {}
        if action != "closed" or not bool(pull_request.get("merged")):
            return []

        base = pull_request.get("base") if isinstance(pull_request.get("base"), dict) else {}
        head = pull_request.get("head") if isinstance(pull_request.get("head"), dict) else {}
        commit_sha = str(pull_request.get("merge_commit_sha") or head.get("sha") or "").strip()
        if not commit_sha:
            return []

        branch = str(base.get("ref") or repository.get("default_branch") or "main")
        return [
            {
                "repo_url": repo_url,
                "repo_full_name": repo_full_name,
                "repo_ref": branch,
                "commit_sha": commit_sha,
            }
        ]

    return []


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    session: Session = Depends(get_db_session),
) -> dict:
    secret = str(settings.github_webhook_secret or "").strip()
    if not secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub webhook is not configured")

    raw_body = await request.body()
    signature_header = request.headers.get("x-hub-signature-256")
    if not _is_signature_valid(raw_body, signature_header, secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    event = str(request.headers.get("x-github-event") or "").strip().lower()
    if not event:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing GitHub event header")

    try:
        payload = json.loads(raw_body.decode("utf-8") or "{}")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook payload") from exc

    if event == "ping":
        return success_response({"event": event, "received": True, "queued": 0, "skipped": 0})

    requests_to_index = _extract_index_requests(event, payload)
    if not requests_to_index:
        return success_response({"event": event, "received": True, "queued": 0, "skipped": 1})

    repo_rows = session.execute(
        text(
            """
            SELECT id, repo_id, remote_url, local_path, default_branch
            FROM repositories
            """
        )
    ).mappings().all()

    queued = 0
    skipped = 0
    failed = 0

    for item in requests_to_index:
        target_url = _normalize_remote_url(item.get("repo_url"))
        target_name = str(item.get("repo_full_name") or "").strip().lower()
        target_ref = str(item.get("repo_ref") or "").strip() or None
        target_sha = str(item.get("commit_sha") or "").strip()
        if not target_sha:
            skipped += 1
            continue

        matches: list[dict] = []
        for row in repo_rows:
            row_url = _normalize_remote_url(row.get("remote_url"))
            row_repo_id = str(row.get("repo_id") or "").strip().lower()
            if target_url and row_url and target_url == row_url:
                matches.append(dict(row))
                continue
            if target_name and row_repo_id == target_name:
                matches.append(dict(row))

        if not matches:
            skipped += 1
            continue

        for repository_row in matches:
            default_branch = str(repository_row.get("default_branch") or "").strip()
            if target_ref and default_branch and target_ref != default_branch:
                skipped += 1
                continue

            try:
                repositories_service.queue_repository_indexing(
                    session,
                    repository_row=repository_row,
                    commit_sha=target_sha,
                    repo_ref=target_ref,
                    source="github-webhook",
                    prevent_duplicate_commit=True,
                )
                queued += 1
            except repositories_service.IndexingAlreadyRunningError:
                skipped += 1
            except repositories_service.DuplicateCommitIndexingError:
                skipped += 1
            except Exception:
                session.rollback()
                logger.exception(
                    "webhook_dispatch - failed repository_id=%s commit=%s",
                    repository_row.get("id"),
                    target_sha,
                )
                failed += 1

    return success_response(
        {
            "event": event,
            "received": True,
            "queued": queued,
            "skipped": skipped,
            "failed": failed,
        }
    )
