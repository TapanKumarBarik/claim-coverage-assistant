"""Secret handling helpers. The admin credential is only ever stored as a hash."""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets

_TOKEN_BYTES = 32
_REDACTED = "[REDACTED]"
_MIN_SECRET_LENGTH = 6
_BEARER = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def new_admin_token() -> tuple[str, str]:
    """Return (token, sha256 of token). Show the token once; configure only the hash."""
    token = secrets.token_urlsafe(_TOKEN_BYTES)
    return token, sha256_hex(token)


def token_matches(supplied: str | None, expected_sha256: str | None) -> bool:
    """Constant-time check of a supplied token against the configured hash."""
    if not supplied or not expected_sha256:
        return False
    return hmac.compare_digest(sha256_hex(supplied), expected_sha256.strip().lower())


class Redactor:
    """Scrubs configured secret values and bearer tokens from text before it is logged."""

    def __init__(self, secret_values: list[str] | None = None) -> None:
        self._secrets: set[str] = set()
        for value in secret_values or []:
            self.add(value)

    def add(self, secret: str) -> None:
        if len(secret) >= _MIN_SECRET_LENGTH:
            self._secrets.add(secret)

    def discard(self, secret: str) -> None:
        self._secrets.discard(secret)

    def scrub(self, text: str) -> str:
        for secret in sorted(self._secrets, key=len, reverse=True):
            text = text.replace(secret, _REDACTED)
        return _BEARER.sub(f"Bearer {_REDACTED}", text)
