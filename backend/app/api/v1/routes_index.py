from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db_session
from app.models.api_models import IndexRequest, IndexResponse
from app.services.indexing_service import IndexingService

router = APIRouter(tags=["index"])


@router.post("/index", response_model=IndexResponse)
def index_repo(req: IndexRequest, session: Session = Depends(get_db_session)) -> IndexResponse:
    try:
        total = IndexingService(session).index_repository(
            repo_id=req.repo_id,
            repo_path=req.repo_path,
            repo_url=req.repo_url,
            repo_ref=req.repo_ref,
            commit_sha=req.commit_sha,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return IndexResponse(indexed_chunks=total)
