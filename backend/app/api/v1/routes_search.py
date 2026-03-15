from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db_session
from app.models.api_models import SearchRequest, SearchResponse
from app.rag.retrieval.hybrid import hybrid_retrieve

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
def search(req: SearchRequest, session: Session = Depends(get_db_session)) -> SearchResponse:
    try:
        results = hybrid_retrieve(session, repo_id=req.repo_id, query=req.query, top_k=req.top_k)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return SearchResponse(results=results)
