"""Verify model citations against the source text and derive confidence.

The model is asked to quote verbatim. We do not trust that: a quote is accepted only if it
appears in the excerpt it points at. Confidence is then computed from what survives
verification, never taken from the model's own say-so.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.agents.outputs import ModelCitation
from app.catalog.domain import AUTHORITY, Chunk, DocKind
from app.core.constants import CitationRole, Confidence, GuardName, GuardStage, Verdict
from app.guardrails.base import GuardInfo

MIN_QUOTE_CHARS = 12
DECISIVE: frozenset[Verdict] = frozenset({Verdict.COVERED, Verdict.NOT_COVERED})

_ELLIPSIS = re.compile(r"\s*(?:…|\.{3})\s*")
_QUOTES = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', " ": " "})
_QUOTE_EDGE = " .,;:"

INFO = GuardInfo(
    GuardName.CITATION_VERIFIER,
    GuardStage.OUTPUT,
    "Every quoted clause must appear verbatim in the excerpt it cites; unverifiable quotes are removed "
    "and an unsupported verdict is downgraded. Confidence is computed from the surviving evidence.",
)


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).translate(_QUOTES)
    return re.sub(r"\s+", " ", text).strip().lower()


def quote_matches(quote: str, source: str) -> bool:
    """True if every fragment of the quote (split on ellipses) appears in order."""
    haystack = normalize(source)
    cursor = 0
    fragments = [f for f in _ELLIPSIS.split(quote) if f.strip()]
    if not fragments:
        return False
    for fragment in fragments:
        needle = normalize(fragment).strip(_QUOTE_EDGE)
        if len(needle) < MIN_QUOTE_CHARS and len(fragments) == 1:
            return False
        position = haystack.find(needle, cursor)
        if position == -1:
            return False
        cursor = position + len(needle)
    return True


@dataclass(frozen=True)
class VerifiedCitation:
    ref: str
    quote: str
    role: CitationRole
    chunk: Chunk


def verify_citations(
    citations: Sequence[ModelCitation], refs: Mapping[str, Chunk]
) -> tuple[list[VerifiedCitation], int]:
    """Return (verified citations, number dropped)."""
    verified: list[VerifiedCitation] = []
    seen: set[tuple[str, str]] = set()
    dropped = 0
    for citation in citations:
        ref = citation.ref.strip().lower()
        chunk = refs.get(ref)
        if chunk is None or not quote_matches(citation.quote, chunk.text):
            dropped += 1
            continue
        key = (ref, normalize(citation.quote))
        if key in seen:
            continue
        seen.add(key)
        verified.append(VerifiedCitation(ref, citation.quote.strip(), citation.role, chunk))
    return verified, dropped


def evidence_strength(verified: Sequence[VerifiedCitation], kinds: Mapping[str, DocKind]) -> DocKind | None:
    """Highest-authority document kind among the verified citations."""
    strongest: DocKind | None = None
    for item in verified:
        kind = kinds[item.chunk.document_id]
        if strongest is None or AUTHORITY[kind] > AUTHORITY[strongest]:
            strongest = kind
    return strongest


def confidence(
    verdict: Verdict, strength: DocKind | None, dropped: int, degraded_retrieval: bool
) -> Confidence | None:
    """High/medium/low for decisive verdicts; None when there is no decision."""
    if verdict not in DECISIVE:
        return None
    if strength is None or strength is DocKind.BROCHURE:
        return Confidence.LOW
    if strength is DocKind.CG and dropped == 0 and not degraded_retrieval:
        return Confidence.HIGH
    return Confidence.MEDIUM
