"""Validation of a visitor-supplied Azure OpenAI endpoint.

The server will make HTTPS requests to whatever URL is accepted here, carrying the visitor's key.
That is a server-side request forgery (SSRF) surface, so the rule is a strict allowlist, not a
blocklist: HTTPS only, a single DNS label under a known Azure suffix, no IP literals, no
credentials in the URL, no custom port, no path.
"""

from __future__ import annotations

import ipaddress
import re
from collections.abc import Sequence
from urllib.parse import urlsplit

from app.core.errors import InvalidInput

HTTPS = "https"
DEFAULT_HTTPS_PORT = 443
_LABEL = re.compile(r"^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$")
_REJECTED = "The endpoint must look like https://<resource>.openai.azure.com"


def validate_endpoint(raw: str, allowed_suffixes: Sequence[str]) -> str:
    """Return the canonical ``https://<host>`` or raise ``InvalidInput``."""
    try:
        parts = urlsplit(raw.strip())
        port = parts.port
    except ValueError as exc:
        raise InvalidInput(_REJECTED) from exc

    host = (parts.hostname or "").lower()
    if parts.scheme != HTTPS or not host:
        raise InvalidInput(_REJECTED)
    if parts.username or parts.password or port not in (None, DEFAULT_HTTPS_PORT):
        raise InvalidInput(_REJECTED)
    if parts.path not in ("", "/") or parts.query or parts.fragment:
        raise InvalidInput("Use the resource root, without a path or query string.")
    if _is_ip_literal(host):
        raise InvalidInput(_REJECTED)

    suffix = next((s for s in allowed_suffixes if host.endswith(s.lower())), None)
    if suffix is None or not _LABEL.match(host[: -len(suffix)]):
        raise InvalidInput(f"Only Azure OpenAI hosts are accepted ({', '.join(allowed_suffixes)}).")
    return f"{HTTPS}://{host}"


def _is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return False
    return True
