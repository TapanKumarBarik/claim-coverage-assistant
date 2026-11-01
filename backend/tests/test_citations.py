from __future__ import annotations

from app.agents.outputs import ModelCitation
from app.catalog.domain import Chunk, DocKind
from app.guardrails.citations import confidence, evidence_strength, quote_matches, verify_citations

SOURCE = "Aucune garantie n’est due lorsque le local commun était ouvert, non verrouillé ou laissé ouvert."


def chunk(doc: str = "d1", text: str = SOURCE) -> Chunk:
    return Chunk(
        id=f"{doc}#0", document_id=doc, version_id=f"{doc}@1", ordinal=0, section="S", page=1, text=text
    )


def test_quote_matching_tolerates_typography_and_case() -> None:
    assert quote_matches("aucune garantie n'est due lorsque le local commun", SOURCE)
    assert quote_matches("Aucune  garantie\nn’est due", SOURCE)


def test_quote_matching_supports_ellipsis_in_order() -> None:
    assert quote_matches("Aucune garantie n’est due … non verrouillé", SOURCE)
    assert not quote_matches("non verrouillé … Aucune garantie n’est due", SOURCE)


def test_fabricated_and_trivial_quotes_are_rejected() -> None:
    assert not quote_matches("Le vol est toujours garanti dans les locaux communs", SOURCE)
    assert not quote_matches("local", SOURCE)  # too short to prove anything


def test_verify_drops_unknown_refs_and_fabrications_and_dedupes() -> None:
    refs = {"c1": chunk()}
    cites = [
        ModelCitation(ref="c1", quote="Aucune garantie n’est due lorsque", role="excludes"),
        ModelCitation(ref="C1", quote="aucune garantie n'est due lorsque", role="excludes"),  # duplicate
        ModelCitation(ref="c9", quote="Aucune garantie n’est due lorsque", role="excludes"),  # unknown ref
        ModelCitation(ref="c1", quote="Le vélo est toujours garanti partout", role="grants"),  # invented
    ]
    verified, dropped = verify_citations(cites, refs)
    assert len(verified) == 1
    assert dropped == 2


def test_confidence_is_derived_from_evidence_not_self_reported() -> None:
    assert confidence("not_covered", DocKind.CG, 0, False) == "high"
    assert confidence("not_covered", DocKind.CG, 1, False) == "medium"  # a citation was dropped
    assert confidence("not_covered", DocKind.CG, 0, True) == "medium"  # degraded retrieval
    assert confidence("covered", DocKind.IPID, 0, False) == "medium"
    assert confidence("covered", DocKind.BROCHURE, 0, False) == "low"
    assert confidence("covered", None, 0, False) == "low"
    assert confidence("ambiguous", DocKind.CG, 0, False) is None


def test_evidence_strength_is_the_strongest_verified_source() -> None:
    from app.guardrails.citations import VerifiedCitation

    kinds = {"cg": DocKind.CG, "ipid": DocKind.IPID}
    items = [
        VerifiedCitation("c1", "q", "grants", chunk("ipid")),
        VerifiedCitation("c2", "q", "excludes", chunk("cg")),
    ]
    assert evidence_strength(items, kinds) is DocKind.CG
    assert evidence_strength([], kinds) is None
