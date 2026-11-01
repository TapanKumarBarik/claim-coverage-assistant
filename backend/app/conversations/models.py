"""What the admin conversation log shows, and what a visitor's rating looks like once saved."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.api.schemas import AnalyzeResult
from app.core.constants import Confidence, Language, Rating, ResponseKind, Verdict
from app.core.models import ApiModel


class Feedback(ApiModel):
    """A visitor's rating of one answer, as saved."""

    rating: Rating
    comment: str | None
    rated_at: datetime


class ConversationSummary(ApiModel):
    """One row of the admin table."""

    request_id: str
    created_at: datetime
    contract_id: str
    language: Language
    kind: ResponseKind
    verdict: Verdict | None
    confidence: Confidence | None
    preview: str = Field(description="The start of the question, personal data masked.")
    model: str
    latency_ms: int
    rating: Rating | None
    rated_at: datetime | None
    has_comment: bool


class ConversationDetail(ConversationSummary):
    question: str = Field(description="The full question as the model saw it: personal data is masked.")
    comment: str | None
    response: AnalyzeResult | None = Field(
        description="The answer as the visitor saw it; null if saved in a format this version cannot read."
    )


class ConversationPage(ApiModel):
    total: int
    limit: int
    offset: int
    items: list[ConversationSummary]


class FeedbackStats(ApiModel):
    conversations: int
    rated: int
    up: int
    down: int
    commented: int
    satisfaction: float | None = Field(
        description="Share of rated answers that were liked; null until one is rated."
    )
