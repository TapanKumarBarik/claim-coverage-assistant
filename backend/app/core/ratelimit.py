"""Rate limiting, usage metering and load shedding.

All state is in-process, which fits a single-instance deployment. ``RateLimiter`` is the seam:
swap in a Redis-backed implementation to scale out.
"""

from __future__ import annotations

import asyncio
import math
import threading
import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Protocol

from app.core.errors import Unavailable

_PRUNE_THRESHOLD = 10_000
_BUSY_RETRY_AFTER_S = 5


class RateLimiter(Protocol):
    def check(self, key: str) -> int | None:
        """Record a hit. None if allowed, else seconds until a slot frees up."""
        ...


class SlidingWindowLimiter:
    def __init__(
        self, limit: int, window_s: float = 60.0, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self.limit = limit
        self.window_s = window_s
        self._clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> int | None:
        now = self._clock()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(1, math.ceil(self.window_s - (now - hits[0])))
            hits.append(now)
            if len(self._hits) > _PRUNE_THRESHOLD:  # bound memory under address churn
                self._hits = defaultdict(deque, {k: v for k, v in self._hits.items() if v})
            return None


class UsageMeter:
    """Units (tokens) consumed per key per UTC day."""

    def __init__(self, limit: int, clock: Callable[[], datetime] = lambda: datetime.now(UTC)) -> None:
        self.limit = limit
        self._clock = clock
        self._day = clock().date()
        self._used: dict[str, int] = defaultdict(int)
        self._lock = threading.Lock()

    def _roll(self) -> None:
        today = self._clock().date()
        if today != self._day:
            self._day = today
            self._used.clear()

    def used(self, key: str) -> int:
        with self._lock:
            self._roll()
            return self._used[key]

    def has_room(self, key: str) -> bool:
        return self.used(key) < self.limit

    def consume(self, key: str, amount: int) -> None:
        with self._lock:
            self._roll()
            self._used[key] += max(0, amount)

    def seconds_until_reset(self) -> int:
        now = self._clock()
        midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        return max(1, math.ceil((midnight - now).total_seconds()))


class ConcurrencyGate:
    """Caps in-flight model calls; sheds load instead of queueing forever."""

    def __init__(self, limit: int, wait_timeout_s: float) -> None:
        self._semaphore = asyncio.Semaphore(limit)
        self._wait_timeout_s = wait_timeout_s

    @asynccontextmanager
    async def slot(self) -> AsyncIterator[None]:
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=self._wait_timeout_s)
        except TimeoutError as exc:
            raise Unavailable(
                "The service is busy. Please retry shortly.", retry_after=_BUSY_RETRY_AFTER_S
            ) from exc
        try:
            yield
        finally:
            self._semaphore.release()
