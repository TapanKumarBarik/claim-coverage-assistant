"""Connect, describe and disconnect a visitor's Azure OpenAI credentials."""

from __future__ import annotations

import logging
from urllib.parse import urlsplit

from app.api.schemas import CredentialsInput, SessionStatus
from app.core.config import Settings
from app.core.constants import CredentialSource, ModelTier
from app.core.errors import CredentialsRejected, Forbidden, RateLimited, Unavailable
from app.core.identity import ClientId
from app.core.ratelimit import RateLimiter
from app.core.secrets import Redactor
from app.credentials.endpoint import validate_endpoint
from app.credentials.provider import LlmProvider
from app.credentials.sessions import SessionStore
from app.llm.azure import AzureConnection
from app.llm.errors import LLMError, LLMTransientError
from app.llm.factory import LlmFactory
from app.llm.port import LLM
from app.llm.types import ChatMessage, Role

log = logging.getLogger(__name__)

PROBE_SYSTEM = "Reply with the single word OK."
PROBE_USER = "ping"
REJECTED = "The endpoint, key or deployment name was rejected. Check all three and try again."


class CredentialConnector:
    def __init__(
        self,
        *,
        settings: Settings,
        factory: LlmFactory,
        sessions: SessionStore,
        provider: LlmProvider,
        limiter: RateLimiter,
        redactor: Redactor,
    ) -> None:
        self._settings = settings
        self._factory = factory
        self._sessions = sessions
        self._provider = provider
        self._limiter = limiter
        self._redactor = redactor

    async def connect(self, client: ClientId, data: CredentialsInput) -> tuple[str, SessionStatus]:
        """Verify the credentials with a real call, and only then keep them (in memory)."""
        if not self._settings.allow_byo_credentials:
            raise Forbidden("Bring-your-own credentials are disabled on this server.")
        retry = self._limiter.check(client)
        if retry is not None:
            raise RateLimited("Too many connection attempts. Try again shortly.", retry_after=retry)

        connection = AzureConnection(
            endpoint=validate_endpoint(data.endpoint, self._settings.azure_endpoint_allowed_suffixes),
            api_key=data.api_key,
            api_version=data.api_version or self._settings.azure_openai_api_version,
            reasoning_deployment=data.reasoning_deployment,
            fast_deployment=data.fast_deployment,
        )
        llm = self._factory.wrap(self._factory.client(connection))
        await self._probe(llm, connection)

        self._redactor.add(data.api_key.get_secret_value())
        session_id = self._sessions.create(connection, llm)
        log.info(
            "credentials_connected", extra={"client": client, "host": urlsplit(connection.endpoint).hostname}
        )
        return session_id, self.status(session_id)

    async def _probe(self, llm: LLM, connection: AzureConnection) -> None:
        deployments = {ModelTier.REASONING: connection.reasoning_deployment}
        if connection.fast_deployment and connection.fast_deployment != connection.reasoning_deployment:
            deployments[ModelTier.FAST] = connection.fast_deployment
        for tier in deployments:
            try:
                await llm.chat(
                    tier=tier,
                    messages=[ChatMessage(Role.SYSTEM, PROBE_SYSTEM), ChatMessage(Role.USER, PROBE_USER)],
                )
            except LLMTransientError as exc:
                raise Unavailable("Azure OpenAI is not reachable right now. Try again shortly.") from exc
            except LLMError as exc:
                log.info("credentials_probe_failed", extra={"tier": tier.value, "error": type(exc).__name__})
                raise CredentialsRejected(REJECTED) from exc

    def status(self, session_id: str | None) -> SessionStatus:
        entry = self._sessions.get(session_id)
        if entry is not None:
            connection = entry.connection
            return SessionStatus(
                source=CredentialSource.SESSION,
                endpoint_host=urlsplit(connection.endpoint).hostname,
                reasoning_deployment=connection.reasoning_deployment,
                fast_deployment=connection.fast_deployment,
                expires_at=self._sessions.expires_at(entry),
                byo_allowed=self._settings.allow_byo_credentials,
            )
        server = self._provider.server_connection
        return SessionStatus(
            source=CredentialSource.SERVER if self._provider.server_configured else CredentialSource.NONE,
            endpoint_host=urlsplit(server.endpoint).hostname if server else None,
            reasoning_deployment=server.reasoning_deployment if server else None,
            fast_deployment=server.fast_deployment if server else None,
            expires_at=None,
            byo_allowed=self._settings.allow_byo_credentials,
        )

    def disconnect(self, session_id: str | None) -> None:
        self._sessions.delete(session_id)
