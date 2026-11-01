"""Catalog operations: ingest a document version, publish it, retire it.

The lifecycle is deliberately two-step. Uploading parses and indexes a file into
a *draft* (nothing user-facing changes). An admin reviews the parse report and
the change summary against the previous version, then activates it. Past
versions stay on disk, so a claim with an older loss date is still assessed
against the wording that applied then.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import yaml

from app.catalog.domain import (
    ChangeSummary,
    Chunk,
    Contract,
    DocKind,
    Document,
    DocumentVersion,
    VersionStatus,
)
from app.catalog.parsing import ParsedChunk, ParseError, parse_document
from app.catalog.store import Store
from app.core.errors import Conflict, InvalidInput, NotFound, Unavailable
from app.llm.errors import LLMError
from app.llm.port import Embedder

log = logging.getLogger(__name__)

_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")
_SYSTEM_ACTOR = "system"
_BOOTSTRAP_ACTION = "bootstrap"


def _now() -> datetime:
    return datetime.now(UTC)


def validate_id(value: str, what: str) -> str:
    if not _ID_RE.match(value):
        raise InvalidInput(f"{what} id must be 3-63 chars: lowercase letters, digits and dashes.")
    return value


def _sections(chunks: list[Chunk] | list[ParsedChunk]) -> dict[str, str]:
    grouped: dict[str, list[str]] = {}
    for chunk in chunks:
        grouped.setdefault(chunk.section, []).append(chunk.text)
    return {name: "\n".join(parts) for name, parts in grouped.items()}


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def summarize_changes(old: list[Chunk], new: list[ParsedChunk], compared_to: str | None) -> ChangeSummary:
    """Section-level diff, enough for an admin to sanity-check an upload."""
    before, after = _sections(old), _sections(new)
    common = [s for s in after if s in before]
    modified = [s for s in common if _norm(before[s]) != _norm(after[s])]
    return ChangeSummary(
        compared_to=compared_to,
        added=[s for s in after if s not in before],
        removed=[s for s in before if s not in after],
        modified=modified,
        unchanged=len(common) - len(modified),
    )


def _baseline(document: Document) -> DocumentVersion | None:
    live = document.live_versions()
    if live:
        return live[-1]
    return document.versions[-1] if document.versions else None


def _next_version_id(document: Document) -> str:
    numbers = [int(v.id.rsplit("@", 1)[1]) for v in document.versions if v.id.rsplit("@", 1)[-1].isdigit()]
    return f"{document.id}@{max(numbers, default=0) + 1}"


async def embed_chunks(
    embedder: Embedder | None, chunks: list[ParsedChunk] | list[Chunk]
) -> np.ndarray | None:
    """Embed section + text so the heading's meaning travels with the chunk."""
    if embedder is None or not embedder.can_embed or not chunks:
        return None
    try:
        return await embedder.embed([f"{c.section}\n{c.text}" for c in chunks])
    except LLMError:
        log.warning("embedding_failed: keeping keyword-only retrieval for this version")
        return None


def create_contract(
    store: Store,
    *,
    contract_id: str,
    insurer: str,
    product: str,
    country: str = "LU",
    language: str = "fr",
    synthetic: bool = False,
) -> Contract:
    validate_id(contract_id, "Contract")
    with store.lock:
        if store.catalog.contract(contract_id):
            raise Conflict(f"Contract '{contract_id}' already exists.")
        contract = Contract(
            id=contract_id,
            insurer=insurer.strip(),
            product=product.strip(),
            country=country,
            language=language,
            synthetic=synthetic,
        )
        store.catalog.contracts.append(contract)
        store.save_catalog()
    return contract


def create_document(
    store: Store,
    *,
    contract_id: str,
    document_id: str,
    title: str,
    kind: DocKind,
    source_url: str | None = None,
) -> Document:
    validate_id(document_id, "Document")
    with store.lock:
        contract = store.catalog.contract(contract_id)
        if contract is None:
            raise NotFound(f"Unknown contract '{contract_id}'.")
        if store.catalog.document(document_id):
            raise Conflict(f"Document '{document_id}' already exists.")
        document = Document(id=document_id, title=title.strip(), kind=kind, source_url=source_url)
        contract.documents.append(document)
        store.save_catalog()
    return document


