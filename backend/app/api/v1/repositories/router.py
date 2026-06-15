from __future__ import annotations

import json
import logging
from typing import Any
from datetime import datetime, timezone
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import (
    PaginationParams,
    assert_scopes,
    ensure_repository_access,
    ensure_repository_access_by_id,
    get_current_user,
    get_pagination,
    resolve_pagination,
)
from app.core.api_response import paginated_success_response, success_response
from app.db.database import get_db_session
from app.models.api_models import (
    AddRepositoryRequest,
    IndexRequest,
    IndexResponse,
    RepositoryResponse,
    SnapshotResponse,
    SnapshotUpdateRequest,
    RepositoryFileResponse,
    ContextTokensRequest,
)
from . import service

router = APIRouter(tags=["repositories"])
logger = logging.getLogger(__name__)

def _safe_count_from_result(result: Any) -> int:
    scalar_fn = getattr(result, "scalar", None)
    if callable(scalar_fn):
        try:
            value = scalar_fn()
            return int(value or 0)
        except Exception:
            pass

    mappings_fn = getattr(result, "mappings", None)
    if callable(mappings_fn):
        mapped = mappings_fn()
        first_fn = getattr(mapped, "first", None)
        if callable(first_fn):
            row = first_fn()
            if isinstance(row, dict) and row:
                first_value = next(iter(row.values()))
                try:
                    return int(first_value or 0)
                except Exception:
                    return 0

    first_fn = getattr(result, "first", None)
    if callable(first_fn):
        row = first_fn()
        if isinstance(row, (list, tuple)) and row:
            try:
                return int(row[0] or 0)
            except Exception:
                return 0

    return 0


def _to_payload(row: dict) -> dict:
    payload = dict(row)
    created_at = payload.get("created_at")
    if created_at is not None and hasattr(created_at, "isoformat"):
        payload["created_at"] = created_at.isoformat()

    latest_stats = payload.get("latest_job_stats")
    if latest_stats is None:
        latest_stats = payload.get("latest_index_stats")
    if isinstance(latest_stats, str):
        try:
            latest_stats = json.loads(latest_stats)
        except json.JSONDecodeError:
            latest_stats = {}
    if latest_stats is None:
        latest_stats = {}
    payload["latest_job_stats"] = latest_stats
    payload["latest_index_stats"] = latest_stats

    latest_job_status = payload.get("latest_job_status")
    if latest_job_status is not None:
        payload["latest_index_status"] = latest_job_status

    indexed_chunks = latest_stats.get("indexed_chunks") if isinstance(latest_stats, dict) else None
    payload["latest_indexed_chunks"] = indexed_chunks if isinstance(indexed_chunks, int) else None

    return payload

