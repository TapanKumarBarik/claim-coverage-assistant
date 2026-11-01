"""Claim handling: one request through admission, guardrails, routing, the agents and the audit trail.

resolve credentials -> admit (lockout, rate, budgets) -> input guards -> concierge (small model)
    smalltalk / off-topic -> short reply            attack -> block + strike
    claim -> evidence (whole contract or scoped retrieval) -> coverage agent (thinking model)
          -> output guards -> citation verification -> response
Every path ends in exactly one governance event.
"""

from __future__ import annotations

import logging
from dataclasses import replace
from datetime import UTC, date, datetime
from typing import Any

from app.agents.harness import AgentHarness, AgentRun
from app.agents.outputs import ModelAssessment, RouteDecision
from app.agents.skills import concierge, coverage, query_rewrite
from app.agents.skills.library import SkillSet
from app.agents.tools import ToolContext
from app.api.schemas import (
    AnalyzeOutcome,
    AnalyzeRequest,
    AssessmentResponse,
    DocumentUsed,
    EvidenceItem,
    ReplyResponse,
    RetrievalInfo,
)
from app.catalog.domain import Contract, DocKind
from app.catalog.store import Store
from app.conversations.service import ConversationService
from app.core.config import Settings
from app.core.constants import (
    CredentialSource,
    ErrorCode,
    GuardCode,
    Intent,
    Language,
    Outcome,
    RetrievalMode,
    Verdict,
)
from app.core.errors import (
    AppError,
    BudgetExhausted,
    Conflict,
    GuardrailBlocked,
    InvalidInput,
    LockedOut,
    NotFound,
    RateLimited,
)
from app.core.i18n import Msg, message
from app.core.identity import ClientId
from app.credentials.provider import LlmProvider, ResolvedLlm
from app.governance.recorder import GovernanceRecorder, RunTelemetry
from app.guardrails.base import InputPipeline
from app.guardrails.citations import (
    DECISIVE,
    VerifiedCitation,
    confidence,
    evidence_strength,
    verify_citations,
)
from app.guardrails.output import OutputGuard, PromptLeak
from app.llm.errors import LLMError
from app.llm.port import Embedder
from app.retrieval.policy import EvidenceLedger, PolicyView
from app.retrieval.ranker import rank_chunks
from app.services.admission import AdmissionControl

log = logging.getLogger(__name__)

MAX_REWRITE_QUERIES = 5

_OUTCOME_BY_ERROR: tuple[tuple[type[AppError], Outcome], ...] = (
    (LockedOut, Outcome.LOCKED_OUT),
    (BudgetExhausted, Outcome.BUDGET_EXHAUSTED),
    (RateLimited, Outcome.RATE_LIMITED),
    (GuardrailBlocked, Outcome.BLOCKED),
)


def _outcome_for(error: AppError) -> Outcome:
    return next((outcome for kind, outcome in _OUTCOME_BY_ERROR if isinstance(error, kind)), Outcome.ERROR)


