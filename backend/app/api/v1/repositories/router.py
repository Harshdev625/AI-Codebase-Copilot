from __future__ import annotations

import json
import logging
from typing import Any
from datetime import datetime
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
# File Tree
# ---------------------------------------------------------------------------

@router.get("/repositories/{repository_id}/tree")
def get_file_tree(
    repository_id: str,
    path: str | None = None,
    limit: int = 100,
    cursor: str | None = None,
    snapshot_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Return lazy tree entries (directories and files) directly under `path`.
    Cursor-paginated and sorted alphabetically. Supports historical snapshots.
    """
    assert_scopes(current_user, {"repository:read"})
    ensure_repository_access_by_id(session, repository_id, current_user["id"])

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

    now = datetime.utcnow()
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
