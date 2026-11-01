"""Read side of governance: aggregate the event log and describe the rules in force."""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from app.agents.skills.library import SkillSet
from app.agents.tools import ToolRegistry
from app.core.circuit_breaker import CircuitBreaker
from app.core.config import Settings
from app.core.constants import BreakerState, ModelTier, Outcome, ReasoningEffort
from app.governance.models import (
    AbuseStats,
    AiEvent,
    BreakerStatus,
    BudgetStatus,
    CitationStats,
    GovernancePolicy,
    GovernanceSummary,
    GuardPolicy,
    LatencyStats,
    LimitPolicy,
    SecretsPosture,
    SkillPolicy,
    TierPolicy,
    TokenTotals,
    ToolPolicy,
)
from app.governance.store import GovernanceStore
from app.guardrails.base import GuardInfo
from app.llm.azure import AzureConnection, ModelTuning, build_profiles
from app.services.admission import AdmissionControl

P95 = 0.95


def _p95(values: list[int]) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[max(0, math.ceil(P95 * len(ordered)) - 1)]


def _count(values: Sequence[object]) -> dict[str, int]:
    return dict(Counter(str(getattr(v, "value", v)) for v in values))


class GovernanceService:
    def __init__(
        self,
        *,
        store: GovernanceStore,
        settings: Settings,
        admission: AdmissionControl,
        breaker: CircuitBreaker | None,
        skills: SkillSet,
        tools: ToolRegistry,
        guards: Sequence[GuardInfo],
        server_connection: AzureConnection | None,
    ) -> None:
        self._store = store
        self._settings = settings
        self._admission = admission
        self._breaker = breaker
        self._skills = skills
        self._tools = tools
        self._guards = tuple(guards)
        self._connection = server_connection

    def events(self, *, limit: int, outcome: Outcome | None = None) -> list[AiEvent]:
        events = [e for e in self._store.read_all() if outcome is None or e.outcome is outcome]
        return list(reversed(events))[:limit]

    def summary(self, hours: int) -> GovernanceSummary:
        now = datetime.now(UTC)
        window = [e for e in self._store.read_all() if e.ts >= now - timedelta(hours=hours)]
        latencies = [e.latency_ms for e in window]
        verified = sum(e.citations_verified for e in window)
        dropped = sum(e.citations_dropped for e in window)
        by_tier: Counter[str] = Counter()
        for event in window:
            for tier, tokens in event.tokens_by_tier.items():
                by_tier[tier] += tokens
        by_outcome = Counter(e.outcome for e in window)
        return GovernanceSummary(
            window_hours=hours,
            generated_at=now,
            requests=len(window),
            by_outcome=_count([e.outcome for e in window]),
            by_intent=_count([e.intent for e in window if e.intent]),
            by_verdict=_count([e.verdict for e in window if e.verdict]),
            by_confidence=_count([e.confidence for e in window if e.confidence]),
            by_model=_count([m for e in window for m in e.models]),
            tools=_count([t for e in window for t in e.tools]),
            guard_flags=_count([f for e in window for f in e.guard_flags]),
            tokens=TokenTotals(
                prompt=sum(e.prompt_tokens for e in window),
                completion=sum(e.completion_tokens for e in window),
                by_tier=dict(by_tier),
            ),
            latency=LatencyStats(
                average_ms=int(sum(latencies) / len(latencies)) if latencies else 0, p95_ms=_p95(latencies)
            ),
            citations=CitationStats(
                verified=verified,
                dropped=dropped,
                verify_rate=round(verified / (verified + dropped), 4) if verified + dropped else 1.0,
            ),
            abuse=AbuseStats(
                blocked_requests=by_outcome[Outcome.BLOCKED],
                rate_limited=by_outcome[Outcome.RATE_LIMITED] + by_outcome[Outcome.LOCKED_OUT],
                locked_out_clients_now=self._admission.abuse.locked_now(),
            ),
            budgets=BudgetStatus(
                global_used=self._admission.global_used,
                global_limit=self._admission.global_limit,
                client_limit=self._admission.client_limit,
            ),
            breaker=BreakerStatus(
                state=self._breaker.state if self._breaker else BreakerState.CLOSED,
                consecutive_failures=self._breaker.consecutive_failures if self._breaker else 0,
            ),
        )

    def policy(self) -> GovernancePolicy:
        s = self._settings
        tuning = ModelTuning.from_settings(s)
        profiles = build_profiles(self._connection, tuning) if self._connection else {}
        tiers = []
        for tier in ModelTier:
            profile = profiles.get(tier)
            tiers.append(
                TierPolicy(
                    tier=tier,
                    deployment=profile.deployment if profile else None,
                    max_output_tokens=profile.max_output_tokens if profile else _tier_tokens(tier, tuning),
                    timeout_s=profile.timeout_s if profile else _tier_timeout(tier, tuning),
                    reasoning_effort=profile.reasoning_effort if profile else _tier_effort(tier, tuning),
                )
            )
        return GovernancePolicy(
            tiers=tiers,
            skills=[
                SkillPolicy(
                    name=sk.name,
                    version=sk.version,
                    tier=sk.tier,
                    tools=list(sk.tools),
                    max_steps=sk.max_steps,
                )
                for sk in self._skills.all()
            ],
            tools=[ToolPolicy(name=t.name, description=t.description) for t in self._tools.tools],
            guards=[GuardPolicy(name=g.name, stage=g.stage, description=g.description) for g in self._guards],
            limits=LimitPolicy(
                rate_per_minute=s.analyze_rate_per_minute,
                client_daily_tokens=s.client_daily_token_budget,
                global_daily_tokens=s.global_daily_token_budget,
                strike_limit=s.abuse_strike_limit,
                strike_window_s=s.abuse_window_s,
                lockout_s=s.abuse_lockout_s,
                max_claim_chars=s.max_claim_chars,
                llm_retry_attempts=s.llm_retry_attempts,
                breaker_failure_threshold=s.breaker_failure_threshold,
                breaker_reset_s=s.breaker_reset_s,
                llm_max_concurrency=s.llm_max_concurrency,
                agent_max_steps=s.agent_max_steps,
                agent_deadline_s=s.agent_deadline_s,
            ),
            secrets=SecretsPosture(
                admin_token_hashed=s.admin_token_sha256 is not None,
                openai_auth=s.openai_auth,
                log_redaction=True,
                client_addresses_pseudonymised=True,
            ),
        )


def _tier_tokens(tier: ModelTier, t: ModelTuning) -> int:
    return t.fast_max_output_tokens if tier is ModelTier.FAST else t.reasoning_max_output_tokens


def _tier_timeout(tier: ModelTier, t: ModelTuning) -> float:
    return t.fast_timeout_s if tier is ModelTier.FAST else t.reasoning_timeout_s


def _tier_effort(tier: ModelTier, t: ModelTuning) -> ReasoningEffort | None:
    return None if tier is ModelTier.FAST else t.reasoning_effort
