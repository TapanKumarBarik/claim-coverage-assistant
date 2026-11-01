"""A small circuit breaker: after repeated upstream failures, fail fast for a cool-down."""

from __future__ import annotations

import logging
import math
import time
from collections.abc import Callable

from app.core.constants import BreakerState
from app.core.errors import Unavailable

log = logging.getLogger(__name__)


class CircuitBreaker:
    def __init__(
        self,
        *,
        failure_threshold: int,
        reset_s: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._threshold = failure_threshold
        self._reset_s = reset_s
        self._clock = clock
        self._failures = 0
        self._opened_at: float | None = None

    @property
    def consecutive_failures(self) -> int:
        return self._failures

    @property
    def state(self) -> BreakerState:
        if self._opened_at is None:
            return BreakerState.CLOSED
        if self._clock() - self._opened_at >= self._reset_s:
            return BreakerState.HALF_OPEN  # let the next call probe the upstream
        return BreakerState.OPEN

    def ensure_allowed(self) -> None:
        if self.state is BreakerState.OPEN:
            assert self._opened_at is not None
            remaining = self._reset_s - (self._clock() - self._opened_at)
            raise Unavailable(
                "The language model is temporarily unavailable.", retry_after=max(1, math.ceil(remaining))
            )

    def record_success(self) -> None:
        self._failures = 0
        self._opened_at = None

    def record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self._threshold or self.state is BreakerState.HALF_OPEN:
            if self._opened_at is None or self.state is BreakerState.HALF_OPEN:
                log.error("circuit_opened", extra={"failures": self._failures})
            self._opened_at = self._clock()
