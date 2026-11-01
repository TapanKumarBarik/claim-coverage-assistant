"""Structured outputs requested from the models.

Free of defaults and unions so the schemas satisfy strict structured output on Azure OpenAI.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.constants import CitationRole, Intent, Verdict


class ModelCitation(BaseModel):
    ref: str = Field(description="Excerpt reference such as 'c3'.")
    quote: str = Field(description="Verbatim span copied from that excerpt.")
    role: CitationRole


class ModelAssessment(BaseModel):
    verdict: Verdict
    headline: str = Field(description="One sentence stating the conclusion.")
    reasoning: str = Field(description="Short explanation that walks through the clauses.")
    citations: list[ModelCitation]
    missing_information: list[str] = Field(
        description="Facts that would change the answer, phrased as questions to the claimant."
    )
    next_steps: list[str]


class QueryRewrite(BaseModel):
    queries: list[str] = Field(description="Short search queries in the documents' language.")


class RouteDecision(BaseModel):
    intent: Intent
    reply: str = Field(description="Short friendly reply for smalltalk/off_topic; empty otherwise.")
