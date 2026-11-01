"""Composition root: the only place that knows which concrete class implements which interface."""

from __future__ import annotations

import secrets
from dataclasses import dataclass

import httpx

from app.agents.harness import AgentHarness
from app.agents.skills import concierge
from app.agents.skills.library import build_skills
from app.agents.tools import ListSectionsTool, ReadSectionTool, SearchPolicyTool, ToolRegistry
from app.api.admin_sessions import AdminCookie, AdminSessionStore
from app.api.schemas import FEEDBACK_COMMENT_MAX_CHARS
from app.api.security import AdminAuthenticator
from app.catalog.store import Store
from app.conversations.service import ConversationService
from app.conversations.store import ConversationStore
from app.core.config import Settings
from app.core.identity import ClientIdentity
from app.core.ratelimit import RateLimiter, SlidingWindowLimiter, UsageMeter
from app.core.secrets import Redactor
from app.credentials.connector import CredentialConnector
from app.credentials.provider import LlmProvider
from app.credentials.sessions import SessionCookie, SessionEntry, SessionStore
from app.governance.recorder import GovernanceRecorder
from app.governance.service import GovernanceService
from app.governance.store import GovernanceStore
from app.guardrails import citations
from app.guardrails.base import GuardInfo, InputGuard, InputPipeline
from app.guardrails.input_guards import InjectionDetector, PiiRedactor, TextNormalizer
from app.guardrails.output import OutputGuard, OutputSanitizer, PromptLeakGuard
from app.llm.azure import AzureConnection, new_http_client
from app.llm.factory import LlmFactory
from app.llm.port import LLM, Embedder
from app.services.admission import AbuseGuard, AdmissionControl
from app.services.claims import ClaimService

_CANARY_BYTES = 8


class Auto:
    """Marks 'build this from settings', as distinct from an explicit None ('none at all')."""


AUTO = Auto()


@dataclass(frozen=True)
class Services:
    settings: Settings
    store: Store
    claims: ClaimService
    governance: GovernanceService
    connector: CredentialConnector
    cookies: SessionCookie
    clients: ClientIdentity
    admin_auth: AdminAuthenticator
    admin_limiter: RateLimiter
    admin_sessions: AdminSessionStore
    admin_cookie: AdminCookie
    conversations: ConversationService
    feedback_limiter: RateLimiter
    embedder: Embedder | None
    llm_ready: bool
    embeddings_ready: bool
    http_client: httpx.AsyncClient


def _forget_key(entry: SessionEntry, redactor: Redactor) -> None:
    """When a session ends, its key no longer needs scrubbing from logs."""
    if entry.connection.api_key is not None:
        redactor.discard(entry.connection.api_key.get_secret_value())


