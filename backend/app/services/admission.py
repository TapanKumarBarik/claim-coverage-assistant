"""Admission control: who may spend model tokens right now.

Four independent brakes, checked cheapest first: a lockout for clients caught attacking, a request
rate limit, a per-client daily token budget, and (only when the operator pays) a global daily token
budget. Anything blocked here costs no model call.
"""

from __future__ import annotations

import math
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from app.core.constants import GLOBAL_KEY, CredentialSource
from app.core.errors import BudgetExhausted, LockedOut, RateLimited
from app.core.identity import ClientId
from app.core.ratelimit import RateLimiter, UsageMeter


class AbuseGuard:
    """Strikes for hostile behaviour (injection attempts, prompt extraction). Enough strikes in a
    window lock the client out for a cool-down."""

    def __init__(
        self,
        *,
        strike_limit: int,
        window_s: float,
        lockout_s: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = strike_limit
        self._window_s = window_s
        self._lockout_s = lockout_s
        self._clock = clock
        self._strikes: dict[str, deque[float]] = defaultdict(deque)
        self._locked_until: dict[str, float] = {}
        self._lock = threading.Lock()
        self.strikes_total = 0

    def ensure_not_locked(self, client: ClientId) -> None:
        with self._lock:
            until = self._locked_until.get(client)
            if until is None:
                return
            remaining = until - self._clock()
            if remaining <= 0:
                del self._locked_until[client]
                return
        raise LockedOut(
            "Too many blocked messages. Please wait before trying again.", retry_after=math.ceil(remaining)
        )

    def strike(self, client: ClientId) -> bool:
        """Record a strike. True if it caused a lockout."""
        now = self._clock()
        with self._lock:
            self.strikes_total += 1
            strikes = self._strikes[client]
            while strikes and now - strikes[0] >= self._window_s:
                strikes.popleft()
            strikes.append(now)
            if len(strikes) >= self._limit:
                self._locked_until[client] = now + self._lockout_s
                strikes.clear()
                return True
            return False

    def locked_now(self) -> int:
        now = self._clock()
        with self._lock:
            return sum(1 for until in self._locked_until.values() if until > now)


class AdmissionControl:
    def __init__(
        self,
        *,
        limiter: RateLimiter,
        abuse: AbuseGuard,
        client_tokens: UsageMeter,
        global_tokens: UsageMeter,
    ) -> None:
        self._limiter = limiter
        self._abuse = abuse
        self._client_tokens = client_tokens
        self._global_tokens = global_tokens

    @property
    def abuse(self) -> AbuseGuard:
        return self._abuse

    @property
    def client_limit(self) -> int:
        return self._client_tokens.limit

    @property
    def global_limit(self) -> int:
        return self._global_tokens.limit

    @property
    def global_used(self) -> int:
        return self._global_tokens.used(GLOBAL_KEY)

    def admit(self, client: ClientId, source: CredentialSource) -> None:
        self._abuse.ensure_not_locked(client)
        retry = self._limiter.check(client)
        if retry is not None:
            raise RateLimited("Too many requests. Please wait a moment.", retry_after=retry)
        if not self._client_tokens.has_room(client):
            raise BudgetExhausted(
                "Your daily usage limit has been reached.",
                retry_after=self._client_tokens.seconds_until_reset(),
            )
        # The shared budget protects the operator's bill, so it only applies to operator-paid calls.
        if source is CredentialSource.SERVER and not self._global_tokens.has_room(GLOBAL_KEY):
            raise BudgetExhausted(
                "The daily limit for this public demo has been reached.",
                retry_after=self._global_tokens.seconds_until_reset(),
            )

    def settle(self, client: ClientId, tokens: int, source: CredentialSource) -> None:
        self._client_tokens.consume(client, tokens)
        if source is CredentialSource.SERVER:
            self._global_tokens.consume(GLOBAL_KEY, tokens)

    def strike(self, client: ClientId) -> bool:
        return self._abuse.strike(client)
