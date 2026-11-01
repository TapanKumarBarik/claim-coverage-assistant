"""Admin API: every saved conversation with its feedback, so answer quality can be reviewed.

Questions are stored with personal data masked and are removed automatically after the retention period;
an admin can also delete one at any time (the deletion is written to the audit log).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response

from app.api.admin import AuditAction
from app.api.deps import services_of
from app.api.schemas import ErrorBody
from app.api.security import ADMIN_ACTOR, require_admin
from app.conversations.models import ConversationDetail, ConversationPage, FeedbackStats
from app.core.constants import ADMIN_PREFIX, REQUEST_ID_PATTERN, FeedbackFilter, Tag

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
MAX_SEARCH_CHARS = 100

router = APIRouter(
    prefix=f"{ADMIN_PREFIX}/conversations",
    tags=[Tag.CONVERSATIONS],
    dependencies=[Depends(require_admin)],
    responses={status: {"model": ErrorBody} for status in (401, 403, 404, 429, 503)},
)


@router.get("", response_model=ConversationPage, summary="Conversations and their feedback, newest first")
async def conversations(
    request: Request,
    feedback: FeedbackFilter | None = None,
    q: str | None = Query(
        None, max_length=MAX_SEARCH_CHARS, description="Text to find in questions and comments."
    ),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
) -> ConversationPage:
    return services_of(request).conversations.page(feedback=feedback, text=q, limit=limit, offset=offset)


@router.get("/stats", response_model=FeedbackStats, summary="How many answers were liked or disliked")
async def stats(request: Request) -> FeedbackStats:
    return services_of(request).conversations.stats()


RequestId = Annotated[str, Path(pattern=REQUEST_ID_PATTERN)]


@router.get("/{request_id}", response_model=ConversationDetail, summary="One conversation in full")
async def conversation(request: Request, request_id: RequestId) -> ConversationDetail:
    return services_of(request).conversations.detail(request_id)


@router.delete("/{request_id}", status_code=204, summary="Delete a conversation")
async def delete_conversation(request: Request, request_id: RequestId) -> Response:
    services = services_of(request)
    services.conversations.delete(request_id)
    services.store.audit(ADMIN_ACTOR, AuditAction.CONVERSATION_DELETE, request=request_id)
    return Response(status_code=204)
