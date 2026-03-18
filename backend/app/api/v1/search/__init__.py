from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_repository_access, get_current_user
from app.db.database import get_db_session
from app.models.api_models import SearchRequest, SearchResponse
from app.rag.retrieval.hybrid import hybrid_retrieve

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
def search(
    req: SearchRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> SearchResponse:
    ensure_repository_access(session, req.repo_id, current_user["id"])
    try:
        results = hybrid_retrieve(session, repo_id=req.repo_id, query=req.query, top_k=req.top_k)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return SearchResponse(results=results)
