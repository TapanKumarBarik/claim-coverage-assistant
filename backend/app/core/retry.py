"""Generic async retry with exponential backoff, full jitter and server-supplied delays."""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeVar

T = TypeVar("T")
E = TypeVar("E", bound=Exception)

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int
    base_delay_s: float
    max_delay_s: float

    def backoff(self, attempt: int, rng: Callable[[], float]) -> float:
        """Full jitter: a random delay up to base * 2^(attempt-1), capped."""
        ceiling = min(self.max_delay_s, self.base_delay_s * float(2 ** (attempt - 1)))
        return float(ceiling * rng())


async def retry_async(
    call: Callable[[], Awaitable[T]],
    *,
    policy: RetryPolicy,
    retry_on: tuple[type[Exception], ...],
    retry_after_of: Callable[[Exception], float | None] | None = None,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    rng: Callable[[], float] = random.random,
) -> T:
    """Run ``call`` and retry ``retry_on`` errors.

    A server-supplied delay (``Retry-After``) is honoured, but if it exceeds the policy's
    ``max_delay_s`` the error is raised immediately: a request should not sit and wait.
    """
    attempt = 1
    while True:
        try:
            return await call()
        except retry_on as exc:
            if attempt >= policy.max_attempts:
                raise
            hinted = retry_after_of(exc) if retry_after_of else None
            if hinted is not None and hinted > policy.max_delay_s:
                raise
            delay = max(policy.backoff(attempt, rng), hinted or 0.0)
            log.warning(
                "retrying",
                extra={"attempt": attempt, "max_attempts": policy.max_attempts, "delay_s": round(delay, 2)},
            )
            await sleep(delay)
            attempt += 1
