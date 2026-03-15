from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db_session
from app.models.api_models import ChatRequest, ChatResponse
from app.services.query_service import QueryService

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, session: Session = Depends(get_db_session)) -> ChatResponse:
    try:
        result = QueryService(session).run(repo_id=req.repo_id, query=req.query)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ChatResponse(
        answer=result.get("answer", ""),
        intent=result.get("intent", "unknown"),
        sources=result.get("retrieved_context", []),
    )
