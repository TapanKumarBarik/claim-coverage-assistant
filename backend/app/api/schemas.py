"""HTTP request/response models. These define the public API contract."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr

from app.catalog.domain import DocKind
from app.core.constants import (
    REQUEST_ID_PATTERN,
    CitationRole,
    Confidence,
    CredentialSource,
    ErrorCode,
    HealthStatus,
    Intent,
    Language,
    Rating,
    ResponseKind,
    RetrievalMode,
    Verdict,
)
from app.core.models import ApiModel

CLAIM_MIN_CHARS = 1  # a greeting is a valid message; the concierge decides what it is
CLAIM_MAX_CHARS = 4000  # hard schema ceiling; the configured limit is enforced by the guardrails


class AnalyzeRequest(BaseModel):
    contract_id: str = Field(min_length=2, max_length=64)
    claim: str = Field(
        min_length=CLAIM_MIN_CHARS,
        max_length=CLAIM_MAX_CHARS,
        description="What happened, in the claimant's words. May also be a greeting or a question.",
    )
    loss_date: date | None = Field(
        default=None, description="Date of loss; defaults to today. Selects the policy version in force."
    )
    language: Language = Language.EN


class EvidenceItem(ApiModel):
    ref: str
    role: CitationRole
    quote: str
    section: str
    page: int
    passage: str = Field(description="The full chunk the quote was found in.")
    document_id: str
    document_title: str
    document_kind: DocKind
    version_label: str
    effective_from: date
    source_url: str | None


class DocumentUsed(ApiModel):
    document_id: str
    title: str
    kind: DocKind
    version_id: str
    version_label: str
    effective_from: date
    sha256: str


class RetrievalInfo(ApiModel):
    mode: RetrievalMode
    passages_reviewed: int
    passages_total: int


class AssessmentResponse(ApiModel):
    kind: Literal[ResponseKind.ASSESSMENT] = ResponseKind.ASSESSMENT
    request_id: str
    generated_at: datetime = Field(description="When the answer was produced (UTC).")
    contract_id: str
    loss_date: date
    language: Language
    verdict: Verdict
    headline: str
    reasoning: str
    confidence: Confidence | None = Field(
        description="Only for decisive verdicts; derived from verified evidence, not model self-report."
    )
    evidence_strength: DocKind | None
    evidence: list[EvidenceItem]
    missing_information: list[str]
    next_steps: list[str]
    caveats: list[str]
    documents_used: list[DocumentUsed]
    retrieval: RetrievalInfo
    model: str
    latency_ms: int
    disclaimer: str


class ReplyResponse(ApiModel):
    """A short answer to a greeting or an off-topic message, produced by the small model."""

    kind: Literal[ResponseKind.REPLY] = ResponseKind.REPLY
    request_id: str
    generated_at: datetime = Field(description="When the answer was produced (UTC).")
    intent: Intent
    language: Language
    text: str
    model: str
    latency_ms: int


AnalyzeOutcome = AssessmentResponse | ReplyResponse
AnalyzeResult = Annotated[AnalyzeOutcome, Field(discriminator="kind")]

FEEDBACK_COMMENT_MAX_CHARS = 500


class FeedbackInput(BaseModel):
    request_id: str = Field(
        pattern=REQUEST_ID_PATTERN, description="The `request_id` of the answer being rated."
    )
    rating: Rating
    comment: str | None = Field(
        default=None,
        max_length=FEEDBACK_COMMENT_MAX_CHARS,
        description="What went wrong or right, in the visitor's words. Personal data is masked.",
    )


class VersionPublic(ApiModel):
    id: str
    label: str
    effective_from: date


class DocumentPublic(ApiModel):
    id: str
    title: str
    kind: DocKind
    source_url: str | None
    current: VersionPublic | None


class ContractPublic(ApiModel):
    id: str
    insurer: str
    product: str
    country: str
    language: str
    synthetic: bool
    documents: list[DocumentPublic]


class Example(ApiModel):
    id: str
    contract_id: str
    title: dict[str, str]
    claim: dict[str, str]


class Health(ApiModel):
    status: HealthStatus
    version: str


class Readiness(ApiModel):
    ready: bool
    contracts: int
    live_versions: int
    llm_configured: bool
    embeddings_configured: bool
    byo_enabled: bool


class ErrorBody(ApiModel):
    code: ErrorCode
    detail: str
    request_id: str | None = None


# --- admin -------------------------------------------------------------------


class AdminLogin(BaseModel):
    password: SecretStr = Field(min_length=1, max_length=256, description="Never stored, never returned.")


class AdminSessionStatus(ApiModel):
    expires_at: datetime | None = Field(
        description="When the sign-in ends if nothing else happens; null for bearer-token callers."
    )


class AuditEntry(ApiModel):
    """One catalogue change. Extra keys (contract, document, version...) describe what was touched."""

    model_config = ConfigDict(extra="allow")

    at: str
    actor: str
    action: str


class CreateContract(BaseModel):
    id: str
    insurer: str = Field(min_length=2, max_length=120)
    product: str = Field(min_length=2, max_length=120)
    country: str = "LU"
    language: Language = Language.FR


class CreateDocument(BaseModel):
    contract_id: str
    id: str
    title: str = Field(min_length=2, max_length=200)
    kind: DocKind
    source_url: str | None = Field(default=None, max_length=500)


# --- bring-your-own Azure OpenAI credentials --------------------------------------

DEPLOYMENT_PATTERN = r"^[A-Za-z0-9._-]+$"
API_VERSION_PATTERN = r"^(\d{4}-\d{2}-\d{2}(-preview)?|v\d+)$"


class CredentialsInput(BaseModel):
    endpoint: str = Field(
        min_length=12, max_length=200, description="https://<resource>.openai.azure.com (Azure hosts only)."
    )
    api_key: SecretStr = Field(
        min_length=8, max_length=512, description="Never stored on disk, never returned."
    )
    reasoning_deployment: str = Field(
        min_length=1,
        max_length=64,
        pattern=DEPLOYMENT_PATTERN,
        description="Deployment name of the thinking model.",
    )
    fast_deployment: str | None = Field(
        default=None,
        max_length=64,
        pattern=DEPLOYMENT_PATTERN,
        description="Deployment name of a small model for greetings; defaults to the reasoning deployment.",
    )
    api_version: str | None = Field(default=None, max_length=40, pattern=API_VERSION_PATTERN)


class SessionStatus(ApiModel):
    source: CredentialSource
    endpoint_host: str | None
    reasoning_deployment: str | None
    fast_deployment: str | None
    expires_at: datetime | None
    byo_allowed: bool
