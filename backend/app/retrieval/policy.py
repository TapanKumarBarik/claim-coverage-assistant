"""The policy wording in force for one claim, and the ledger of passages shown to the model.

``PolicyView`` answers "which documents, in which versions, apply on the loss date?". The
``EvidenceLedger`` is the single source of citation references: every passage the model sees,
whether pre-loaded or fetched by a tool, gets a stable ref (``c1``, ``c2``...) here, and citation
verification checks quotes against exactly these passages.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date
from html import escape

from app.catalog.domain import AUTHORITY, Chunk, Contract, DocKind, Document, DocumentVersion
from app.catalog.store import Store
from app.retrieval.ranker import Candidate

REF_PREFIX = "c"

_KIND_LABEL: Mapping[DocKind, str] = {
    DocKind.CG: "general conditions (contractual text)",
    DocKind.IPID: "product summary / IPID (a regulated summary, NOT the contract)",
    DocKind.BROCHURE: "marketing brochure (NOT contractual)",
}


@dataclass(frozen=True)
class PolicyView:
    contract: Contract
    loss_date: date
    pairs: tuple[tuple[Document, DocumentVersion], ...]
    predates: bool  # the loss predates every live version, so the earliest one was used
    candidates: tuple[Candidate, ...]

    @classmethod
    def resolve(cls, store: Store, contract: Contract, loss_date: date) -> PolicyView | None:
        pairs: list[tuple[Document, DocumentVersion]] = []
        predates = False
        for document in contract.documents:
            version, early = document.applicable_version(loss_date)
            if version is not None:
                pairs.append((document, version))
                predates = predates or early
        if not pairs:
            return None
        candidates: list[Candidate] = []
        for _, version in pairs:
            chunks = store.chunks(version.id)
            vectors = store.embeddings(version.id)
            usable = vectors is not None and len(vectors) == len(chunks)
            for index, chunk in enumerate(chunks):
                candidates.append(
                    Candidate(chunk, vectors[index] if usable and vectors is not None else None)
                )
        return cls(contract, loss_date, tuple(pairs), predates, tuple(candidates))

    @property
    def documents(self) -> dict[str, Document]:
        return {doc.id: doc for doc, _ in self.pairs}

    @property
    def versions(self) -> dict[str, DocumentVersion]:
        return {doc.id: ver for doc, ver in self.pairs}

    @property
    def kinds(self) -> dict[str, DocKind]:
        return {doc.id: doc.kind for doc, _ in self.pairs}

    @property
    def has_contract_text(self) -> bool:
        return any(kind is DocKind.CG for kind in self.kinds.values())

    @property
    def total_chars(self) -> int:
        return sum(len(c.chunk.text) for c in self.candidates)

    def reading_order(self, chunks: Iterable[Chunk]) -> list[Chunk]:
        """Strongest document first, then document order, then position in the document."""
        position = {doc.id: i for i, (doc, _) in enumerate(self.pairs)}
        kinds = self.kinds
        return sorted(
            chunks, key=lambda c: (-AUTHORITY[kinds[c.document_id]], position[c.document_id], c.ordinal)
        )


class EvidenceLedger:
    def __init__(self, view: PolicyView) -> None:
        self._view = view
        self._refs: dict[str, Chunk] = {}
        self._by_chunk: dict[str, str] = {}

    @property
    def refs(self) -> Mapping[str, Chunk]:
        return self._refs

    def has(self, chunk_id: str) -> bool:
        return chunk_id in self._by_chunk

    def add(self, chunk: Chunk) -> str:
        existing = self._by_chunk.get(chunk.id)
        if existing is not None:
            return existing
        ref = f"{REF_PREFIX}{len(self._refs) + 1}"
        self._refs[ref] = chunk
        self._by_chunk[chunk.id] = ref
        return ref

    def seed(self, chunks: Iterable[Chunk]) -> None:
        """Add the opening evidence in reading order."""
        for chunk in self._view.reading_order(chunks):
            self.add(chunk)

    def render(self, ref: str) -> str:
        chunk = self._refs[ref]
        document = self._view.documents[chunk.document_id]
        version = self._view.versions[chunk.document_id]
        return (
            f'<excerpt ref="{ref}" document="{escape(document.title)}" '
            f'type="{_KIND_LABEL[document.kind]}" '
            f'version="{escape(version.label)}, effective {version.effective_from.isoformat()}" '
            f'section="{escape(chunk.section)}" page="{chunk.page}">\n{chunk.text}\n</excerpt>'
        )

    def render_all(self) -> str:
        return "\n".join(self.render(ref) for ref in self._refs)

    def render_chunks(self, chunks: Iterable[Chunk]) -> str:
        """Add chunks (if new) and render them; used by tools returning passages to the model."""
        return "\n".join(self.render(self.add(chunk)) for chunk in chunks)
