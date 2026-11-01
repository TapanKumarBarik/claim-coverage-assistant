"""Resilience as a decorator: retry, circuit breaker and load shedding around any ``LLM``."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Sequence

from app.core.circuit_breaker import CircuitBreaker
from app.core.constants import ModelTier
from app.core.ratelimit import ConcurrencyGate
from app.core.retry import RetryPolicy, retry_async
from app.llm.errors import LLMTransientError
from app.llm.port import LLM, M
from app.llm.types import ChatMessage, ChatTurn, ToolSpec


def _hint(exc: Exception) -> float | None:
    return exc.retry_after if isinstance(exc, LLMTransientError) else None


class ResilientLLM:
    def __init__(
        self,
        inner: LLM,
        *,
        retry: RetryPolicy,
        breaker: CircuitBreaker,
        gate: ConcurrencyGate,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._inner = inner
        self._retry = retry
        self._breaker = breaker
        self._gate = gate
        self._sleep = sleep

    @property
    def breaker(self) -> CircuitBreaker:
        return self._breaker

    async def chat(
        self,
        *,
        tier: ModelTier,
        messages: Sequence[ChatMessage],
        tools: Sequence[ToolSpec] = (),
        response_model: type[M] | None = None,
    ) -> ChatTurn[M]:
        self._breaker.ensure_allowed()
        async with self._gate.slot():
            try:
                turn = await retry_async(
                    lambda: self._inner.chat(
                        tier=tier, messages=messages, tools=tools, response_model=response_model
                    ),
                    policy=self._retry,
                    retry_on=(LLMTransientError,),
                    retry_after_of=_hint,
                    sleep=self._sleep,
                )
            except LLMTransientError:
                self._breaker.record_failure()  # only after retries are exhausted
                raise
        self._breaker.record_success()
        return turn
