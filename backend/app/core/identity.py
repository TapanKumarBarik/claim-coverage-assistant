"""Pseudonymous client identity: raw IP addresses are never logged or stored."""

from __future__ import annotations

import hashlib
import re
import secrets
from typing import NewType

from fastapi import Request

from app.core.config import Settings
from app.core.constants import Environment, Header

ClientId = NewType("ClientId", str)

_IPV4_WITH_PORT = re.compile(r"^(\d{1,3}(?:\.\d{1,3}){3}):\d+$")
_DIGEST_CHARS = 16


class ClientIdentity:
    def __init__(self, settings: Settings) -> None:
        self._production = settings.app_env is Environment.PRODUCTION
        configured = settings.privacy_salt.get_secret_value() if settings.privacy_salt else None
        self._salt = configured or secrets.token_hex(16)  # per-process when not configured

    def _address(self, request: Request) -> str:
        """Behind App Service the platform appends the real client (``ip:port``) to
        X-Forwarded-For, so the right-most entry is the only one a caller cannot forge."""
        if self._production:
            last = request.headers.get(Header.FORWARDED_FOR, "").split(",")[-1].strip()
            if last:
                match = _IPV4_WITH_PORT.match(last)
                return match.group(1) if match else last
        return request.client.host if request.client else "unknown"

    def identify(self, request: Request) -> ClientId:
        digest = hashlib.sha256(f"{self._salt}:{self._address(request)}".encode()).hexdigest()
        return ClientId(digest[:_DIGEST_CHARS])
