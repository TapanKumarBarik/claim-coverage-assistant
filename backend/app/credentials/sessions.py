"""In-memory sessions holding a visitor's Azure OpenAI connection.

Nothing here touches disk. A session is addressed by a 256-bit random id carried in an HttpOnly,
SameSite=Strict cookie, so the key is never readable by page scripts and never sent back to the
browser. Sessions expire when idle, and the oldest is evicted if the cap is reached.
"""

from __future__ import annotations

import secrets
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from fastapi import Request, Response

from app.core.config import Settings
from app.core.constants import Environment
from app.llm.azure import AzureConnection
from app.llm.port import LLM

SESSION_COOKIE = "claims_session"
COOKIE_PATH = "/api"
_ID_BYTES = 32


@dataclass
class SessionEntry:
    connection: AzureConnection
    llm: LLM
    last_seen: float
    created_wall: datetime = field(default_factory=lambda: datetime.now(UTC))


class SessionStore:
    def __init__(
        self,
        *,
        idle_ttl_s: float,
        max_sessions: int,
        clock: Callable[[], float] = time.monotonic,
        on_remove: Callable[[SessionEntry], None] | None = None,
    ) -> None:
        self._ttl = idle_ttl_s
        self._max = max_sessions
        self._clock = clock
        self._on_remove = on_remove or (lambda _: None)
        self._entries: OrderedDict[str, SessionEntry] = OrderedDict()
        self._lock = threading.Lock()

    @property
    def idle_ttl_s(self) -> float:
        return self._ttl

    def __len__(self) -> int:
        return len(self._entries)

    def create(self, connection: AzureConnection, llm: LLM) -> str:
        session_id = secrets.token_urlsafe(_ID_BYTES)
        with self._lock:
            self._sweep()
            while len(self._entries) >= self._max:
                _, evicted = self._entries.popitem(last=False)
                self._on_remove(evicted)
            self._entries[session_id] = SessionEntry(connection, llm, self._clock())
        return session_id

    def get(self, session_id: str | None) -> SessionEntry | None:
        if not session_id:
            return None
        with self._lock:
            entry = self._entries.get(session_id)
            if entry is None:
                return None
            if self._clock() - entry.last_seen >= self._ttl:
                del self._entries[session_id]
                self._on_remove(entry)
                return None
            entry.last_seen = self._clock()
            self._entries.move_to_end(session_id)
            return entry

    def expires_at(self, entry: SessionEntry) -> datetime:
        remaining = max(0.0, self._ttl - (self._clock() - entry.last_seen))
        return datetime.now(UTC) + timedelta(seconds=remaining)

    def delete(self, session_id: str | None) -> None:
        if not session_id:
            return
        with self._lock:
            entry = self._entries.pop(session_id, None)
        if entry is not None:
            self._on_remove(entry)

    def _sweep(self) -> None:
        now = self._clock()
        for session_id in [k for k, e in self._entries.items() if now - e.last_seen >= self._ttl]:
            self._on_remove(self._entries.pop(session_id))


class SessionCookie:
    """Reads and writes the session cookie with hardened attributes."""

    def __init__(self, settings: Settings) -> None:
        self._secure = settings.app_env is Environment.PRODUCTION  # plain http is fine on localhost
        self._max_age = int(settings.session_idle_ttl_s)

    @staticmethod
    def cookie_value(request: Request) -> str | None:
        return request.cookies.get(SESSION_COOKIE)

    def set_cookie(self, response: Response, session_id: str) -> None:
        response.set_cookie(
            SESSION_COOKIE,
            session_id,
            max_age=self._max_age,
            path=COOKIE_PATH,
            httponly=True,
            secure=self._secure,
            samesite="strict",
        )

    def clear_cookie(self, response: Response) -> None:
        response.delete_cookie(
            SESSION_COOKIE, path=COOKIE_PATH, httponly=True, secure=self._secure, samesite="strict"
        )