@router.get("/projects")
def list_projects(
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Projects are disabled in the simplified schema.")

@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Projects are disabled in the simplified schema.")

@router.delete("/projects/{project_id}", status_code=status.HTTP_200_OK)
def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Projects are disabled in the simplified schema.")

@router.get("/projects/{project_id}/repositories")
def list_repositories(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Project repositories are disabled in the simplified schema.")

@router.post("/projects/{project_id}/repositories", status_code=status.HTTP_201_CREATED)
def add_repository(
    project_id: str,
    req: AddRepositoryRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    raise HTTPException(status_code=410, detail="Project repositories are disabled in the simplified schema.")

@router.post("/index", status_code=status.HTTP_202_ACCEPTED)
def index_repo(
    req: IndexRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"indexing:write"})
    logger.info("index_start - request repository_id=%s", req.repository_id)

    if req.repository_id:
        repository_row = ensure_repository_access_by_id(session, req.repository_id, current_user["id"])
    else:
        repository_row = ensure_repository_access(session, req.repo_id, current_user["id"])

    try:
        queued = service.queue_repository_indexing(
            session,
            repository_row=repository_row,
            commit_sha=req.commit_sha,
            repo_path=req.repo_path,
            repo_url=req.repo_url,
            repo_ref=req.repo_ref,
            source="manual",
            prevent_duplicate_commit=False,
            full_reindex=bool(req.full_reindex),
        )
    except service.IndexingAlreadyRunningError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("index_start - queue dispatch failed repository_id=%s", repository_row["id"])
        raise HTTPException(status_code=503, detail="Failed to enqueue indexing job") from exc

    return success_response(
        IndexResponse(indexed_chunks=0, indexing_job_id=queued["indexing_job_id"]).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )

@router.get("/index/progress/{indexing_job_id}")
def get_index_progress(
    indexing_job_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    data = service.get_index_job_progress(
        session,
        indexing_job_id=indexing_job_id,
        user_id=str(current_user["id"]),
    )
    if not data:
        raise HTTPException(status_code=404, detail="Indexing job not found")
    return success_response(data)
@router.get("/indexing-jobs")
def list_indexing_jobs(
    repository_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    from app.db.models import IndexingJob, Repository
    
    query = session.query(IndexingJob).join(Repository)
    query = query.filter(Repository.owner_user_id == current_user["id"])
    if repository_id:
        query = query.filter(IndexingJob.repository_id == repository_id)
        
    jobs = query.order_by(IndexingJob.created_at.desc()).limit(100).all()
    
    payload = []
    for j in jobs:
        payload.append({
            "id": j.id,
            "repository_id": j.repository_id,
            "status": j.status,
            "message": j.message,
            "commit_sha": j.commit_sha,
            "trigger_type": j.trigger_type,
            "priority": j.priority,
            "files_indexed": j.files_indexed,
            "files_skipped": j.files_skipped,
            "chunks_created": j.chunks_created,
            "errors": j.errors,
            "stats": j.stats,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "finished_at": j.finished_at.isoformat() if j.finished_at else None,
            "created_at": j.created_at.isoformat(),
            "updated_at": j.updated_at.isoformat(),
        })
        
    return success_response(payload)


@router.get("/repositories")
def list_user_repositories(
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(get_pagination),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    pagination = resolve_pagination(pagination)
    total_result = session.execute(
        text("SELECT COUNT(*) AS total FROM repositories WHERE owner_user_id = :user_id"),
        {"user_id": current_user["id"]},
    )
    total = _safe_count_from_result(total_result)
    repos = service.get_repositories_for_user(
        session,
        user_id=str(current_user["id"]),
        limit=pagination.limit,
        offset=pagination.offset,
    )
    payload = [RepositoryResponse(**_to_payload(r)).model_dump() for r in repos]
    return paginated_success_response(
        items=payload,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post("/repositories", status_code=status.HTTP_201_CREATED)
def add_user_repository(
    req: AddRepositoryRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:write"})
    repo = service.add_repository_for_user(
        session,
        owner_user_id=str(current_user["id"]),
        repo_id=req.repo_id,
        remote_url=req.remote_url,
        local_path=req.local_path,
        default_branch=req.default_branch,
    )
    return success_response(
        RepositoryResponse(**_to_payload(repo)).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )


@router.delete("/repositories/{repository_id}")
def delete_user_repository(
    repository_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:write"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])
    service.soft_delete_repository(
        session,
        repository_id=repository_id,
        user_id=str(current_user["id"]),
    )
    return success_response({"deleted": True})


# ---------------------------------------------------------------------------
# ACT Patch Draft
# ---------------------------------------------------------------------------

@router.get("/repositories/{repository_id}/patches")
def list_patches(
    repository_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """List all patches for a repository."""
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])
    
    from app.db.models import ActPatchDraft
    patches = session.query(ActPatchDraft).filter(ActPatchDraft.repository_id == repository_id).order_by(ActPatchDraft.created_at.desc()).all()
    
    return success_response([{
        "id": p.id,
        "repository_id": p.repository_id,
        "base_commit_sha": p.base_commit_sha,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "validation_logs": p.validation_logs
    } for p in patches])

@router.get("/repositories/{repository_id}/patches/{patch_id}")
def get_patch(
    repository_id: str,
    patch_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Get a specific patch."""
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])
    
    from app.db.models import ActPatchDraft
    patch = session.query(ActPatchDraft).filter(
        ActPatchDraft.id == patch_id,
        ActPatchDraft.repository_id == repository_id
    ).first()
    
    if not patch:
        raise HTTPException(status_code=404, detail="Patch not found")

    import subprocess
    from app.db.models import Repository
    from app.services.repository_cache import resolve_repository_workspace

    repo = session.query(Repository).filter(Repository.id == repository_id).first()
    base_sha = patch.base_commit_sha or ""

    def _fetch_original(file_path: str) -> str:
        """Best-effort: read the file at base_commit_sha from the local repo cache."""
        if not base_sha or not repo:
            return ""
        repo_id_str = repo.repo_id or repository_id
        cache_path = resolve_repository_workspace(repo_id_str, repo.local_path)
        if not cache_path:
            return ""
        cmd = ["git", "-C", str(cache_path), "show", f"{base_sha}:{file_path}"]
        try:
            res = subprocess.run(cmd, capture_output=True, timeout=10)
            if res.returncode == 0:
                return res.stdout.decode("utf-8", errors="replace")
        except Exception:
            pass
        return ""

    patch_files = [
        {
            "path": f.file_path,
            "action": f.action,
            "original_content": _fetch_original(f.file_path) if f.action != "create" else "",
            "modified_content": f.file_diff,
            "file_diff": f.file_diff,
        }
        for f in patch.patch_files
    ]

    return success_response({
        "id": patch.id,
        "repository_id": patch.repository_id,
        "base_commit_sha": patch.base_commit_sha,
        "status": patch.status,
        "created_at": patch.created_at.isoformat() if patch.created_at else None,
        "validation_logs": patch.validation_logs,
        "patch_files": patch_files,
    })

# ---------------------------------------------------------------------------
# Snapshots
# ---------------------------------------------------------------------------

@router.get("/repositories/{repository_id}/snapshots")
def list_snapshots(
    repository_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    rows = session.execute(
        text(
            """
            SELECT id, repository_id, commit_sha, indexed_at,
                   files_count, chunks_count, files_skipped, is_pinned, is_release
            FROM repository_snapshots
            WHERE repository_id = :repository_id
            ORDER BY indexed_at DESC
            LIMIT 100
            """
        ),
        {"repository_id": repository_id},
    ).mappings().all()

    items = []
    for row in rows:
        d = dict(row)
        if d.get("indexed_at") and hasattr(d["indexed_at"], "isoformat"):
            d["indexed_at"] = d["indexed_at"].isoformat()
        items.append(SnapshotResponse(**d).model_dump())

    return success_response({"snapshots": items, "total": len(items)})


@router.patch("/repositories/{repository_id}/snapshots/{snapshot_id}")
def update_snapshot(
    repository_id: str,
    snapshot_id: str,
    req: SnapshotUpdateRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Pin/unpin, mark a snapshot as a release, or update status."""
    assert_scopes(current_user, {"repository:write"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    updates: list[str] = []
    params: dict = {"id": snapshot_id, "repository_id": repository_id}

    if req.is_pinned is not None:
        updates.append("is_pinned = :is_pinned")
        params["is_pinned"] = req.is_pinned
    if req.is_release is not None:
        updates.append("is_release = :is_release")
        params["is_release"] = req.is_release
    if req.status is not None:
        updates.append("status = :status")
        params["status"] = req.status

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    session.execute(
        text(f"UPDATE repository_snapshots SET {', '.join(updates)} WHERE id = :id AND repository_id = :repository_id"),
        params,
    )
    session.commit()
    return success_response({"updated": True})


# ---------------------------------------------------------------------------
# File Content
# ---------------------------------------------------------------------------

@router.get("/repositories/{repository_id}/file")
def get_file_content(
    repository_id: str,
    path: str,
    commit_sha: str | None = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Return raw file content using git show {commit_sha}:{path}.
    """
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Path traversal not allowed")

    from app.db.models import Repository, IndexingJob
    repo = session.query(Repository).filter(Repository.id == repository_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    target_commit = commit_sha
    if not target_commit:
        job = session.query(IndexingJob).filter(
            IndexingJob.repository_id == repository_id,
            IndexingJob.status == 'completed'
        ).order_by(IndexingJob.created_at.desc()).first()
        if not job:
            raise HTTPException(status_code=404, detail="No indexed commit found")
        target_commit = job.commit_sha

    import subprocess
    from pathlib import Path
    from app.services.repository_cache import resolve_repository_workspace

    repo_id_str = repo.repo_id or repository_id
    cache_path = resolve_repository_workspace(repo_id_str, repo.local_path)

    if not cache_path:
        raise HTTPException(status_code=404, detail="Repository cache not found on disk")

    cmd = ["git", "-C", str(cache_path), "show", f"{target_commit}:{path}"]
    res = subprocess.run(cmd, capture_output=True)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        if "exists on disk, but not in" in err or "does not exist in" in err or "Not a valid object name" in err or "Path" in err:
            raise HTTPException(status_code=404, detail=f"File '{path}' not found in commit {target_commit}")
        raise HTTPException(status_code=500, detail=f"Failed to read file: {err}")

    content = res.stdout.decode("utf-8", errors="replace")
    ext = path.split(".")[-1] if "." in path else ""

    return success_response({
        "path": path,
        "content": content,
        "language": ext,
        "size_bytes": len(res.stdout)
    })

# ---------------------------------------------------------------------------
# File Tree
# ---------------------------------------------------------------------------

@router.get("/repositories/{repository_id}/tree")
def get_file_tree(
    repository_id: str,
    path: str | None = None,
    limit: int = 100,
    cursor: str | None = None,
    snapshot_id: str | None = None,
    patch_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Return lazy tree entries (directories and files) directly under `path`.
    Cursor-paginated and sorted alphabetically. Supports historical snapshots.
    """
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    if patch_id:
        from app.db.models import ActPatchDraft, ActPatchFile, SnapshotFile, RepositoryFile, RepositorySnapshot
        
        # 1. Verify patch draft exists and is accessible
        patch_draft = session.query(ActPatchDraft).filter(
            ActPatchDraft.id == patch_id,
            ActPatchDraft.repository_id == repository_id
        ).first()
        if not patch_draft:
            raise HTTPException(status_code=404, detail="Patch draft not found")

        # 2. Get baseline files
        base_files = []
        if snapshot_id:
            snap = session.query(RepositorySnapshot).filter(
                RepositorySnapshot.id == snapshot_id,
                RepositorySnapshot.repository_id == repository_id
            ).first()
            if not snap:
                raise HTTPException(status_code=404, detail="Snapshot not found")
            files_rows = session.query(SnapshotFile).filter(SnapshotFile.snapshot_id == snapshot_id).all()
            for f in files_rows:
                base_files.append({
                    "path": f.path,
                    "type": f.file_type or "FILE",
                    "size_bytes": f.size_bytes or 0,
                    "hash": f.content_hash,
                    "extension": f.path.split(".")[-1] if "." in f.path else None
                })
        else:
            files_rows = session.query(RepositoryFile).filter(
                RepositoryFile.repository_id == repository_id,
                RepositoryFile.type == "FILE"
            ).all()
            for f in files_rows:
                base_files.append({
                    "path": f.path,
                    "type": f.type,
                    "size_bytes": f.size_bytes or 0,
                    "hash": f.hash,
                    "extension": f.extension
                })

        # 3. Load patch files overlay
        patch_files = session.query(ActPatchFile).filter(ActPatchFile.patch_id == patch_id).all()
        patch_map = {f.file_path: f for f in patch_files}

        # 4. Compute overlay
        overlay_files = {}
        for f in base_files:
            p_file = patch_map.get(f["path"])
            if p_file:
                if p_file.action == "DELETED":
                    continue
                elif p_file.action == "MODIFIED":
                    f["hash"] = p_file.content_hash_after
                    overlay_files[f["path"]] = f
            else:
                overlay_files[f["path"]] = f

        for f_path, p_file in patch_map.items():
            if p_file.action == "ADDED":
                overlay_files[f_path] = {
                    "path": f_path,
                    "type": "FILE",
                    "size_bytes": 0,
                    "hash": p_file.content_hash_after,
                    "extension": f_path.split(".")[-1] if "." in f_path else None
                }

        # 5. Segment logic (nested directories under prefix path)
        prefix = path.strip("/") + "/" if path else ""
        prefix_len = len(prefix)

        items_map = {}
        for f_path, f in overlay_files.items():
            if not f_path.startswith(prefix):
                continue
            rel_path = f_path[prefix_len:]
            if not rel_path:
                continue

            if "/" in rel_path:
                dir_name = rel_path.split("/")[0]
                full_dir_path = f"{path}/{dir_name}" if path else dir_name
                if dir_name not in items_map:
                    items_map[dir_name] = {
                        "id": f"dir_{repository_id}_{full_dir_path}",
                        "path": full_dir_path,
                        "type": "DIRECTORY",
                        "extension": None,
                        "size_bytes": None,
                        "status": "INDEXED"
                    }
            else:
                if rel_path not in items_map:
                    items_map[rel_path] = {
                        "id": f"file_patch_{patch_id}_{f_path}",
                        "path": f_path,
                        "type": "FILE",
                        "extension": f["extension"],
                        "size_bytes": f["size_bytes"],
                        "status": "INDEXED"
                    }

        sorted_names = sorted(items_map.keys())

        cursor_name = None
        if cursor:
            try:
                import base64
                cursor_name = base64.b64decode(cursor.encode("utf-8")).decode("utf-8")
            except Exception:
                pass

        if cursor_name:
            filtered_names = [name for name in sorted_names if name > cursor_name]
        else:
            filtered_names = sorted_names

        paginated_names = filtered_names[:limit]
        items = [items_map[name] for name in paginated_names]

        next_cursor = None
        if len(filtered_names) > limit:
            last_name = paginated_names[-1]
            import base64
            next_cursor = base64.b64encode(last_name.encode("utf-8")).decode("utf-8")

        return success_response({
            "items": items,
            "next_cursor": next_cursor
        })

    if snapshot_id:
        from app.db.models import RepositorySnapshot, SnapshotFile
        snap = session.query(RepositorySnapshot).filter(
            RepositorySnapshot.id == snapshot_id,
            RepositorySnapshot.repository_id == repository_id
        ).first()
        if not snap:
            raise HTTPException(status_code=404, detail="Snapshot not found")
            
        # Browse historical repository states from snapshot_files
        query = session.query(SnapshotFile).filter(SnapshotFile.snapshot_id == snapshot_id)
        if path:
            prefix = path.strip("/") + "/"
            files = query.filter(SnapshotFile.path.like(prefix + "%")).all()
        else:
            prefix = ""
            files = query.all()
            
        items_map = {}
        for f in files:
            rel_path = f.path[len(prefix):]
            if "/" in rel_path:
                dir_name = rel_path.split("/")[0]
                full_dir_path = f"{path}/{dir_name}" if path else dir_name
                if dir_name not in items_map:
                    items_map[dir_name] = {
                        "id": f"dir_{repository_id}_{full_dir_path}",
                        "path": full_dir_path,
                        "type": "DIRECTORY",
                        "extension": None,
                        "size_bytes": None,
                        "status": "INDEXED"
                    }
            else:
                if rel_path not in items_map:
                    items_map[rel_path] = {
                        "id": f"file_{snapshot_id}_{f.path}",
                        "path": f.path,
                        "type": f.file_type or "FILE",
                        "extension": rel_path.split(".")[-1] if "." in rel_path else None,
                        "size_bytes": f.size_bytes or 0,
                        "status": "INDEXED"
                    }
                    
        sorted_names = sorted(items_map.keys())
        
        cursor_name = None
        if cursor:
            try:
                import base64
                cursor_name = base64.b64decode(cursor.encode("utf-8")).decode("utf-8")
            except Exception:
                pass
                
        if cursor_name:
            filtered_names = [name for name in sorted_names if name > cursor_name]
        else:
            filtered_names = sorted_names
            
        paginated_names = filtered_names[:limit]
        items = [items_map[name] for name in paginated_names]
        
        next_cursor = None
        if len(filtered_names) > limit:
            last_name = paginated_names[-1]
            import base64
            next_cursor = base64.b64encode(last_name.encode("utf-8")).decode("utf-8")
            
        return success_response({
            "items": items,
            "next_cursor": next_cursor
        })

    is_sqlite = (session.bind.dialect.name == "sqlite")
    find_func = "instr" if is_sqlite else "strpos"

    if path:
        path = path.strip("/")

    if path:
        prefix = path + "/"
        prefix_len = len(prefix) + 1
        like_pattern = prefix + "%"
        
        subq = f"""
            SELECT DISTINCT
              CASE
                WHEN {find_func}(substr(path, :prefix_len), '/') = 0 THEN substr(path, :prefix_len)
                ELSE substr(substr(path, :prefix_len), 1, {find_func}(substr(path, :prefix_len), '/') - 1)
              END as name,
              CASE
                WHEN {find_func}(substr(path, :prefix_len), '/') = 0 THEN 'FILE'
                ELSE 'DIRECTORY'
              END as type
            FROM repository_files
            WHERE repository_id = :repository_id AND path LIKE :like_pattern
        """
        params = {
            "repository_id": repository_id,
            "prefix_len": prefix_len,
            "like_pattern": like_pattern,
        }
    else:
        subq = f"""
            SELECT DISTINCT
              CASE
                WHEN {find_func}(path, '/') = 0 THEN path
                ELSE substr(path, 1, {find_func}(path, '/') - 1)
              END as name,
              CASE
                WHEN {find_func}(path, '/') = 0 THEN 'FILE'
                ELSE 'DIRECTORY'
              END as type
            FROM repository_files
            WHERE repository_id = :repository_id
        """
        params = {
            "repository_id": repository_id,
        }

    cursor_name = None
    if cursor:
        try:
            import base64
            cursor_name = base64.b64decode(cursor.encode("utf-8")).decode("utf-8")
        except Exception:
            pass

    if cursor_name:
        cursor_where = "WHERE name > :cursor_name"
        params["cursor_name"] = cursor_name
    else:
        cursor_where = ""

    outer_sql = f"""
        SELECT name, type FROM ({subq}) AS subq
        {cursor_where}
        ORDER BY name ASC
        LIMIT :limit
    """
    params["limit"] = limit

    rows = session.execute(text(outer_sql), params).mappings().all()

    items = []
    file_names = []
    for row in rows:
        name = row["name"]
        item_type = row["type"]
        
        full_path = f"{path}/{name}" if path else name
        if item_type == "DIRECTORY":
            items.append({
                "id": f"dir_{repository_id}_{full_dir_path}" if 'full_dir_path' in locals() else f"dir_{repository_id}_{full_path}",
                "path": full_path,
                "type": "DIRECTORY",
                "extension": None,
                "size_bytes": None,
                "status": "INDEXED"
            })
        else:
            file_names.append(name)

    if file_names:
        file_paths = [f"{path}/{name}" if path else name for name in file_names]
        placeholders = ", ".join(f":f_{i}" for i in range(len(file_paths)))
        file_params = {f"f_{i}": fp for i, fp in enumerate(file_paths)}
        file_params["repository_id"] = repository_id
        
        file_rows = session.execute(
            text(
                f"""
                SELECT id, path, type, extension, size_bytes, status
                FROM repository_files
                WHERE repository_id = :repository_id AND path IN ({placeholders})
                """
            ),
            file_params
        ).mappings().all()
        
        file_map = {row["path"]: row for row in file_rows}
        for name in file_names:
            full_path = f"{path}/{name}" if path else name
            if full_path in file_map:
                f_row = file_map[full_path]
                items.append({
                    "id": f_row["id"],
                    "path": f_row["path"],
                    "type": "FILE",
                    "extension": f_row["extension"],
                    "size_bytes": f_row["size_bytes"],
                    "status": f_row["status"]
                })
            else:
                items.append({
                    "id": f"file_{repository_id}_{full_path}",
                    "path": full_path,
                    "type": "FILE",
                    "extension": name.split(".")[-1] if "." in name else None,
                    "size_bytes": 0,
                    "status": "INDEXED"
                })

    items.sort(key=lambda x: x["path"])

    next_cursor = None
    if len(rows) == limit:
        last_name = rows[-1]["name"]
        import base64
        next_cursor = base64.b64encode(last_name.encode("utf-8")).decode("utf-8")

    return success_response({
        "items": items,
        "next_cursor": next_cursor
    })


@router.get("/repositories/{repository_id}/snapshots/{snapshot_id}/diff")
def get_snapshot_diff(
    repository_id: str,
    snapshot_id: str,
    compare_with: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Compare files between two historical snapshots with hash-based rename detection."""
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])
    
    from app.db.models import RepositorySnapshot, SnapshotFile
    
    snap_a = session.query(RepositorySnapshot).filter(
        RepositorySnapshot.id == snapshot_id,
        RepositorySnapshot.repository_id == repository_id
    ).first()
    
    snap_b = session.query(RepositorySnapshot).filter(
        RepositorySnapshot.id == compare_with,
        RepositorySnapshot.repository_id == repository_id
    ).first()
    
    if not snap_a or not snap_b:
        raise HTTPException(status_code=404, detail="One or both snapshots not found")
        
    files_a = session.query(SnapshotFile).filter(SnapshotFile.snapshot_id == snapshot_id).all()
    files_b = session.query(SnapshotFile).filter(SnapshotFile.snapshot_id == compare_with).all()
    
    map_a = {f.path: f for f in files_a}
    map_b = {f.path: f for f in files_b}
    
    paths_a = set(map_a.keys())
    paths_b = set(map_b.keys())
    
    added_paths = paths_b - paths_a
    removed_paths = paths_a - paths_b
    common_paths = paths_a & paths_b
    
    modified = []
    for path in common_paths:
        if map_a[path].content_hash != map_b[path].content_hash:
            modified.append(path)
            
    # Rename detection based on hash equality only
    added_by_hash = {}
    for path in added_paths:
        h = map_b[path].content_hash
        if h:
            added_by_hash.setdefault(h, []).append(path)
            
    renamed = []
    matched_added = set()
    for path in sorted(removed_paths):
        h = map_a[path].content_hash
        if h and h in added_by_hash:
            candidates = sorted(added_by_hash[h])
            for cand in candidates:
                if cand not in matched_added:
                    renamed.append({"from": path, "to": cand})
                    matched_added.add(cand)
                    break
                    
    matched_removed = {r["from"] for r in renamed}
    true_added = sorted(list(added_paths - matched_added))
    true_removed = sorted(list(removed_paths - matched_removed))
    
    return success_response({
        "added": true_added,
        "removed": true_removed,
        "modified": sorted(modified),
        "renamed": renamed
    })


@router.get("/repositories/{repository_id}/insights")
def get_insights(
    repository_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Return skip counts, size breakdowns, languages, indexing health, etc."""
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])
    
    insights = service.get_repository_insights(session, repository_id)
    return success_response(insights)


@router.post("/{repository_id}/context-tokens")
def get_context_tokens(
    repository_id: str,
    request: ContextTokensRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """Calculate exact token sizes for requested context scope."""
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])
    
    # Simple heuristic to calculate token counts based on repository file sizes.
    # 1 token ~= 4 bytes of code roughly.
    total_tokens = 0
    attached_tokens = 0
    scope_tokens = 0
    retrieval_tokens = 0
    
    # 1. Attached files exact size
    if request.attached_files:
        attached_size = session.execute(
            text("SELECT SUM(size_bytes) as s FROM repository_files WHERE repository_id = :rid AND path IN :paths AND status = 'INDEXED'"),
            {"rid": repository_id, "paths": tuple(request.attached_files)}
        ).mappings().first()["s"] or 0
        attached_tokens = int(attached_size / 4)
        
    # 2. Scope paths exact size
    if request.scope_paths:
        scope_conditions = " OR ".join([f"path LIKE :path_{i}" for i in range(len(request.scope_paths))])
        params = {"rid": repository_id}
        for i, p in enumerate(request.scope_paths):
            params[f"path_{i}"] = f"{p}%"
        
        scope_size = session.execute(
            text(f"SELECT SUM(size_bytes) as s FROM repository_files WHERE repository_id = :rid AND ({scope_conditions}) AND status = 'INDEXED'"),
            params
        ).mappings().first()["s"] or 0
        scope_tokens = int(scope_size / 4)
        
    # 3. Retrieval estimate
    if request.retrieval_query:
        # Typical retrieval fetches top 10 chunks of ~512 tokens each
        retrieval_tokens = 5120
        
    # Total repository exact size as baseline
    repo_total_size = session.execute(
        text("SELECT SUM(size_bytes) as s FROM repository_files WHERE repository_id = :rid AND status = 'INDEXED'"),
        {"rid": repository_id}
    ).mappings().first()["s"] or 0
    repo_total_tokens = int(repo_total_size / 4)
    
    total_tokens = attached_tokens + scope_tokens + retrieval_tokens
    
    # If no scope and no attached files, the context is effectively using the retrieval limit plus full repo scope potential
    if not request.scope_paths and not request.attached_files:
        total_tokens = repo_total_tokens
        
    return success_response({
        "attached_tokens": attached_tokens,
        "scope_tokens": scope_tokens,
        "retrieval_tokens": retrieval_tokens,
        "total_tokens": total_tokens,
        "repository_total_tokens": repo_total_tokens,
        "max_tokens": 200000
    })


# ---------------------------------------------------------------------------
# Context Persistence & Budgeting
# ---------------------------------------------------------------------------

class ContextEntryCreate(BaseModel):
    repository_id: str
    path: str
    entry_type: str  # 'FILE' | 'CHUNK'
    token_count: int
    is_pinned: bool = False
    priority: int = 0
    expires_at: datetime | None = None


def prune_session_context(session: Session, session_id: str):
    MAX_SESSION_TOKENS = 120000
    TARGET_TOKENS = 96000  # 80% of 120000
    
    from app.db.models import RepositoryContextEntry
    from sqlalchemy import func

    now = datetime.now(timezone.utc)
    # 1. Remove expired entries first
    session.query(RepositoryContextEntry).filter(
        RepositoryContextEntry.session_id == session_id,
        RepositoryContextEntry.expires_at <= now
    ).delete(synchronize_session=False)
    session.commit()

    # 2. Check total tokens
    total_tokens = session.query(func.sum(RepositoryContextEntry.token_count)).filter(
        RepositoryContextEntry.session_id == session_id
    ).scalar() or 0

    if total_tokens <= MAX_SESSION_TOKENS:
        return

    # 3. Retrieve non-pinned context entries, sorted by priority ASC, created_at ASC
    entries = session.query(RepositoryContextEntry).filter(
        RepositoryContextEntry.session_id == session_id,
        RepositoryContextEntry.is_pinned == False
    ).order_by(
        RepositoryContextEntry.priority.asc(),
        RepositoryContextEntry.created_at.asc()
    ).all()

    to_delete = []
    current_tokens = total_tokens
    for entry in entries:
        if current_tokens <= TARGET_TOKENS:
            break
        to_delete.append(entry.id)
        current_tokens -= entry.token_count

    if to_delete:
        session.query(RepositoryContextEntry).filter(
            RepositoryContextEntry.id.in_(to_delete)
        ).delete(synchronize_session=False)
        session.commit()


@router.post("/sessions/{session_id}/context")
def add_context_entry(
    session_id: str,
    payload: ContextEntryCreate,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, payload.repository_id, current_user["id"])

    from app.db.models import RepositoryContextEntry
    
    # 1. Persist the new context entry
    entry = RepositoryContextEntry(
        session_id=session_id,
        repository_id=payload.repository_id,
        path=payload.path,
        entry_type=payload.entry_type,
        token_count=payload.token_count,
        is_pinned=payload.is_pinned,
        priority=payload.priority,
        expires_at=payload.expires_at
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)

    # 2. Extract all attributes into a dict before pruning so we don't get ObjectDeletedError
    entry_data = {
        "id": entry.id,
        "session_id": entry.session_id,
        "repository_id": entry.repository_id,
        "path": entry.path,
        "entry_type": entry.entry_type,
        "token_count": entry.token_count,
        "is_pinned": entry.is_pinned,
        "priority": entry.priority,
        "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None
    }

    # 3. Run context budgeting pruning logic
    prune_session_context(session, session_id)

    return success_response(entry_data)


@router.delete("/sessions/{session_id}/context/{entry_id}")
def delete_context_entry(
    session_id: str,
    entry_id: int,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    
    from app.db.models import RepositoryContextEntry
    entry = session.query(RepositoryContextEntry).filter(
        RepositoryContextEntry.id == entry_id,
        RepositoryContextEntry.session_id == session_id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Context entry not found")
        
    ensure_repository_access_by_id(session, entry.repository_id, current_user["id"])

    session.delete(entry)
    session.commit()
    return success_response({"deleted": True})


@router.get("/sessions/{session_id}/context")
def get_context_entries(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    
    from app.db.models import RepositoryContextEntry
    entries = session.query(RepositoryContextEntry).filter(
        RepositoryContextEntry.session_id == session_id
    ).order_by(RepositoryContextEntry.created_at.asc()).all()

    repo_ids = {entry.repository_id for entry in entries}
    for rid in repo_ids:
        ensure_repository_access_by_id(session, rid, current_user["id"])

    items = []
    for entry in entries:
        items.append({
            "id": entry.id,
            "session_id": entry.session_id,
            "repository_id": entry.repository_id,
            "path": entry.path,
            "entry_type": entry.entry_type,
            "token_count": entry.token_count,
            "is_pinned": entry.is_pinned,
            "priority": entry.priority,
            "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
            "created_at": entry.created_at.isoformat() if entry.created_at else None
        })
        
    return success_response({"entries": items})


from pydantic import BaseModel
from typing import List, Optional

class PatchFilePayload(BaseModel):
    file_path: str
    action: str  # 'ADDED' | 'MODIFIED' | 'DELETED'
    file_diff: str
    content_hash_before: Optional[str] = None
    content_hash_after: Optional[str] = None

class CreatePatchPayload(BaseModel):
    base_commit_sha: str
    patch_files: List[PatchFilePayload]


@router.post("/repositories/{repository_id}/patches", status_code=status.HTTP_201_CREATED)
def create_patch(
    repository_id: str,
    payload: CreatePatchPayload,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:write"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    from app.db.models import ActPatchDraft, ActPatchFile
    from datetime import datetime, timedelta
    import uuid

    patch_id = str(uuid.uuid4())
    draft = ActPatchDraft(
        id=patch_id,
        repository_id=repository_id,
        base_commit_sha=payload.base_commit_sha,
        status="DRAFT",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )
    session.add(draft)

    for pf in payload.patch_files:
        db_file = ActPatchFile(
            patch_id=patch_id,
            file_path=pf.file_path,
            action=pf.action,
            file_diff=pf.file_diff,
            content_hash_before=pf.content_hash_before,
            content_hash_after=pf.content_hash_after
        )
        session.add(db_file)

    session.commit()
    return success_response({
        "patch_id": patch_id,
        "status": "DRAFT",
        "created_at": draft.created_at.isoformat()
    }, status_code=status.HTTP_201_CREATED)


@router.post("/repositories/{repository_id}/patches/{patch_id}/validate")
def validate_patch(
    repository_id: str,
    patch_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:write"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    from app.db.models import ActPatchDraft, Repository
    from app.services.sandbox_manager import SandboxManager
    from app.services.validation_engine import ValidationEngine
    from pathlib import Path

    draft = session.query(ActPatchDraft).filter(
        ActPatchDraft.id == patch_id,
        ActPatchDraft.repository_id == repository_id
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Patch draft not found")

    repo = session.query(Repository).filter(Repository.id == repository_id).first()
    if not repo or not repo.local_path:
        raise HTTPException(status_code=400, detail="Repository local path not configured")

    sandbox_manager = SandboxManager()
    validation_engine = ValidationEngine()

    draft.status = "REVIEW"
    session.commit()

    sandbox_path = None
    try:
        sandbox_path = sandbox_manager.create_sandbox(
            patch_id=patch_id,
            repository_path=Path(repo.local_path),
            commit_sha=draft.base_commit_sha
        )
        # Apply patch files
        sandbox_manager.apply_patch_files(sandbox_path, draft.patch_files)
        
        modified_files = [f.file_path for f in draft.patch_files]
        success, logs = validation_engine.validate_patch(
            sandbox_path=sandbox_path,
            patch_id=patch_id,
            modified_files=modified_files
        )

        draft.status = "APPROVED" if success else "REJECTED"
        draft.validation_logs = logs
        session.commit()
    except Exception as exc:
        draft.status = "REJECTED"
        draft.validation_logs = f"Validation exception occurred: {str(exc)}"
        session.commit()
    finally:
        if sandbox_path:
            try:
                sandbox_manager.destroy_sandbox(patch_id, Path(repo.local_path))
            except Exception:
                pass

    return success_response({
        "patch_id": patch_id,
        "status": draft.status,
        "validation_logs": draft.validation_logs
    })


@router.post("/repositories/{repository_id}/patches/{patch_id}/apply")
def apply_patch(
    repository_id: str,
    patch_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:write"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    from app.db.models import ActPatchDraft, Repository, RepositorySnapshot
    from app.services.conflict_service import ConflictService
    from app.services.sandbox_manager import SandboxManager
    from app.services.indexing_helpers import create_snapshot
    from pathlib import Path
    from datetime import datetime
    import subprocess

    draft = session.query(ActPatchDraft).filter(
        ActPatchDraft.id == patch_id,
        ActPatchDraft.repository_id == repository_id
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Patch draft not found")

    # Conflict check
    conflict_service = ConflictService(session)
    if conflict_service.detect_drift(repository_id, draft):
        draft.status = "CONFLICTED"
        session.commit()
        raise HTTPException(status_code=409, detail="Conflict detected, apply blocked.")

    repo = session.query(Repository).filter(Repository.id == repository_id).first()
    if not repo or not repo.local_path:
        raise HTTPException(status_code=400, detail="Repository local path not configured")

    cache_path = Path(repo.local_path)

    # 1. Resolve pre-apply snapshot
    pre_snap = session.query(RepositorySnapshot).filter(
        RepositorySnapshot.repository_id == repository_id,
        RepositorySnapshot.commit_sha == draft.base_commit_sha
    ).first()
    
    pre_snap_id = pre_snap.id if pre_snap else None
    if not pre_snap_id:
        pre_snap_id = create_snapshot(
            session, repository_id=repository_id, commit_sha=draft.base_commit_sha,
            files_count=0, files_skipped=0, chunks_count=0
        )

    sandbox_manager = SandboxManager()
    try:
        # Apply the patch directly to repository cache
        sandbox_manager.apply_patch_files(cache_path, draft.patch_files)

        # Get local commit or mock SHA to represent post-patch state
        cmd = ["git", "-C", str(cache_path), "rev-parse", "HEAD"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        head_sha = res.stdout.strip() if res.returncode == 0 else "local-patch-sha"
        post_commit_sha = f"{head_sha}-patched-{patch_id[:8]}"

        # Generate post-apply snapshot
        files_count = len(draft.patch_files)
        post_snap_id = create_snapshot(
            session, repository_id=repository_id, commit_sha=post_commit_sha,
            files_count=files_count, files_skipped=0, chunks_count=files_count
        )

        draft.status = "APPLIED"
        draft.applied_at = datetime.now(timezone.utc)
        draft.applied_by = current_user["email"]
        draft.applied_commit_sha_before = draft.base_commit_sha
        draft.pre_apply_snapshot_id = pre_snap_id
        draft.post_apply_snapshot_id = post_snap_id
        
        # Patch chunk lifecycle cleanup
        # Delete related patch chunks
        session.execute(
            text("DELETE FROM patch_chunks WHERE patch_id = :pid"),
            {"pid": patch_id}
        )
        
        # Delete Qdrant vectors
        try:
            from app.services.qdrant_service import QdrantService
            QdrantService().delete_points_by_patch(patch_id)
        except Exception as e:
            logger.warning(f"Failed to delete Qdrant points for patch {patch_id}: {e}")

        # Trigger cache re-indexing (dead code removed)
        try:
            service.queue_repository_indexing(
                session,
                repository_row={"id": repository_id, "repo_id": repo.repo_id, "remote_url": repo.remote_url, "default_branch": repo.default_branch, "local_path": repo.local_path},
                commit_sha=post_commit_sha,
                repo_path=str(cache_path),
                repo_url=repo.remote_url,
                repo_ref=repo.default_branch,
                source="manual"
            )
        except Exception as e:
            logger.warning(f"Failed to queue indexing during patch apply: {e}")

        session.commit()
    except Exception as exc:
        draft.status = "FAILED"
        draft.validation_logs = f"Apply error: {str(exc)}"
        session.commit()
        raise HTTPException(status_code=500, detail=f"Failed to apply patch: {str(exc)}")

    return success_response({
        "patch_id": patch_id,
        "status": "APPLIED"
    })


class RetrieveRepositoryPayload(BaseModel):
    query: str
    top_k: Optional[int] = 8
    scope_paths: Optional[List[str]] = None
    patch_id: Optional[str] = None


class RetrieveProjectPayload(BaseModel):
    query: str
    top_k: Optional[int] = 10
    repository_ids: List[str]


@router.post("/repositories/{repository_id}/retrieve")
def retrieve_repository_endpoint(
    repository_id: str,
    payload: RetrieveRepositoryPayload,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    from app.rag.retrieval.hybrid import hybrid_retrieve
    try:
        items = hybrid_retrieve(
            session,
            repository_id=repository_id,
            query=payload.query,
            top_k=payload.top_k,
            scope_paths=payload.scope_paths,
            patch_id=payload.patch_id
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(exc)}")

    return success_response({"items": items})


@router.post("/projects/{project_id}/retrieve")
def retrieve_project_endpoint(
    project_id: str,
    payload: RetrieveProjectPayload,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:read"})
    for rid in payload.repository_ids:
        ensure_repository_access_by_id(session, rid, current_user["id"])

    from app.rag.retrieval.hybrid import project_federated_retrieve
    try:
        items = project_federated_retrieve(
            session,
            repository_ids=payload.repository_ids,
            query=payload.query,
            top_k=payload.top_k
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Project retrieval failed: {str(exc)}")

    return success_response({"items": items})


# ---------------------------------------------------------------------------
# ACT Patch Draft — Cancel / Delete
# ---------------------------------------------------------------------------

@router.delete(
    "/repositories/{repository_id}/patches/{patch_id}",
    status_code=status.HTTP_200_OK,
)
def cancel_patch_draft(
    repository_id: str,
    patch_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Cancel and permanently delete an ACT patch draft.

    - 404 if the patch does not exist or belongs to another repository.
    - 409 if the patch has already been applied (status == 'APPLIED').
    - On success: removes sandbox worktree, deletes Qdrant vectors, deletes
      patch_chunks and the ActPatchDraft record (cascades to patch_files).
    """
    assert_scopes(current_user, {"repository:write"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

    from app.db.models import ActPatchDraft
    from app.services.sandbox_manager import SandboxManager
    from app.services.qdrant_service import QdrantService

    patch: ActPatchDraft | None = (
        session.query(ActPatchDraft)
        .filter(
            ActPatchDraft.id == patch_id,
            ActPatchDraft.repository_id == repository_id,
        )
        .first()
    )

    if patch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patch draft {patch_id} not found for repository {repository_id}.",
        )

    if patch.status == "APPLIED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Patch draft {patch_id} has already been applied and cannot be deleted.",
        )

    # 1. Collect Qdrant point IDs from patch_chunks before deletion
    qdrant_ids = [
        chunk.qdrant_point_id
        for chunk in patch.patch_chunks
        if chunk.qdrant_point_id
    ]

    # 2. Remove Qdrant vectors (best-effort; don't block deletion on failure)
    if qdrant_ids:
        try:
            QdrantService().delete_points_by_ids(qdrant_ids)
        except Exception as exc:  # noqa: BLE001
            logging.getLogger(__name__).warning(
                "cancel_patch_draft - qdrant deletion failed patch_id=%s error=%s",
                patch_id,
                exc,
            )

    # 3. Destroy sandbox worktree (best-effort)
    repo_row = session.execute(
        text("SELECT local_path FROM repositories WHERE id = :id"),
        {"id": repository_id},
    ).mappings().first()

    if repo_row and repo_row["local_path"]:
        from pathlib import Path as _Path
        try:
            SandboxManager().destroy_sandbox(
                patch_id=patch_id,
                repository_path=_Path(repo_row["local_path"]),
            )
        except Exception as exc:  # noqa: BLE001
            logging.getLogger(__name__).warning(
                "cancel_patch_draft - worktree removal failed patch_id=%s error=%s",
                patch_id,
                exc,
            )

    # 4. Delete patch record (cascades to patch_files and patch_chunks via FK)
    session.delete(patch)
    session.commit()

    return success_response({"patch_id": patch_id, "status": "CANCELLED"})
