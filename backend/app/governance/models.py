"""What the governance log records, and what the admin dashboard reads back."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.core.constants import (
    BreakerState,
    Confidence,
    CredentialSource,
    ErrorCode,
    GuardCode,
    GuardName,
    GuardStage,
    Intent,
    Language,
    ModelTier,
    OpenAiAuth,
    Outcome,
    ReasoningEffort,
    RetrievalMode,
    SkillName,
    ToolName,
    Verdict,
)
from app.core.models import ApiModel


class AiEvent(ApiModel):
    """One request through the AI pipeline. Never contains the claim text, only its fate."""

    ts: datetime
    request_id: str
    client: str  # pseudonymous hash, not an address
    outcome: Outcome
    error_code: ErrorCode | None = None
    intent: Intent | None = None
    contract_id: str | None = None
    language: Language
    credential_source: CredentialSource | None = None
    tiers: list[ModelTier] = Field(default_factory=list)
    models: list[str] = Field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    tokens_by_tier: dict[str, int] = Field(default_factory=dict)
    latency_ms: int = 0
    steps: int = 0
    tools: list[ToolName] = Field(default_factory=list)
    guard_flags: list[GuardCode] = Field(default_factory=list)
    verdict: Verdict | None = None
    confidence: Confidence | None = None
    citations_verified: int = 0
    citations_dropped: int = 0
    retrieval_mode: RetrievalMode | None = None
    blocked_excerpt: str | None = None  # redacted and truncated; only for blocked requests


# --- dashboard ----------------------------------------------------------------


class TokenTotals(ApiModel):
    prompt: int
    completion: int
    by_tier: dict[str, int]


class LatencyStats(ApiModel):
    average_ms: int
    p95_ms: int


class CitationStats(ApiModel):
    verified: int
    dropped: int
    verify_rate: float


class AbuseStats(ApiModel):
    blocked_requests: int
    rate_limited: int
    locked_out_clients_now: int


class BudgetStatus(ApiModel):
    global_used: int
    global_limit: int
    client_limit: int


class BreakerStatus(ApiModel):
    state: BreakerState
    consecutive_failures: int


class GovernanceSummary(ApiModel):
    window_hours: int
    generated_at: datetime
    requests: int
    by_outcome: dict[str, int]
    by_intent: dict[str, int]
    by_verdict: dict[str, int]
    by_confidence: dict[str, int]
    by_model: dict[str, int]
    tools: dict[str, int]
    guard_flags: dict[str, int]
    tokens: TokenTotals
    latency: LatencyStats
    citations: CitationStats
    abuse: AbuseStats
    budgets: BudgetStatus
    breaker: BreakerStatus


# --- active policy (read-only view) -----------------------------------------------


class TierPolicy(ApiModel):
    tier: ModelTier
    deployment: str | None
    max_output_tokens: int
    timeout_s: float
    reasoning_effort: ReasoningEffort | None


class SkillPolicy(ApiModel):
    name: SkillName
    version: str
    tier: ModelTier
    tools: list[ToolName]
    max_steps: int


class ToolPolicy(ApiModel):
    name: ToolName
    description: str


class GuardPolicy(ApiModel):
    name: GuardName
    stage: GuardStage
    description: str


class LimitPolicy(ApiModel):
    rate_per_minute: int
    client_daily_tokens: int
    global_daily_tokens: int
    strike_limit: int
    strike_window_s: float
    lockout_s: float
    max_claim_chars: int
    llm_retry_attempts: int
    breaker_failure_threshold: int
    breaker_reset_s: float
    llm_max_concurrency: int
    agent_max_steps: int
    agent_deadline_s: float


class SecretsPosture(ApiModel):
    admin_token_hashed: bool
    openai_auth: OpenAiAuth
    log_redaction: bool
    client_addresses_pseudonymised: bool


class GovernancePolicy(ApiModel):
    tiers: list[TierPolicy]
    skills: list[SkillPolicy]
    tools: list[ToolPolicy]
    guards: list[GuardPolicy]
    limits: LimitPolicy
    secrets: SecretsPosture
