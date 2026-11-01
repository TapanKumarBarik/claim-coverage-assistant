"""Admin API: AI governance. What the system did, how often, and under which rules."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import services_of
from app.api.schemas import ErrorBody
from app.api.security import require_admin
from app.core.constants import ADMIN_PREFIX, Outcome, Tag
from app.governance.models import AiEvent, GovernancePolicy, GovernanceSummary

DEFAULT_WINDOW_HOURS = 24
MAX_WINDOW_HOURS = 24 * 30
DEFAULT_EVENT_LIMIT = 100
MAX_EVENT_LIMIT = 500

router = APIRouter(
    prefix=f"{ADMIN_PREFIX}/governance",
    tags=[Tag.GOVERNANCE],
    dependencies=[Depends(require_admin)],
    responses={status: {"model": ErrorBody} for status in (401, 429, 503)},
)


@router.get(
    "/summary", response_model=GovernanceSummary, summary="Usage, safety and quality over a time window"
)
async def summary(
    request: Request,
    hours: int = Query(DEFAULT_WINDOW_HOURS, ge=1, le=MAX_WINDOW_HOURS),
) -> GovernanceSummary:
    return services_of(request).governance.summary(hours)


@router.get("/events", response_model=list[AiEvent], summary="Recent AI requests, newest first")
async def events(
    request: Request,
    limit: int = Query(DEFAULT_EVENT_LIMIT, ge=1, le=MAX_EVENT_LIMIT),
    outcome: Outcome | None = None,
) -> list[AiEvent]:
    return services_of(request).governance.events(limit=limit, outcome=outcome)


@router.get("/policy", response_model=GovernancePolicy, summary="The rules the AI currently runs under")
async def policy(request: Request) -> GovernancePolicy:
    return services_of(request).governance.policy()
