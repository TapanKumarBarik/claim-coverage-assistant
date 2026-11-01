"""Conversations: what is saved when an answer goes out, how a visitor rates it, and what an admin may read.

Saving never fails a request (like the governance log), and what is saved is already masked: the question is
the text the model saw, after the input guards.
"""

from __future__ import annotations

import logging
import sqlite3
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from pydantic import TypeAdapter, ValidationError

from app.api.schemas import AnalyzeOutcome, AnalyzeResult, AssessmentResponse
from app.conversations.models import (
    ConversationDetail,
    ConversationPage,
    ConversationSummary,
    Feedback,
    FeedbackStats,
)
from app.conversations.store import ConversationRow, ConversationStore
from app.core.constants import FeedbackFilter, GuardCode, Rating
from app.core.errors import NotFound
from app.core.identity import ClientId
from app.guardrails.base import InputPipeline

log = logging.getLogger(__name__)

PREVIEW_CHARS = 160
_RESPONSE = TypeAdapter(AnalyzeResult)


def _now() -> datetime:
    return datetime.now(UTC)


class ConversationService:
    def __init__(
        self,
        store: ConversationStore,
        comment_guards: InputPipeline,
        *,
        retention_days: int,
        max_records: int,
        clock: Callable[[], datetime] = _now,
    ) -> None:
        self._store = store
        self._comment_guards = comment_guards
        self._retention = timedelta(days=retention_days)
        self._max_records = max_records
        self._clock = clock

    # --- write side: the claim service and the visitor ----------------------------------------

    def record(self, *, client: ClientId, contract_id: str, question: str, outcome: AnalyzeOutcome) -> None:
        assessment = outcome if isinstance(outcome, AssessmentResponse) else None
        row = ConversationRow(
            request_id=outcome.request_id,
            created_at=outcome.generated_at,
            client=client,
            contract_id=contract_id,
            language=outcome.language,
            kind=outcome.kind,
            verdict=assessment.verdict if assessment else None,
            confidence=assessment.confidence if assessment else None,
            question=question,
            response=outcome.model_dump_json(),
            model=outcome.model,
            latency_ms=outcome.latency_ms,
        )
        try:
            if not self._store.add(row):
                log.warning("conversation_id_in_use")
            self._store.prune(older_than=self._clock() - self._retention, keep_latest=self._max_records)
        except (sqlite3.Error, OSError):
            log.exception("conversation_write_failed")  # losing a log line must not fail a user request

    def rate(self, request_id: str, client: ClientId, rating: Rating, comment: str | None) -> Feedback:
        """Only the browser that received an answer may rate it; anyone else is told it does not exist."""
        cleaned = self._clean(comment)
        rated_at = self._clock()
        if not self._store.set_feedback(request_id, client, rating, cleaned, rated_at):
            raise NotFound("That answer is not available for rating.")
        return Feedback(rating=rating, comment=cleaned, rated_at=rated_at)

    def _clean(self, comment: str | None) -> str | None:
        if comment is None:
            return None
        result = self._comment_guards.run(comment)
        return None if result.block is GuardCode.EMPTY else result.text

    # --- read side: the admin ---------------------------------------------------------------------

    def page(
        self, *, feedback: FeedbackFilter | None, text: str | None, limit: int, offset: int
    ) -> ConversationPage:
        total, rows = self._store.page(
            feedback=feedback, text=text.strip() if text else None, limit=limit, offset=offset
        )
        return ConversationPage(
            total=total, limit=limit, offset=offset, items=[self._summary(row) for row in rows]
        )

    def detail(self, request_id: str) -> ConversationDetail:
        row = self._store.get(request_id)
        if row is None:
            raise NotFound("Unknown conversation.")
        return ConversationDetail(
            **self._summary(row).model_dump(),
            question=row.question,
            comment=row.comment,
            response=self._answer(row),
        )

    def stats(self) -> FeedbackStats:
        return self._store.stats()

    def delete(self, request_id: str) -> None:
        if not self._store.delete(request_id):
            raise NotFound("Unknown conversation.")

    # --- helpers --------------------------------------------------------------------------------------

    @staticmethod
    def _summary(row: ConversationRow) -> ConversationSummary:
        preview = (
            row.question
            if len(row.question) <= PREVIEW_CHARS
            else row.question[:PREVIEW_CHARS].rstrip() + "…"
        )
        return ConversationSummary(
            request_id=row.request_id,
            created_at=row.created_at,
            contract_id=row.contract_id,
            language=row.language,
            kind=row.kind,
            verdict=row.verdict,
            confidence=row.confidence,
            preview=preview,
            model=row.model,
            latency_ms=row.latency_ms,
            rating=row.rating,
            rated_at=row.rated_at,
            has_comment=row.comment is not None,
        )

    @staticmethod
    def _answer(row: ConversationRow) -> AnalyzeOutcome | None:
        try:
            return _RESPONSE.validate_json(row.response or "")
        except ValidationError:
            log.warning("conversation_unreadable", extra={"request_id": row.request_id})
            return None
