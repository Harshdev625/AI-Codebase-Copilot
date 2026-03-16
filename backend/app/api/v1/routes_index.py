import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db_session
from app.models.api_models import IndexRequest, IndexResponse
from app.services.indexing_service import IndexingService

router = APIRouter(tags=["index"])


@router.post("/index", response_model=IndexResponse)
def index_repo(req: IndexRequest, session: Session = Depends(get_db_session)) -> IndexResponse:
    snapshot_id = str(uuid.uuid4())
    indexing_job_id = str(uuid.uuid4())

    repository_row = session.execute(
        text("SELECT id FROM repositories WHERE repo_id = :repo_id LIMIT 1"),
        {"repo_id": req.repo_id},
    ).mappings().first()

    repository_db_id = repository_row["id"] if repository_row else None
    if repository_db_id is not None:
        session.execute(
            text(
                """
                INSERT INTO repository_snapshots (id, repository_id, commit_sha, branch, index_status)
                VALUES (:id, :repository_id, :commit_sha, :branch, 'running')
                """
            ),
            {
                "id": snapshot_id,
                "repository_id": repository_db_id,
                "commit_sha": req.commit_sha,
                "branch": req.repo_ref or "main",
            },
        )
        session.execute(
            text(
                """
                INSERT INTO indexing_jobs (id, repository_id, snapshot_id, status, message, started_at)
                VALUES (:id, :repository_id, :snapshot_id, 'running', 'Indexing started', NOW())
                """
            ),
            {
                "id": indexing_job_id,
                "repository_id": repository_db_id,
                "snapshot_id": snapshot_id,
            },
        )
        session.commit()

    try:
        total = IndexingService(session).index_repository(
            repo_id=req.repo_id,
            repo_path=req.repo_path,
            repo_url=req.repo_url,
            repo_ref=req.repo_ref,
            commit_sha=req.commit_sha,
        )
    except RuntimeError as exc:
        if repository_db_id is not None:
            session.execute(
                text(
                    """
                    UPDATE indexing_jobs
                    SET status = 'failed', message = :message, finished_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": indexing_job_id, "message": str(exc)},
            )
            session.execute(
                text(
                    """
                    UPDATE repository_snapshots
                    SET index_status = 'failed', stats = CAST(:stats AS jsonb), indexed_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": snapshot_id, "stats": json.dumps({"error": str(exc)})},
            )
            session.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if repository_db_id is not None:
        session.execute(
            text(
                """
                UPDATE indexing_jobs
                SET status = 'completed', message = :message, finished_at = NOW()
                WHERE id = :id
                """
            ),
            {"id": indexing_job_id, "message": f"Indexed {total} chunks"},
        )
        session.execute(
            text(
                """
                UPDATE repository_snapshots
                SET index_status = 'completed', stats = CAST(:stats AS jsonb), indexed_at = NOW()
                WHERE id = :id
                """
            ),
            {"id": snapshot_id, "stats": json.dumps({"indexed_chunks": total})},
        )
        session.commit()

    return IndexResponse(indexed_chunks=total)
