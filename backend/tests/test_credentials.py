"""Bring-your-own credentials: endpoint allowlist (SSRF), in-memory sessions and the cookie."""

from __future__ import annotations

import pytest
from fastapi import Response
from pydantic import SecretStr

from app.core.config import Settings
from app.core.constants import Environment
from app.core.errors import InvalidInput
from app.credentials.endpoint import validate_endpoint
from app.credentials.sessions import SESSION_COOKIE, SessionCookie, SessionStore
from app.llm.azure import AzureConnection
from tests.conftest import FakeLLM

SUFFIXES = [".openai.azure.com", ".cognitiveservices.azure.com", ".services.ai.azure.com"]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://myres.openai.azure.com", "https://myres.openai.azure.com"),
        ("https://MyRes.OpenAI.Azure.com/", "https://myres.openai.azure.com"),
        ("  https://myres.openai.azure.com:443  ", "https://myres.openai.azure.com"),
        ("https://my-res-2.cognitiveservices.azure.com", "https://my-res-2.cognitiveservices.azure.com"),
        ("https://proj.services.ai.azure.com", "https://proj.services.ai.azure.com"),
    ],
)
def test_azure_endpoints_are_accepted_and_canonicalised(raw: str, expected: str) -> None:
    assert validate_endpoint(raw, SUFFIXES) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "http://myres.openai.azure.com",  # no TLS
        "https://169.254.169.254",  # cloud metadata service
        "https://127.0.0.1",
        "https://[::1]",
        "https://localhost",
        "https://myres.openai.azure.com:8443",  # custom port
        "https://user:pw@myres.openai.azure.com",  # credentials in the URL
        "https://myres.openai.azure.com/openai/deployments",  # path
        "https://myres.openai.azure.com/?next=x",
        "https://myres.openai.azure.com.evil.com",  # suffix lookalike
        "https://evil.com/.openai.azure.com",
        "https://openai.azure.com.attacker.example",
        "https://a.b.openai.azure.com",  # nested labels are not a single resource name
        "https://openai.azure.com",  # no resource name at all
        "ftp://myres.openai.azure.com",
        "myres.openai.azure.com",
        "",
    ],
)
def test_everything_else_is_refused(raw: str) -> None:
    with pytest.raises(InvalidInput):
        validate_endpoint(raw, SUFFIXES)


def connection() -> AzureConnection:
    return AzureConnection(
        "https://r.openai.azure.com", SecretStr("k" * 20), "2025-04-01-preview", "gpt-thinking"
    )


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_sessions_expire_when_idle_and_activity_extends_them() -> None:
    clock = Clock()
    store = SessionStore(idle_ttl_s=100, max_sessions=10, clock=clock)
    session_id = store.create(connection(), FakeLLM())  # type: ignore[arg-type]
    clock.now = 60
    assert store.get(session_id) is not None  # touched: the idle timer restarts
    clock.now = 140
    assert store.get(session_id) is not None
    clock.now = 400
    assert store.get(session_id) is None and len(store) == 0


def test_the_oldest_session_is_evicted_at_the_cap_and_removal_is_reported() -> None:
    removed: list[str] = []
    store = SessionStore(
        idle_ttl_s=1000, max_sessions=2, on_remove=lambda e: removed.append(e.connection.reasoning_deployment)
    )
    first = store.create(connection(), FakeLLM())  # type: ignore[arg-type]
    store.create(connection(), FakeLLM())  # type: ignore[arg-type]
    store.create(connection(), FakeLLM())  # type: ignore[arg-type]
    assert len(store) == 2 and store.get(first) is None and removed == ["gpt-thinking"]

    keep = store.create(connection(), FakeLLM())  # type: ignore[arg-type]
    store.delete(keep)
    assert store.get(keep) is None
    store.delete(None)  # harmless


def test_session_ids_are_unguessable_and_unique() -> None:
    store = SessionStore(idle_ttl_s=1000, max_sessions=100)
    ids = {store.create(connection(), FakeLLM()) for _ in range(20)}  # type: ignore[arg-type]
    assert len(ids) == 20 and all(len(i) >= 40 for i in ids)


def test_cookie_is_httponly_samesite_strict_and_secure_in_production(settings: Settings) -> None:
    for env, secure in ((Environment.TEST, False), (Environment.PRODUCTION, True)):
        cookie = SessionCookie(settings.model_copy(update={"app_env": env}))
        response = Response()
        cookie.set_cookie(response, "abc")
        header = response.headers["set-cookie"].lower()
        assert f"{SESSION_COOKIE}=abc" in header
        assert "httponly" in header and "samesite=strict" in header and "path=/api" in header
        assert ("secure" in header.replace("samesite", "")) is secure

    cleared = Response()
    cookie.clear_cookie(cleared)
    assert "max-age=0" in cleared.headers["set-cookie"].lower()
