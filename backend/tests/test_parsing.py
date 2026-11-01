from __future__ import annotations

from pathlib import Path

import pytest

from app.catalog.parsing import ParseError, parse_document

BACKEND = Path(__file__).resolve().parent.parent
FOYER_IPID = BACKEND / "data/raw/foyer_mozaik_ipid.pdf"
SYNTHETIC = BACKEND / "data/synthetic/exemple_habitat_cg.md"


@pytest.mark.skipif(not FOYER_IPID.exists(), reason="run scripts/fetch_sources.py first")
def test_ipid_two_column_layout_is_sectioned_in_reading_order() -> None:
    chunks, report = parse_document(FOYER_IPID.read_bytes(), FOYER_IPID.name)

    sections = {c.section for c in chunks}
    assert "Y a-t-il des exclusions de couvertures ?" in sections
    assert "Qu’est ce qui n’est pas assuré ?" in sections
    assert report.pages == 2 and not report.warnings

    exclusions = " ".join(c.text for c in chunks if c.section.startswith("Y a-t-il"))
    assert "inoccupé pendant 120 jours" in exclusions
    # Right-column text must not be interleaved into the left column's sentences.
    insured = " ".join(c.text for c in chunks if c.section == "Qu’est ce qui est assuré ?")
    assert "guerre" not in insured


@pytest.mark.skipif(not FOYER_IPID.exists(), reason="run scripts/fetch_sources.py first")
def test_exclusion_sections_are_pinned_and_symbols_are_clean() -> None:
    chunks, _ = parse_document(FOYER_IPID.read_bytes(), FOYER_IPID.name)
    pinned = {c.section for c in chunks if c.pinned}
    assert any("exclusions" in s for s in pinned)
    assert not any("" in c.text or "" in c.text for c in chunks)


def test_markdown_articles_become_sections_with_clause_text() -> None:
    chunks, report = parse_document(SYNTHETIC.read_bytes(), SYNTHETIC.name)

    by_section = {c.section: c.text for c in chunks}
    assert "Article 9 - Vol dans les locaux communs" in by_section
    assert "fermé à clé" in by_section["Article 9 - Vol dans les locaux communs"]
    assert len(report.sections) >= 20


def test_unsupported_and_empty_files_are_rejected() -> None:
    with pytest.raises(ParseError):
        parse_document(b"x", "notes.docx")
    with pytest.raises(ParseError):
        parse_document(b"too short", "empty.txt")
