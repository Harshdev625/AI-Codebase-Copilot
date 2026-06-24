from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import assert_scopes, ensure_repository_access_by_id, get_current_user
from app.core.api_response import success_response
from app.db.database import get_db_session
from app.services.change_set_service import ChangeSetService
from app.services.plan_parser import parse_plan_from_text
from app.services.query_service import QueryService

router = APIRouter(tags=["change-sets"])


class UpdatePlanPayload(BaseModel):
    plan_json: dict[str, Any]
    plan_markdown: str | None = None


class RevisePlanPayload(BaseModel):
    feedback: str = Field(..., min_length=2, max_length=4000)


@router.get("")
def list_change_sets(
    session_id: str | None = None,
    repository_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"chat:query"})
    service = ChangeSetService(session)
    if session_id:
        row = service.get_for_session(session_id=session_id, user_id=str(current_user["id"]))
        if not row:
            return success_response(None)
        return success_response(service.to_response(row))
    raise HTTPException(status_code=400, detail="session_id query parameter is required")


@router.get("/{change_set_id}")
def get_change_set(
    change_set_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"chat:query"})
    service = ChangeSetService(session)
    row = service.get_by_id(change_set_id, str(current_user["id"]))
    return success_response(service.to_response(row))


@router.patch("/{change_set_id}/plan")
def update_plan(
    change_set_id: str,
    payload: UpdatePlanPayload,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"chat:query"})
    service = ChangeSetService(session)
    row = service.update_plan_manual(
        change_set_id,
        str(current_user["id"]),
        payload.plan_json,
        payload.plan_markdown,
    )
    return success_response(service.to_response(row))


@router.post("/{change_set_id}/revise")
async def revise_plan(
    change_set_id: str,
    payload: RevisePlanPayload,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"chat:query"})
    service = ChangeSetService(session)
    row = service.get_by_id(change_set_id, str(current_user["id"]))
    if row.status not in {"PLAN_READY", "PLAN_APPROVED", "PATCH_REJECTED"}:
        raise HTTPException(status_code=409, detail=f"Cannot revise plan in status {row.status}")

    repo_row = ensure_repository_access_by_id(session, row.repository_id, current_user["id"])
    query_service = QueryService(session)

    revise_query = (
        f"Revise the implementation plan based on this feedback:\n{payload.feedback}\n\n"
        f"Current plan:\n{row.plan_markdown or ''}"
    )
    result = await query_service.run(
        repository_id=str(repo_row["id"]),
        repo_id=str(repo_row.get("repo_id") or repo_row["id"]),
        query=revise_query,
        user_id=str(current_user["id"]),
        session_id=row.chat_session_id,
        chat_mode="PLAN",
    )
    plan_json, plan_markdown = parse_plan_from_text(str(result.get("answer") or ""))
    updated = service.create_or_update_plan(
        repository_id=row.repository_id,
        chat_session_id=row.chat_session_id,
        user_id=str(current_user["id"]),
        plan_json=plan_json,
        plan_markdown=plan_markdown or str(result.get("answer") or ""),
        source_message_id=None,
    )
    return success_response(service.to_response(updated))


@router.post("/{change_set_id}/approve")
def approve_plan(
    change_set_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"chat:query"})
    service = ChangeSetService(session)
    row = service.approve(change_set_id, str(current_user["id"]), str(current_user.get("email") or current_user["id"]))
    return success_response(service.to_response(row))


@router.post("/{change_set_id}/act")
async def start_act(
    change_set_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:write"})
    service = ChangeSetService(session)
    row = service.get_by_id(change_set_id, str(current_user["id"]))
    repo_row = ensure_repository_access_by_id(session, row.repository_id, current_user["id"])
    query_service = QueryService(session)
    updated = await service.start_act(
        change_set_id,
        str(current_user["id"]),
        query_service,
        repo_row=repo_row,
    )
    return success_response(service.to_response(updated))


@router.post("/{change_set_id}/cancel")
def cancel_change_set(
    change_set_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"chat:query"})
    service = ChangeSetService(session)
    row = service.cancel(change_set_id, str(current_user["id"]))
    return success_response(service.to_response(row))


@router.post("/{change_set_id}/rollback")
def rollback_change_set(
    change_set_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> dict:
    assert_scopes(current_user, {"repository:write"})
    service = ChangeSetService(session)
    row = service.rollback(change_set_id, str(current_user["id"]))
    return success_response(service.to_response(row))
