"""Server-side admin sessions.

Signing in with the admin password creates a random 256-bit session id, kept in memory and carried in an
HttpOnly, SameSite=Strict cookie scoped to the admin API. Page scripts never see it, and the password is not
kept anywhere in the browser. A session ends when it has been idle too long, when it reaches its maximum age,
or when the admin signs out. Restarting the server signs everyone out.
"""

from __future__ import annotations

import secrets
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import Request, Response

from app.core.config import Settings
from app.core.constants import ADMIN_PREFIX, Environment

ADMIN_COOKIE = "claims_admin"
_ID_BYTES = 32


@dataclass
class AdminSession:
    created: float
    last_seen: float


class AdminSessionStore:
    def __init__(
        self,
        *,
        idle_ttl_s: float,
        max_age_s: float,
        max_sessions: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._idle_ttl = idle_ttl_s
        self._max_age = max_age_s
        self._max = max_sessions
        self._clock = clock
        self._sessions: OrderedDict[str, AdminSession] = OrderedDict()
        self._lock = threading.Lock()

    def create(self) -> tuple[str, AdminSession]:
        session_id = secrets.token_urlsafe(_ID_BYTES)  # always fresh: a sign-in never reuses an id
        now = self._clock()
        session = AdminSession(created=now, last_seen=now)
        with self._lock:
            self._sweep(now)
            while len(self._sessions) >= self._max:
                self._sessions.popitem(last=False)
            self._sessions[session_id] = session
        return session_id, session

    def get(self, session_id: str | None) -> AdminSession | None:
        """The live session behind this id, counted as activity; None if unknown or ended."""
        if not session_id:
            return None
        now = self._clock()
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None
            if self._ended(session, now):
                del self._sessions[session_id]
                return None
            session.last_seen = now
            self._sessions.move_to_end(session_id)
            return session

    def expires_at(self, session: AdminSession) -> datetime:
        """The earlier of the idle limit and the maximum age, as a wall-clock time."""
        now = self._clock()
        remaining = min(self._idle_ttl - (now - session.last_seen), self._max_age - (now - session.created))
        return datetime.now(UTC) + timedelta(seconds=max(0.0, remaining))

    def delete(self, session_id: str | None) -> None:
        if session_id:
            with self._lock:
                self._sessions.pop(session_id, None)

    def _ended(self, session: AdminSession, now: float) -> bool:
        return now - session.last_seen >= self._idle_ttl or now - session.created >= self._max_age

    def _sweep(self, now: float) -> None:
        for session_id in [key for key, session in self._sessions.items() if self._ended(session, now)]:
            del self._sessions[session_id]


class AdminCookie:
    """Reads and writes the admin cookie with hardened attributes."""

    def __init__(self, settings: Settings) -> None:
        self._secure = settings.app_env is Environment.PRODUCTION  # plain http is fine on localhost
        self._max_age = int(settings.admin_session_max_age_s)

    @staticmethod
    def value(request: Request) -> str | None:
        return request.cookies.get(ADMIN_COOKIE)

    def set(self, response: Response, session_id: str) -> None:
        response.set_cookie(
            ADMIN_COOKIE,
            session_id,
            max_age=self._max_age,
            path=ADMIN_PREFIX,  # sent to the admin API only, never to the public one
            httponly=True,
            secure=self._secure,
            samesite="strict",
        )

    def clear(self, response: Response) -> None:
        response.delete_cookie(
            ADMIN_COOKIE, path=ADMIN_PREFIX, httponly=True, secure=self._secure, samesite="strict"
        )
