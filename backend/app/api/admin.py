"""Admin API: manage contracts, documents and policy versions.

A policy change is a two-step, reviewable operation: upload creates a *draft*
(parsed and indexed, invisible to users) with a change summary against the
previous version; activating it makes it the wording that applies from its
effective date. Every mutation is written to the audit log.
"""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile

from app.api.deps import services_of
from app.api.schemas import AuditEntry, CreateContract, CreateDocument, ErrorBody
from app.api.security import ADMIN_ACTOR, require_admin
from app.catalog import ops
from app.catalog.domain import Catalog, Chunk, Contract, Document, DocumentVersion
from app.core.constants import ADMIN_PREFIX, Tag
from app.core.errors import InvalidInput, NotFound, PayloadTooLarge

DEFAULT_UPLOAD_NAME = "upload.pdf"
MAX_AUDIT_EVENTS = 500
BYTES_PER_MB = 1024 * 1024


class AuditAction(StrEnum):
    CONTRACT_CREATE = "contract.create"
    DOCUMENT_CREATE = "document.create"
    VERSION_UPLOAD = "version.upload"
    VERSION_ACTIVATE = "version.activate"
    VERSION_WITHDRAW = "version.withdraw"
    VERSION_REINDEX = "version.reindex"
    VERSION_DELETE = "version.delete"
    CONVERSATION_DELETE = "conversation.delete"


router = APIRouter(
    prefix=ADMIN_PREFIX,
    tags=[Tag.ADMIN],
    dependencies=[Depends(require_admin)],
    responses={status: {"model": ErrorBody} for status in (401, 429, 503)},
)


@router.get("/catalog", response_model=Catalog, summary="Full catalogue with every version")
async def get_catalog(request: Request) -> Catalog:
    return services_of(request).store.catalog


@router.post("/contracts", response_model=Contract, status_code=201, summary="Create a contract")
async def create_contract(body: CreateContract, request: Request) -> Contract:
    store = services_of(request).store
    contract = ops.create_contract(
        store,
        contract_id=body.id,
        insurer=body.insurer,
        product=body.product,
        country=body.country,
        language=body.language.value,
    )
    store.audit(ADMIN_ACTOR, AuditAction.CONTRACT_CREATE, contract=contract.id)
    return contract


@router.post("/documents", response_model=Document, status_code=201, summary="Add a document to a contract")
async def create_document(body: CreateDocument, request: Request) -> Document:
    store = services_of(request).store
    document = ops.create_document(
        store,
        contract_id=body.contract_id,
        document_id=body.id,
        title=body.title,
        kind=body.kind,
        source_url=body.source_url,
    )
    store.audit(ADMIN_ACTOR, AuditAction.DOCUMENT_CREATE, contract=body.contract_id, document=document.id)
    return document


@router.post(
    "/documents/{document_id}/versions",
    response_model=DocumentVersion,
    status_code=201,
    summary="Upload a new version as a draft",
)
async def upload_version(
    document_id: str,
    request: Request,
    file: UploadFile = File(...),
    label: str = Form(..., min_length=1, max_length=60),
    effective_from: date = Form(...),
) -> DocumentVersion:
    services = services_of(request)
    max_mb = services.settings.max_upload_mb
    data = await file.read(max_mb * BYTES_PER_MB + 1)
    if len(data) > max_mb * BYTES_PER_MB:
        raise PayloadTooLarge(f"File too large (max {max_mb} MB).")
    if not data:
        raise InvalidInput("The uploaded file is empty.")
    version = await ops.create_version(
        services.store,
        services.embedder,
        document_id=document_id,
        data=data,
        filename=file.filename or DEFAULT_UPLOAD_NAME,
        label=label,
        effective_from=effective_from,
    )
    services.store.audit(
        ADMIN_ACTOR,
        AuditAction.VERSION_UPLOAD,
        document=document_id,
        version=version.id,
        sha256=version.sha256[:12],
        effective_from=effective_from.isoformat(),
    )
    return version


@router.get(
    "/versions/{version_id}/chunks",
    response_model=list[Chunk],
    summary="Preview how a version was parsed",
)
async def version_chunks(version_id: str, request: Request) -> list[Chunk]:
    store = services_of(request).store
    if store.catalog.version(version_id) is None:
        raise NotFound("Unknown version.")
    return store.chunks(version_id)


@router.post("/versions/{version_id}/activate", response_model=DocumentVersion, summary="Make a draft live")
async def activate(version_id: str, request: Request) -> DocumentVersion:
    store = services_of(request).store
    version = ops.activate_version(store, version_id)
    store.audit(ADMIN_ACTOR, AuditAction.VERSION_ACTIVATE, version=version_id)
    return version


@router.post(
    "/versions/{version_id}/withdraw",
    response_model=DocumentVersion,
    summary="Take a live version out of use",
)
async def withdraw(version_id: str, request: Request) -> DocumentVersion:
    store = services_of(request).store
    version = ops.withdraw_version(store, version_id)
    store.audit(ADMIN_ACTOR, AuditAction.VERSION_WITHDRAW, version=version_id)
    return version


@router.post("/versions/{version_id}/reindex", response_model=DocumentVersion, summary="Recompute embeddings")
async def reindex(version_id: str, request: Request) -> DocumentVersion:
    services = services_of(request)
    version = await ops.reindex_version(services.store, services.embedder, version_id)
    services.store.audit(ADMIN_ACTOR, AuditAction.VERSION_REINDEX, version=version_id)
    return version


@router.delete("/versions/{version_id}", status_code=204, summary="Delete a draft or withdrawn version")
async def delete_version(version_id: str, request: Request) -> Response:
    store = services_of(request).store
    ops.delete_draft(store, version_id)
    store.audit(ADMIN_ACTOR, AuditAction.VERSION_DELETE, version=version_id)
    return Response(status_code=204)


@router.get("/audit", response_model=list[AuditEntry], summary="Recent catalogue changes")
async def audit(request: Request, limit: int = 100) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = services_of(request).store.read_audit(min(max(limit, 1), MAX_AUDIT_EVENTS))
    return events
