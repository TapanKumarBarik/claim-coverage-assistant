"""Domain model: contracts, documents, versions and chunks.

A *contract* (e.g. "Foyer Mozaik") is described by one or more *documents*
(general conditions, IPID, brochure). Each document has *versions*; only
``live`` versions are used to answer claims, and the one applied to a claim is
the version in force on the loss date.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from pydantic import Field

from app.core.models import ApiModel


class DocKind(StrEnum):
    CG = "cg"  # general conditions: the contractual text
    IPID = "ipid"  # regulated product summary
    BROCHURE = "brochure"  # marketing material


# How much weight a document can carry. A product summary or brochure can support
# a "likely" answer; only the contractual text can support a confident one.
AUTHORITY: dict[DocKind, int] = {DocKind.CG: 3, DocKind.IPID: 2, DocKind.BROCHURE: 1}


class VersionStatus(StrEnum):
    DRAFT = "draft"  # uploaded and parsed, not yet used for answers
    LIVE = "live"
    WITHDRAWN = "withdrawn"


class ChangeSummary(ApiModel):
    compared_to: str | None = None
    added: list[str] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)
    modified: list[str] = Field(default_factory=list)
    unchanged: int = 0


class DocumentVersion(ApiModel):
    id: str
    label: str
    status: VersionStatus
    effective_from: date
    sha256: str
    filename: str
    pages: int
    n_chunks: int
    has_embeddings: bool = False
    created_at: datetime
    activated_at: datetime | None = None
    parse_warnings: list[str] = Field(default_factory=list)
    change_summary: ChangeSummary | None = None


class Document(ApiModel):
    id: str
    title: str
    kind: DocKind
    source_url: str | None = None
    versions: list[DocumentVersion] = Field(default_factory=list)

    def live_versions(self) -> list[DocumentVersion]:
        live = [v for v in self.versions if v.status is VersionStatus.LIVE]
        return sorted(live, key=lambda v: v.effective_from)

    def applicable_version(self, on: date) -> tuple[DocumentVersion | None, bool]:
        """Version in force on ``on``. The flag is True when ``on`` predates every
        live version and the earliest one is returned as a best available fallback."""
        live = self.live_versions()
        if not live:
            return None, False
        in_force = [v for v in live if v.effective_from <= on]
        if in_force:
            return in_force[-1], False
        return live[0], True


class Contract(ApiModel):
    id: str
    insurer: str
    product: str
    country: str = "LU"
    language: str = "fr"
    synthetic: bool = False
    documents: list[Document] = Field(default_factory=list)


class Catalog(ApiModel):
    schema_version: int = 1
    contracts: list[Contract] = Field(default_factory=list)

    def contract(self, contract_id: str) -> Contract | None:
        return next((c for c in self.contracts if c.id == contract_id), None)

    def document(self, document_id: str) -> tuple[Contract, Document] | None:
        for contract in self.contracts:
            for document in contract.documents:
                if document.id == document_id:
                    return contract, document
        return None

    def version(self, version_id: str) -> tuple[Contract, Document, DocumentVersion] | None:
        for contract in self.contracts:
            for document in contract.documents:
                for version in document.versions:
                    if version.id == version_id:
                        return contract, document, version
        return None


class Chunk(ApiModel):
    id: str
    document_id: str
    version_id: str
    ordinal: int
    section: str
    page: int
    text: str
    pinned: bool = False
