"""Public API routes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Request, Response

from app import __version__
from app.api.deps import services_of
from app.api.schemas import (
    AnalyzeOutcome,
    AnalyzeRequest,
    AnalyzeResult,
    ContractPublic,
    DocumentPublic,
    ErrorBody,
    Example,
    FeedbackInput,
    Health,
    Readiness,
    VersionPublic,
)
from app.catalog.domain import VersionStatus
from app.conversations.models import Feedback
from app.core.constants import API_PREFIX, HealthStatus, Tag
from app.core.errors import RateLimited
from app.examples import EXAMPLES

router = APIRouter(prefix=API_PREFIX, tags=[Tag.PUBLIC])

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {"model": ErrorBody} for status in (403, 404, 409, 413, 422, 428, 429, 502, 503)
}


@router.get("/healthz", response_model=Health, summary="Liveness probe")
async def healthz() -> Health:
    return Health(status=HealthStatus.OK, version=__version__)


@router.get(
    "/readyz",
    response_model=Readiness,
    responses={503: {"model": Readiness}},
    summary="Readiness probe",
)
async def readyz(request: Request, response: Response) -> Readiness:
    services = services_of(request)
    live = sum(
        1
        for contract in services.store.catalog.contracts
        for document in contract.documents
        for version in document.versions
        if version.status is VersionStatus.LIVE
    )
    report = Readiness(
        ready=live > 0,
        contracts=len(services.store.catalog.contracts),
        live_versions=live,
        llm_configured=services.llm_ready,
        embeddings_configured=services.embeddings_ready,
        byo_enabled=services.settings.allow_byo_credentials,
    )
    if not report.ready:
        response.status_code = 503
    return report


@router.get("/contracts", response_model=list[ContractPublic], summary="Contracts that can be queried")
async def list_contracts(request: Request) -> list[ContractPublic]:
    today = datetime.now(UTC).date()
    out: list[ContractPublic] = []
    for contract in services_of(request).store.catalog.contracts:
        documents = []
        for document in contract.documents:
            version, _ = document.applicable_version(today)
            if version is None:
                continue
            documents.append(
                DocumentPublic(
                    id=document.id,
                    title=document.title,
                    kind=document.kind,
                    source_url=document.source_url,
                    current=VersionPublic(
                        id=version.id, label=version.label, effective_from=version.effective_from
                    ),
                )
            )
        if documents:
            out.append(
                ContractPublic(
                    id=contract.id,
                    insurer=contract.insurer,
                    product=contract.product,
                    country=contract.country,
                    language=contract.language,
                    synthetic=contract.synthetic,
                    documents=documents,
                )
            )
    return out


@router.get("/examples", response_model=list[Example], summary="Preset example claims")
async def list_examples(request: Request) -> list[Example]:
    known = {c.id for c in services_of(request).store.catalog.contracts}
    return [example for example in EXAMPLES if example.contract_id in known]


@router.post(
    "/analyze",
    response_model=AnalyzeResult,
    responses=ERROR_RESPONSES,
    summary="Assess a claim, or answer a greeting",
)
async def analyze(body: AnalyzeRequest, request: Request) -> AnalyzeOutcome:
    services = services_of(request)
    return await services.claims.handle(
        body,
        client=services.clients.identify(request),
        request_id=request.state.request_id,
        session_id=services.cookies.cookie_value(request),
    )


@router.post(
    "/feedback",
    response_model=Feedback,
    responses={status: {"model": ErrorBody} for status in (404, 422, 429)},
    summary="Like or dislike an answer",
)
async def feedback(body: FeedbackInput, request: Request) -> Feedback:
    services = services_of(request)
    client = services.clients.identify(request)
    retry = services.feedback_limiter.check(client)
    if retry is not None:
        raise RateLimited("Too many ratings. Try again shortly.", retry_after=retry)
    return services.conversations.rate(body.request_id, client, body.rating, body.comment)
