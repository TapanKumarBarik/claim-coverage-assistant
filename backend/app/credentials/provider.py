"""Decides which model connection serves a request."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.constants import CredentialSource
from app.core.errors import CredentialsRequired
from app.credentials.sessions import SessionStore
from app.llm.azure import AzureConnection
from app.llm.port import LLM

CREDENTIALS_REQUIRED_MESSAGE = "Add your Azure OpenAI settings to use the assistant."


@dataclass(frozen=True)
class ResolvedLlm:
    llm: LLM
    source: CredentialSource


class LlmProvider:
    """A visitor's own credentials win; otherwise the operator's, if any; otherwise none.

    On a public instance the operator leaves the server credentials empty, so strangers can only
    spend their own quota.
    """

    def __init__(
        self,
        *,
        sessions: SessionStore,
        server_llm: LLM | None,
        server_connection: AzureConnection | None,
    ) -> None:
        self._sessions = sessions
        self._server_llm = server_llm
        self.server_connection = server_connection

    @property
    def server_configured(self) -> bool:
        return self._server_llm is not None

    def resolve(self, session_id: str | None) -> ResolvedLlm:
        entry = self._sessions.get(session_id)
        if entry is not None:
            return ResolvedLlm(entry.llm, CredentialSource.SESSION)
        if self._server_llm is not None:
            return ResolvedLlm(self._server_llm, CredentialSource.SERVER)
        raise CredentialsRequired(CREDENTIALS_REQUIRED_MESSAGE)