def build_services(
    settings: Settings,
    *,
    redactor: Redactor,
    llm: LLM | Auto | None = AUTO,
    embedder: Embedder | Auto | None = AUTO,
) -> Services:
    http_client = new_http_client()
    factory = LlmFactory(settings, http_client)

    # --- the operator's own model connection, if any ---------------------------------------
    server_connection = AzureConnection.from_settings(settings) if isinstance(llm, Auto) else None
    server_embedder: Embedder | None = None
    if isinstance(llm, Auto):
        server_llm = None
        if server_connection is not None:
            azure = factory.client(server_connection)
            server_llm = factory.wrap(azure)
            server_embedder = azure if azure.can_embed else None
    else:
        server_llm = factory.wrap(llm) if llm is not None else None
    if not isinstance(embedder, Auto):
        server_embedder = embedder

    # --- credentials: visitor sessions over the operator's fallback ------------------------
    sessions = SessionStore(
        idle_ttl_s=settings.session_idle_ttl_s,
        max_sessions=settings.max_sessions,
        on_remove=lambda entry: _forget_key(entry, redactor),
    )
    provider = LlmProvider(sessions=sessions, server_llm=server_llm, server_connection=server_connection)
    connector = CredentialConnector(
        settings=settings,
        factory=factory,
        sessions=sessions,
        provider=provider,
        limiter=SlidingWindowLimiter(settings.connect_rate_per_minute),
        redactor=redactor,
    )

    # --- guardrails, agents and admission --------------------------------------------------
    canary = secrets.token_hex(_CANARY_BYTES)
    input_guards: list[InputGuard] = [
        TextNormalizer(settings.max_claim_chars),
        PiiRedactor(),
        InjectionDetector(),
    ]
    output_guard = OutputGuard(OutputSanitizer(), PromptLeakGuard(canary))
    registry = ToolRegistry(
        [ListSectionsTool(), SearchPolicyTool(), ReadSectionTool()],
        timeout_s=settings.tool_timeout_s,
        max_result_chars=settings.tool_result_max_chars,
    )
    harness = AgentHarness(
        registry,
        canary=canary,
        max_tool_calls_per_step=settings.agent_max_tool_calls_per_step,
        deadline_s=settings.agent_deadline_s,
    )
    skills = build_skills(settings)
    admission = AdmissionControl(
        limiter=SlidingWindowLimiter(settings.analyze_rate_per_minute),
        abuse=AbuseGuard(
            strike_limit=settings.abuse_strike_limit,
            window_s=settings.abuse_window_s,
            lockout_s=settings.abuse_lockout_s,
        ),
        client_tokens=UsageMeter(settings.client_daily_token_budget),
        global_tokens=UsageMeter(settings.global_daily_token_budget),
    )

    # --- catalogue, governance and the claim service ----------------------------------------
    store = Store(settings.storage_dir)
    governance_store = GovernanceStore(settings.storage_dir, max_mb=settings.governance_max_file_mb)
    guard_infos: list[GuardInfo] = [
        *(g.info for g in input_guards),
        concierge.INFO,
        *output_guard.infos,
        citations.INFO,
    ]
    breaker = server_llm.breaker if server_llm is not None else None
    governance = GovernanceService(
        store=governance_store,
        settings=settings,
        admission=admission,
        breaker=breaker,
        skills=skills,
        tools=registry,
        guards=guard_infos,
        server_connection=server_connection,
    )
    conversations = ConversationService(
        ConversationStore(settings.storage_dir),
        # A rating's comment gets the same personal-data masking as a question.
        InputPipeline([TextNormalizer(FEEDBACK_COMMENT_MAX_CHARS), PiiRedactor()]),
        retention_days=settings.conversation_retention_days,
        max_records=settings.conversation_max_records,
    )
    claims = ClaimService(
        store=store,
        provider=provider,
        harness=harness,
        skills=skills,
        input_pipeline=InputPipeline(input_guards),
        output_guard=output_guard,
        admission=admission,
        recorder=GovernanceRecorder(governance_store),
        conversations=conversations,
        embedder=server_embedder,
        settings=settings,
    )
    return Services(
        settings=settings,
        store=store,
        claims=claims,
        governance=governance,
        connector=connector,
        cookies=SessionCookie(settings),
        clients=ClientIdentity(settings),
        admin_auth=AdminAuthenticator(
            settings.admin_token_sha256.get_secret_value() if settings.admin_token_sha256 else None
        ),
        admin_limiter=SlidingWindowLimiter(settings.admin_auth_rate_per_minute),
        admin_sessions=AdminSessionStore(
            idle_ttl_s=settings.admin_session_idle_ttl_s,
            max_age_s=settings.admin_session_max_age_s,
            max_sessions=settings.max_admin_sessions,
        ),
        admin_cookie=AdminCookie(settings),
        conversations=conversations,
        feedback_limiter=SlidingWindowLimiter(settings.feedback_rate_per_minute),
        embedder=server_embedder,
        llm_ready=server_llm is not None,
        embeddings_ready=server_embedder is not None and server_embedder.can_embed,
        http_client=http_client,
    )
