"""Admin authentication, request correlation and security headers."""

from __future__ import annotations

import logging
import re
import uuid
from urllib.parse import urlsplit

from fastapi import Request
from starlette.datastructures import MutableHeaders

from app.api.deps import services_of
from app.core.config import Settings
from app.core.constants import REQUEST_ID_PATTERN, Environment, Header
from app.core.errors import Forbidden, NotConfigured, RateLimited, Unauthorized
from app.core.logging import request_id_var
from app.core.secrets import token_matches

log = logging.getLogger(__name__)

ADMIN_ACTOR = "admin"
BEARER_PREFIX = "bearer "
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
HSTS = "max-age=31536000; includeSubDomains"
PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=()"
_REQUEST_ID_RE = re.compile(REQUEST_ID_PATTERN)
_REQUEST_ID_CHARS = 16

CSP = (
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
    "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; "
    "form-action 'self'"
)
# Swagger UI pulls assets from a CDN, so the docs page needs a looser policy (disabled in production).
DOCS_CSP = (
    "default-src 'self' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"
)


class AdminAuthenticator:
    """Verifies the admin bearer token against its configured SHA-256 hash."""

    def __init__(self, expected_sha256: str | None) -> None:
        self._expected = expected_sha256

    @property
    def enabled(self) -> bool:
        return bool(self._expected)

    def verify(self, supplied: str | None) -> bool:
        return token_matches(supplied, self._expected)


def bearer_token(request: Request) -> str | None:
    header = request.headers.get(Header.AUTHORIZATION, "")
    if header[: len(BEARER_PREFIX)].lower() == BEARER_PREFIX:
        return header[len(BEARER_PREFIX) :].strip()
    return None


def authenticate_admin(request: Request, supplied: str | None) -> None:
    """Throttle, then check a password or bearer token. Every attempt counts, so guessing is slow."""
    services = services_of(request)
    if not services.admin_auth.enabled:
        raise NotConfigured("The admin area is disabled on this deployment.")
    client = services.clients.identify(request)
    retry = services.admin_limiter.check(client)
    if retry is not None:
        raise RateLimited("Too many attempts. Try again shortly.", retry_after=retry)
    if not services.admin_auth.verify(supplied):
        log.warning("admin_auth_failed", extra={"client": client})
        raise Unauthorized("Invalid or missing admin credentials.")


def require_admin(request: Request) -> str:
    """FastAPI dependency guarding every /api/admin route.

    A signed-in browser carries the session cookie; scripts may send the token as a bearer instead. A cookie
    is sent by the browser on its own, so changes made with one must come from this site (see below).
    """
    services = services_of(request)
    if services.admin_auth.enabled and services.admin_sessions.get(services.admin_cookie.value(request)):
        if request.method not in SAFE_METHODS:
            require_same_origin(request)
        return ADMIN_ACTOR
    authenticate_admin(request, bearer_token(request))
    return ADMIN_ACTOR


def new_request_id(incoming: str | None) -> str:
    if incoming and _REQUEST_ID_RE.match(incoming):
        return incoming
    return uuid.uuid4().hex[:_REQUEST_ID_CHARS]


def bind_request_id(request: Request) -> str:
    request_id = new_request_id(request.headers.get(Header.REQUEST_ID))
    request.state.request_id = request_id
    request_id_var.set(request_id)
    return request_id


def apply_security_headers(headers: MutableHeaders, settings: Settings) -> None:
    headers["X-Content-Type-Options"] = "nosniff"
    headers["Referrer-Policy"] = "no-referrer"
    headers["X-Frame-Options"] = "DENY"
    headers["Permissions-Policy"] = PERMISSIONS_POLICY
    if settings.app_env is Environment.PRODUCTION:
        headers["Strict-Transport-Security"] = HSTS
    if "content-security-policy" not in headers:
        headers["Content-Security-Policy"] = CSP


def require_same_origin(request: Request) -> None:
    """CSRF defence for cookie-authenticated endpoints, on top of SameSite=Strict.

    Browsers attach ``Origin`` to every state-changing request; if it names another site, refuse.
    Requests without an ``Origin`` (curl, scripts) are not a CSRF vector and pass.
    """
    origin = request.headers.get(Header.ORIGIN)
    if origin is not None and urlsplit(origin).netloc != request.headers.get(Header.HOST, ""):
        raise Forbidden("Cross-origin request refused.")