async def create_version(
    store: Store,
    embedder: Embedder | None,
    *,
    document_id: str,
    data: bytes,
    filename: str,
    label: str,
    effective_from: date,
    status: VersionStatus = VersionStatus.DRAFT,
) -> DocumentVersion:
    """Parse, chunk and (when possible) embed an upload as a new version."""
    found = store.catalog.document(document_id)
    if found is None:
        raise NotFound(f"Unknown document '{document_id}'.")
    _, document = found

    try:
        parsed, report = await asyncio.to_thread(parse_document, data, filename)
    except ParseError as exc:
        raise InvalidInput(str(exc)) from exc
    if not parsed:
        raise InvalidInput("No text could be extracted from the file.")

    sha = hashlib.sha256(data).hexdigest()
    previous = _baseline(document)
    if any(v.sha256 == sha and v.status is not VersionStatus.WITHDRAWN for v in document.versions):
        raise Conflict("An identical file has already been uploaded for this document.")

    with store.lock:
        version_id = _next_version_id(document)
    chunks = [
        Chunk(
            id=f"{version_id}#{index}",
            document_id=document_id,
            version_id=version_id,
            ordinal=index,
            section=p.section,
            page=p.page,
            text=p.text,
            pinned=p.pinned,
        )
        for index, p in enumerate(parsed)
    ]
    embeddings = await embed_chunks(embedder, chunks)
    changes = summarize_changes(store.chunks(previous.id), parsed, previous.id) if previous else None

    version = DocumentVersion(
        id=version_id,
        label=label.strip() or version_id,
        status=status,
        effective_from=effective_from,
        sha256=sha,
        filename=filename,
        pages=report.pages,
        n_chunks=len(chunks),
        has_embeddings=embeddings is not None,
        created_at=_now(),
        activated_at=_now() if status is VersionStatus.LIVE else None,
        parse_warnings=report.warnings,
        change_summary=changes,
    )
    store.write_version(version_id, source=data, source_name=filename, chunks=chunks, embeddings=embeddings)
    with store.lock:
        document.versions.append(version)
        store.save_catalog()
    return version


def _locate(store: Store, version_id: str) -> tuple[Document, DocumentVersion]:
    found = store.catalog.version(version_id)
    if found is None:
        raise NotFound(f"Unknown version '{version_id}'.")
    return found[1], found[2]


def activate_version(store: Store, version_id: str) -> DocumentVersion:
    with store.lock:
        document, version = _locate(store, version_id)
        if version.status is VersionStatus.LIVE:
            return version
        clash = next(
            (
                v
                for v in document.live_versions()
                if v.effective_from == version.effective_from and v.id != version.id
            ),
            None,
        )
        if clash:
            raise Conflict(
                f"Version {clash.id} is already live with the same effective date. "
                "Withdraw it first or choose a different effective date."
            )
        version.status = VersionStatus.LIVE
        version.activated_at = _now()
        store.save_catalog()
        return version


def withdraw_version(store: Store, version_id: str) -> DocumentVersion:
    with store.lock:
        _, version = _locate(store, version_id)
        if version.status is not VersionStatus.LIVE:
            raise Conflict("Only live versions can be withdrawn.")
        version.status = VersionStatus.WITHDRAWN
        store.save_catalog()
        return version


def delete_draft(store: Store, version_id: str) -> None:
    with store.lock:
        document, version = _locate(store, version_id)
        if version.status is VersionStatus.LIVE:
            raise Conflict("Withdraw a live version before deleting it.")
        document.versions.remove(version)
        store.save_catalog()
    store.delete_version(version_id)


async def reindex_version(store: Store, embedder: Embedder | None, version_id: str) -> DocumentVersion:
    _, version = _locate(store, version_id)
    if embedder is None or not embedder.can_embed:
        raise Unavailable("Embeddings are not configured (set the embedding deployment).")
    embeddings = await embed_chunks(embedder, store.chunks(version_id))
    if embeddings is None:
        raise Unavailable("The embedding service failed; try again shortly.")
    store.write_embeddings(version_id, embeddings)
    with store.lock:
        version.has_embeddings = True
        store.save_catalog()
    return version


def _read_seed(manifest: Path, data_dir: Path) -> list[dict[str, Any]]:
    """Blocking: parse the manifest and attach the bytes of every file that exists."""
    if not manifest.exists():
        log.warning("seed_manifest_missing", extra={"path": str(manifest)})
        return []
    spec = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    contracts: list[dict[str, Any]] = []
    for item in spec.get("contracts", []):
        usable: list[dict[str, Any]] = []
        for doc in item.get("documents", []):
            path = data_dir / doc["file"]
            if path.exists():
                usable.append({**doc, "_bytes": path.read_bytes(), "_name": path.name})
            else:
                log.warning("seed_file_missing", extra={"file": doc["file"]})
        if usable:
            contracts.append({**item, "documents": usable})
    return contracts


async def bootstrap_from_manifest(
    store: Store, embedder: Embedder | None, manifest: Path, data_dir: Path
) -> int:
    """Seed an empty store from sources.yaml. Missing files are skipped, not fatal."""
    created = 0
    for item in await asyncio.to_thread(_read_seed, manifest, data_dir):
        create_contract(
            store,
            contract_id=item["id"],
            insurer=item["insurer"],
            product=item["product"],
            country=item.get("country", "LU"),
            language=item.get("language", "fr"),
            synthetic=item.get("synthetic", False),
        )
        for doc in item["documents"]:
            create_document(
                store,
                contract_id=item["id"],
                document_id=doc["id"],
                title=doc["title"],
                kind=DocKind(doc["kind"]),
                source_url=doc.get("source_url"),
            )
            await create_version(
                store,
                embedder,
                document_id=doc["id"],
                data=doc["_bytes"],
                filename=doc["_name"],
                label=doc.get("version_label", "v1"),
                effective_from=date.fromisoformat(str(doc["effective_from"])),
                status=VersionStatus.LIVE,
            )
            created += 1
    store.audit(_SYSTEM_ACTOR, _BOOTSTRAP_ACTION, versions=created)
    return created
