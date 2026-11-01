"""Write side of governance: record what happened, never break the request while doing so."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from time import perf_counter
from typing import Any

from app.agents.harness import AgentRun
from app.core.constants import (
    Confidence,
    CredentialSource,
    ErrorCode,
    GuardCode,
    Intent,
    Language,
    ModelTier,
    Outcome,
    RetrievalMode,
    ToolName,
    Verdict,
)
from app.governance.models import AiEvent
from app.governance.store import GovernanceStore
from app.guardrails.base import GuardFlag
from app.llm.types import Usage

log = logging.getLogger(__name__)

EXCERPT_CHARS = 160


@dataclass
class RunTelemetry:
    """Collected while one request moves through the pipeline; turned into one ``AiEvent``."""

    request_id: str
    client: str
    language: Language
    started: float = field(default_factory=perf_counter)
    credential_source: CredentialSource | None = None
    contract_id: str | None = None
    intent: Intent | None = None
    usage: Usage = field(default_factory=Usage)
    steps: int = 0
    tokens_by_tier: dict[str, int] = field(default_factory=dict)
    tiers: list[ModelTier] = field(default_factory=list)
    models: list[str] = field(default_factory=list)
    tools: list[ToolName] = field(default_factory=list)
    flags: list[GuardCode] = field(default_factory=list)
    verdict: Verdict | None = None
    confidence: Confidence | None = None
    citations_verified: int = 0
    citations_dropped: int = 0
    retrieval_mode: RetrievalMode | None = None
    blocked_excerpt: str | None = None

    def add_run(self, run: AgentRun[Any]) -> None:
        self.usage += run.usage
        self.steps += run.steps
        if run.tier not in self.tiers:
            self.tiers.append(run.tier)
        self.tokens_by_tier[run.tier.value] = self.tokens_by_tier.get(run.tier.value, 0) + run.usage.total
        self.models.extend(m for m in run.models if m not in self.models)
        self.tools.extend(run.tool_names)

    def add_flags(self, flags: list[GuardFlag] | tuple[GuardFlag, ...]) -> None:
        self.flags.extend(flag.code for flag in flags)

    def flag(self, code: GuardCode) -> None:
        self.flags.append(code)

    def elapsed_ms(self) -> int:
        return int((perf_counter() - self.started) * 1000)

    def block(self, text: str) -> None:
        self.blocked_excerpt = text[:EXCERPT_CHARS]

    def to_event(self, outcome: Outcome, error_code: ErrorCode | None = None) -> AiEvent:
        return AiEvent(
            ts=datetime.now(UTC),
            request_id=self.request_id,
            client=self.client,
            outcome=outcome,
            error_code=error_code,
            intent=self.intent,
            contract_id=self.contract_id,
            language=self.language,
            credential_source=self.credential_source,
            tiers=self.tiers,
            models=self.models,
            prompt_tokens=self.usage.prompt_tokens,
            completion_tokens=self.usage.completion_tokens,
            tokens_by_tier=self.tokens_by_tier,
            latency_ms=self.elapsed_ms(),
            steps=self.steps,
            tools=self.tools,
            guard_flags=self.flags,
            verdict=self.verdict,
            confidence=self.confidence,
            citations_verified=self.citations_verified,
            citations_dropped=self.citations_dropped,
            retrieval_mode=self.retrieval_mode,
            blocked_excerpt=self.blocked_excerpt,
        )


class GovernanceRecorder:
    def __init__(self, store: GovernanceStore) -> None:
        self._store = store

    def record(self, event: AiEvent) -> None:
        try:
            self._store.append(event)
        except OSError:
            log.exception("governance_write_failed")  # losing an audit line must not fail a user request