class ClaimService:
    def __init__(
        self,
        *,
        store: Store,
        provider: LlmProvider,
        harness: AgentHarness,
        skills: SkillSet,
        input_pipeline: InputPipeline,
        output_guard: OutputGuard,
        admission: AdmissionControl,
        recorder: GovernanceRecorder,
        conversations: ConversationService,
        embedder: Embedder | None,
        settings: Settings,
    ) -> None:
        self._store = store
        self._provider = provider
        self._harness = harness
        self._skills = skills
        self._input = input_pipeline
        self._output = output_guard
        self._admission = admission
        self._recorder = recorder
        self._conversations = conversations
        self._embedder = embedder
        self._settings = settings

    async def handle(
        self, request: AnalyzeRequest, *, client: ClientId, request_id: str, session_id: str | None
    ) -> AnalyzeOutcome:
        telemetry = RunTelemetry(request_id=request_id, client=client, language=request.language)
        try:
            outcome = await self._handle(request, client, session_id, telemetry)
        except AppError as error:
            self._recorder.record(telemetry.to_event(_outcome_for(error), error.code))
            raise
        except Exception:
            self._recorder.record(telemetry.to_event(Outcome.ERROR, ErrorCode.INTERNAL))
            raise
        answered = isinstance(outcome, AssessmentResponse)
        self._recorder.record(telemetry.to_event(Outcome.ANSWERED if answered else Outcome.REPLIED))
        return outcome

    # --- pipeline ---------------------------------------------------------------------

    async def _handle(
        self, request: AnalyzeRequest, client: ClientId, session_id: str | None, telemetry: RunTelemetry
    ) -> AnalyzeOutcome:
        resolved = self._provider.resolve(session_id)
        telemetry.credential_source = resolved.source
        self._admission.admit(client, resolved.source)

        contract = self._store.catalog.contract(request.contract_id)
        if contract is None:
            raise NotFound("Unknown contract.")
        telemetry.contract_id = contract.id
        today = datetime.now(UTC).date()
        loss_date = request.loss_date or today
        if loss_date > today:
            raise InvalidInput("The loss date cannot be in the future.")

        text = self._check_input(request, client, telemetry)
        route = await self._route(text, resolved, request.language, client, telemetry)

        if route.output.intent is Intent.CLAIM:
            outcome: AnalyzeOutcome = await self._assess(
                request, text, contract, loss_date, resolved, client, telemetry
            )
        else:
            outcome = self._reply(route, request.language, client, telemetry)
        self._conversations.record(client=client, contract_id=contract.id, question=text, outcome=outcome)
        return outcome

    def _check_input(self, request: AnalyzeRequest, client: ClientId, telemetry: RunTelemetry) -> str:
        result = self._input.run(request.claim)
        telemetry.add_flags(result.flags)
        if not result.blocked:
            return result.text
        telemetry.block(result.text)
        if result.block is GuardCode.INJECTION_PATTERN:
            self._admission.strike(client)
            raise GuardrailBlocked(message(request.language, Msg.BLOCKED))
        if result.block is GuardCode.TOO_LONG:
            raise InvalidInput(f"The message is too long (max {self._settings.max_claim_chars} characters).")
        raise InvalidInput("The message is empty.")

    async def _route(
        self, text: str, resolved: ResolvedLlm, language: Language, client: ClientId, telemetry: RunTelemetry
    ) -> AgentRun[RouteDecision]:
        try:
            run = await self._harness.run(
                self._skills.concierge,
                llm=resolved.llm,
                language=language,
                user=concierge.user_message(text),
            )
        except GuardrailBlocked:  # the provider's content filter objected to the message
            self._admission.strike(client)
            telemetry.flag(GuardCode.ATTACK_INTENT)
            raise
        self._account(run, resolved, client, telemetry)
        telemetry.intent = run.output.intent
        if run.output.intent is Intent.ATTACK:
            telemetry.flag(GuardCode.ATTACK_INTENT)
            telemetry.block(text)
            self._admission.strike(client)
            raise GuardrailBlocked(message(language, Msg.BLOCKED))
        return run

    def _reply(
        self, route: AgentRun[RouteDecision], language: Language, client: ClientId, telemetry: RunTelemetry
    ) -> ReplyResponse:
        try:
            (cleaned,), flags = self._output.scrub([route.output.reply])
        except PromptLeak:
            telemetry.flag(GuardCode.PROMPT_LEAK)
            self._admission.strike(client)
            raise
        telemetry.add_flags(flags)
        return ReplyResponse(
            request_id=telemetry.request_id,
            generated_at=datetime.now(UTC),
            intent=route.output.intent,
            language=language,
            text=cleaned or message(language, Msg.FALLBACK_REPLY),
            model=route.models[-1],
            latency_ms=telemetry.elapsed_ms(),
        )

    async def _assess(
        self,
        request: AnalyzeRequest,
        text: str,
        contract: Contract,
        loss_date: date,
        resolved: ResolvedLlm,
        client: ClientId,
        telemetry: RunTelemetry,
    ) -> AssessmentResponse:
        language = request.language
        view = PolicyView.resolve(self._store, contract, loss_date)
        if view is None:
            raise Conflict(message(language, Msg.NO_DOCUMENTS))

        embedder = self._embedder if resolved.source is CredentialSource.SERVER else None
        ledger = EvidenceLedger(view)
        mode = await self._seed_evidence(view, ledger, text, resolved, embedder, language, client, telemetry)
        telemetry.retrieval_mode = mode

        whole_contract = mode is RetrievalMode.FULL_CONTEXT
        skill = self._skills.coverage
        if whole_contract:  # nothing left to look up, so no tools and a single turn
            skill = replace(skill, tools=(), max_steps=1)
        run = await self._harness.run(
            skill,
            llm=resolved.llm,
            language=language,
            user=coverage.user_message(contract, loss_date, ledger.render_all(), text),
            tool_context=None if whole_contract else ToolContext(ledger, view.candidates, embedder),
        )
        self._account(run, resolved, client, telemetry)
        return self._build_assessment(run, view, ledger, mode, language, client, telemetry)

    async def _seed_evidence(
        self,
        view: PolicyView,
        ledger: EvidenceLedger,
        text: str,
        resolved: ResolvedLlm,
        embedder: Embedder | None,
        language: Language,
        client: ClientId,
        telemetry: RunTelemetry,
    ) -> RetrievalMode:
        if view.total_chars <= self._settings.full_context_char_budget:
            ledger.seed(c.chunk for c in view.candidates)
            return RetrievalMode.FULL_CONTEXT

        queries = [text]
        try:
            rewrite = await self._harness.run(
                self._skills.query_rewrite,
                llm=resolved.llm,
                language=language,
                user=query_rewrite.user_message(text),
            )
            self._account(rewrite, resolved, client, telemetry)
            queries += [q for q in rewrite.output.queries if q.strip()][:MAX_REWRITE_QUERIES]
        except AppError:
            log.warning("query_rewrite_failed: searching with the raw message only")

        vectors = None
        if embedder is not None and embedder.can_embed and any(c.vector is not None for c in view.candidates):
            try:
                vectors = await embedder.embed(queries)
            except LLMError:
                log.warning("query_embedding_failed: falling back to keyword retrieval")
        chunks, mode = rank_chunks(list(view.candidates), queries, vectors, self._settings.retrieval_top_k)
        ledger.seed(chunks)
        return mode

    def _build_assessment(
        self,
        run: AgentRun[ModelAssessment],
        view: PolicyView,
        ledger: EvidenceLedger,
        mode: RetrievalMode,
        language: Language,
        client: ClientId,
        telemetry: RunTelemetry,
    ) -> AssessmentResponse:
        answer = run.output
        texts = [answer.headline, answer.reasoning, *answer.missing_information, *answer.next_steps]
        try:
            cleaned, flags = self._output.scrub(texts)
        except PromptLeak:
            telemetry.flag(GuardCode.PROMPT_LEAK)
            self._admission.strike(client)
            raise
        telemetry.add_flags(flags)
        headline, reasoning, *rest = cleaned
        n_missing = len(answer.missing_information)
        missing = [t for t in rest[:n_missing] if t]
        next_steps = [t for t in rest[n_missing:] if t]

        verified, dropped = verify_citations(answer.citations, ledger.refs)
        verdict = answer.verdict
        caveats: list[str] = []
        if view.predates:
            caveats.append(message(language, Msg.PREDATES))
        if verdict in DECISIVE and not verified:
            verdict = Verdict.AMBIGUOUS
            telemetry.flag(GuardCode.VERDICT_DOWNGRADED)
            caveats.append(message(language, Msg.DOWNGRADED))
        if dropped:
            telemetry.flag(GuardCode.CITATION_DROPPED)
            caveats.append(message(language, Msg.DROPPED, n=dropped))

        strength = evidence_strength(verified, view.kinds)
        if not view.has_contract_text or (verdict in DECISIVE and strength is not DocKind.CG):
            caveats.append(message(language, Msg.SUMMARY_ONLY))
        if mode is not RetrievalMode.FULL_CONTEXT:
            caveats.append(message(language, Msg.PARTIAL, k=len(ledger.refs), n=len(view.candidates)))
        if view.contract.synthetic:
            caveats.append(message(language, Msg.SYNTHETIC))

        score = confidence(verdict, strength, dropped, degraded_retrieval=mode is RetrievalMode.KEYWORD)
        telemetry.intent = Intent.CLAIM
        telemetry.verdict = verdict
        telemetry.confidence = score
        telemetry.citations_verified = len(verified)
        telemetry.citations_dropped = dropped

        return AssessmentResponse(
            request_id=telemetry.request_id,
            generated_at=datetime.now(UTC),
            contract_id=view.contract.id,
            loss_date=view.loss_date,
            language=language,
            verdict=verdict,
            headline=headline,
            reasoning=reasoning,
            confidence=score,
            evidence_strength=strength,
            evidence=[self._evidence_item(item, view) for item in verified],
            missing_information=missing,
            next_steps=next_steps,
            caveats=caveats,
            documents_used=[
                DocumentUsed(
                    document_id=doc.id,
                    title=doc.title,
                    kind=doc.kind,
                    version_id=ver.id,
                    version_label=ver.label,
                    effective_from=ver.effective_from,
                    sha256=ver.sha256[:12],
                )
                for doc, ver in view.pairs
            ],
            retrieval=RetrievalInfo(
                mode=mode, passages_reviewed=len(ledger.refs), passages_total=len(view.candidates)
            ),
            model=run.models[-1],
            latency_ms=telemetry.elapsed_ms(),
            disclaimer=message(language, Msg.DISCLAIMER),
        )

    @staticmethod
    def _evidence_item(item: VerifiedCitation, view: PolicyView) -> EvidenceItem:
        document = view.documents[item.chunk.document_id]
        version = view.versions[item.chunk.document_id]
        return EvidenceItem(
            ref=item.ref,
            role=item.role,
            quote=item.quote,
            section=item.chunk.section,
            page=item.chunk.page,
            passage=item.chunk.text,
            document_id=document.id,
            document_title=document.title,
            document_kind=document.kind,
            version_label=version.label,
            effective_from=version.effective_from,
            source_url=document.source_url,
        )

    def _account(
        self,
        run: AgentRun[Any],
        resolved: ResolvedLlm,
        client: ClientId,
        telemetry: RunTelemetry,
    ) -> None:
        telemetry.add_run(run)
        self._admission.settle(client, run.usage.total, resolved.source)
