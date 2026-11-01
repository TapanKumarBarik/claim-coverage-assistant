"""Retry, circuit breaker, rate limiting, token meters and abuse lockouts."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.core.circuit_breaker import CircuitBreaker
from app.core.constants import BreakerState, CredentialSource
from app.core.errors import BudgetExhausted, LockedOut, RateLimited, Unavailable
from app.core.identity import ClientId
from app.core.ratelimit import ConcurrencyGate, SlidingWindowLimiter, UsageMeter
from app.core.retry import RetryPolicy, retry_async
from app.services.admission import AbuseGuard, AdmissionControl

CLIENT = ClientId("client-a")


class Flaky(Exception):
    def __init__(self, retry_after: float | None = None) -> None:
        super().__init__("flaky")
        self.retry_after = retry_after


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


# --- retry ----------------------------------------------------------------------------------


async def test_retry_succeeds_after_transient_failures_and_sleeps_between_attempts() -> None:
    attempts, slept = [], []

    async def call() -> str:
        attempts.append(1)
        if len(attempts) < 3:
            raise Flaky
        return "ok"

    async def sleep(seconds: float) -> None:
        slept.append(seconds)

    result = await retry_async(
        call, policy=RetryPolicy(3, 1.0, 8.0), retry_on=(Flaky,), sleep=sleep, rng=lambda: 1.0
    )
    assert result == "ok" and len(attempts) == 3
    assert slept == [1.0, 2.0]  # exponential: base * 2^(attempt-1), jitter pinned to its maximum


async def test_retry_gives_up_after_max_attempts_and_reraises() -> None:
    calls = []

    async def call() -> None:
        calls.append(1)
        raise Flaky

    with pytest.raises(Flaky):
        await retry_async(call, policy=RetryPolicy(3, 0, 0), retry_on=(Flaky,))
    assert len(calls) == 3


async def test_retry_does_not_retry_other_errors() -> None:
    calls = []

    async def call() -> None:
        calls.append(1)
        raise ValueError("permanent")

    with pytest.raises(ValueError, match="permanent"):
        await retry_async(call, policy=RetryPolicy(5, 0, 0), retry_on=(Flaky,))
    assert len(calls) == 1


async def test_retry_honours_a_short_server_delay_but_refuses_a_long_one() -> None:
    slept: list[float] = []

    async def sleep(seconds: float) -> None:
        slept.append(seconds)

    state = {"n": 0}

    async def short() -> str:
        state["n"] += 1
        if state["n"] == 1:
            raise Flaky(retry_after=3.0)
        return "ok"

    policy = RetryPolicy(3, 0.0, 8.0)
    hint = lambda exc: exc.retry_after  # noqa: E731
    assert (
        await retry_async(short, policy=policy, retry_on=(Flaky,), retry_after_of=hint, sleep=sleep) == "ok"
    )
    assert slept == [3.0]

    calls = []

    async def long() -> None:
        calls.append(1)
        raise Flaky(retry_after=60.0)  # a request must not sit and wait a minute

    with pytest.raises(Flaky):
        await retry_async(long, policy=policy, retry_on=(Flaky,), retry_after_of=hint, sleep=sleep)
    assert len(calls) == 1


# --- circuit breaker ---------------------------------------------------------------------------


def test_breaker_opens_after_threshold_probes_after_reset_and_closes_on_success() -> None:
    clock = FakeClock()
    breaker = CircuitBreaker(failure_threshold=3, reset_s=30, clock=clock)
    for _ in range(2):
        breaker.record_failure()
    assert breaker.state is BreakerState.CLOSED
    breaker.record_failure()
    assert breaker.state is BreakerState.OPEN
    with pytest.raises(Unavailable) as blocked:
        breaker.ensure_allowed()
    assert blocked.value.retry_after == 30

    clock.advance(31)
    assert breaker.state is BreakerState.HALF_OPEN
    breaker.ensure_allowed()  # one probe is allowed through
    breaker.record_failure()  # the probe failed: straight back to open
    assert breaker.state is BreakerState.OPEN

    clock.advance(31)
    breaker.record_success()
    assert breaker.state is BreakerState.CLOSED and breaker.consecutive_failures == 0


# --- rate limiting and metering -------------------------------------------------------------------


def test_sliding_window_blocks_then_recovers() -> None:
    clock = FakeClock()
    limiter = SlidingWindowLimiter(2, window_s=60, clock=clock)
    assert limiter.check("a") is None and limiter.check("a") is None
    wait = limiter.check("a")
    assert wait is not None and 1 <= wait <= 60
    assert limiter.check("b") is None  # other keys are independent
    clock.advance(61)
    assert limiter.check("a") is None


def test_usage_meter_rolls_over_at_midnight() -> None:
    now = {"t": datetime(2026, 10, 29, 23, 0, tzinfo=UTC)}
    meter = UsageMeter(100, clock=lambda: now["t"])
    meter.consume("a", 100)
    assert not meter.has_room("a")
    assert meter.seconds_until_reset() == 3600
    now["t"] += timedelta(hours=2)
    assert meter.has_room("a") and meter.used("a") == 0


async def test_concurrency_gate_sheds_load_instead_of_queueing_forever() -> None:
    gate = ConcurrencyGate(1, wait_timeout_s=0.05)
    async with gate.slot():
        with pytest.raises(Unavailable):
            async with gate.slot():
                pass
    async with gate.slot():  # released, so it works again
        await asyncio.sleep(0)


# --- abuse and admission -----------------------------------------------------------------------


def test_strikes_lock_a_client_out_then_expire() -> None:
    clock = FakeClock()
    guard = AbuseGuard(strike_limit=3, window_s=900, lockout_s=600, clock=clock)
    assert [guard.strike(CLIENT) for _ in range(3)] == [False, False, True]
    with pytest.raises(LockedOut) as locked:
        guard.ensure_not_locked(CLIENT)
    assert locked.value.retry_after == 600 and guard.locked_now() == 1
    guard.ensure_not_locked(ClientId("someone-else"))
    clock.advance(601)
    guard.ensure_not_locked(CLIENT)
    assert guard.locked_now() == 0


def test_old_strikes_fall_out_of_the_window() -> None:
    clock = FakeClock()
    guard = AbuseGuard(strike_limit=2, window_s=100, lockout_s=600, clock=clock)
    guard.strike(CLIENT)
    clock.advance(101)
    assert guard.strike(CLIENT) is False  # the first strike expired


def make_admission(
    *, rate: int = 10, client_tokens: int = 1000, global_tokens: int = 10_000
) -> AdmissionControl:
    return AdmissionControl(
        limiter=SlidingWindowLimiter(rate),
        abuse=AbuseGuard(strike_limit=2, window_s=900, lockout_s=900),
        client_tokens=UsageMeter(client_tokens),
        global_tokens=UsageMeter(global_tokens),
    )


def test_admission_enforces_rate_and_client_budget() -> None:
    admission = make_admission(rate=2)
    admission.admit(CLIENT, CredentialSource.SESSION)
    admission.admit(CLIENT, CredentialSource.SESSION)
    with pytest.raises(RateLimited):
        admission.admit(CLIENT, CredentialSource.SESSION)

    admission = make_admission(client_tokens=100)
    admission.admit(CLIENT, CredentialSource.SESSION)
    admission.settle(CLIENT, 100, CredentialSource.SESSION)
    with pytest.raises(BudgetExhausted):
        admission.admit(CLIENT, CredentialSource.SESSION)


def test_global_budget_only_protects_operator_paid_calls() -> None:
    admission = make_admission(global_tokens=100)
    admission.settle(CLIENT, 100, CredentialSource.SERVER)
    other = ClientId("client-b")
    with pytest.raises(BudgetExhausted):
        admission.admit(other, CredentialSource.SERVER)
    admission.admit(other, CredentialSource.SESSION)  # visitor pays for their own key

    admission.settle(other, 500, CredentialSource.SESSION)
    assert admission.global_used == 100  # visitor usage never counted against the operator


def test_a_locked_out_client_is_refused_before_anything_else() -> None:
    admission = make_admission()
    admission.strike(CLIENT)
    admission.strike(CLIENT)
    with pytest.raises(LockedOut):
        admission.admit(CLIENT, CredentialSource.SESSION)
