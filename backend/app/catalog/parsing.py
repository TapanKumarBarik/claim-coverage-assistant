"""Turn a policy document (PDF, Markdown or text) into section-aware chunks.

Insurance documents are not prose: IPIDs are two-column forms with a mandated
heading structure, and general conditions are numbered articles. Chunking by
the document's own structure keeps a clause and its heading together, which is
what makes a citation meaningful ("Art. 7 - Vol, p. 4") instead of an arbitrary
window of text.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from itertools import pairwise
from typing import Any

# Heading patterns. IPID headings are fixed by EU regulation 2017/1469, so one
# list covers every insurer's IPID in a given language.
_IPID_HEADINGS = [
    r"de quel type d.assurance",
    r"qu.est[- ]ce qui est assur",
    r"qu.est[- ]ce qui n.est pas assur",
    r"y a-t-il des exclusions",
    r"o[uù] suis-je couvert",
    r"quelles sont mes obligations",
    r"quand et comment",
    r"quand commence",
    r"comment puis-je r[ée]silier",
    r"what is this type of insurance",
    r"what is insured",
    r"what is not insured",
    r"are there any restrictions",
    r"where am i covered",
    r"what are my obligations",
    r"when and how do i pay",
    r"when does the cover start",
    r"how can i cancel",
]
_IPID_RE = re.compile(r"^\W*(" + "|".join(_IPID_HEADINGS) + r")", re.IGNORECASE)
_ARTICLE_RE = re.compile(
    r"^\W*((?:article|art\.?|chapitre|titre|section)\s*[\dIVXLC]+[^\n]{0,100})$",
    re.IGNORECASE,
)
_NUMBERED_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){0,2})[.)]?\s+([A-ZÀ-Ý][^\n]{2,90})$")
_MD_RE = re.compile(r"^#{1,4}\s+(.+)$")
_BULLET_RE = re.compile(r"^\s*([✓✔✗•▪●■!\-–—*]|\d+[.)])\s+")
_PINNED_RE = re.compile(
    r"exclusion|n.est pas assur|d[ée]finition|obligation|pr[ée]vention|"
    r"not insured|restriction|definition",
    re.IGNORECASE,
)

MAX_CHUNK_CHARS = 1400
MIN_USEFUL_CHARS = 200  # per page; below this a PDF is probably a scan


class ParseError(ValueError):
    """The uploaded file could not be turned into usable text."""


@dataclass(frozen=True)
class ParsedChunk:
    section: str
    page: int
    text: str
    pinned: bool


@dataclass
class ParseReport:
    pages: int = 0
    chars: int = 0
    chunks: int = 0
    sections: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class _Line:
    page: int
    text: str


def _group_lines(words: list[dict[str, Any]], tol: float = 3.0) -> list[list[dict[str, Any]]]:
    lines: list[list[dict[str, Any]]] = []
    for word in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if lines and abs(lines[-1][0]["top"] - word["top"]) <= tol:
            lines[-1].append(word)
        else:
            lines.append([word])
    for line in lines:
        line.sort(key=lambda w: w["x0"])
    return lines


def _crosses(line: list[dict[str, Any]], x: float, min_gap: float = 8.0) -> bool:
    """True if the line has text spanning x or no real whitespace gap around it."""
    for left, right in pairwise(line):
        if left["x1"] <= x <= right["x0"]:
            return bool((right["x0"] - left["x1"]) < min_gap)
    first, last = line[0], line[-1]
    return bool(first["x0"] < x < last["x1"])  # x lies inside a word


def _detect_gutter(lines: list[list[dict[str, Any]]], width: float) -> float | None:
    """Find the x of a column gutter, or None for a single-column page."""
    if len(lines) < 8:
        return None
    best_x, best_cross = None, len(lines) + 1
    for x in range(int(width * 0.38), int(width * 0.62), 2):
        crossing = sum(1 for line in lines if _crosses(line, float(x)))
        if crossing < best_cross:
            best_x, best_cross = float(x), crossing
    if best_x is not None and best_cross / len(lines) <= 0.25:
        return best_x
    return None


def _page_lines(page: Any, number: int) -> list[_Line]:
    words = page.extract_words(x_tolerance=1.5, y_tolerance=2, keep_blank_chars=False)
    if not words:
        return []
    lines = _group_lines(words)
    gutter = _detect_gutter(lines, float(page.width))
    out: list[_Line] = []
    if gutter is None:
        for line in lines:
            out.append(_Line(number, " ".join(w["text"] for w in line)))
        return out

    left_buf: list[str] = []
    right_buf: list[str] = []

    def flush() -> None:
        out.extend(_Line(number, t) for t in left_buf)
        out.extend(_Line(number, t) for t in right_buf)
        left_buf.clear()
        right_buf.clear()

    for line in lines:
        if _crosses(line, gutter):
            flush()
            out.append(_Line(number, " ".join(w["text"] for w in line)))
            continue
        left = [w["text"] for w in line if (w["x0"] + w["x1"]) / 2 < gutter]
        right = [w["text"] for w in line if (w["x0"] + w["x1"]) / 2 >= gutter]
        if left:
            left_buf.append(" ".join(left))
        if right:
            right_buf.append(" ".join(right))
    flush()
    return out


def _pdf_lines(data: bytes) -> tuple[list[_Line], int]:
    import pdfplumber  # imported lazily: ingestion-only dependency

    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            lines: list[_Line] = []
            for index, page in enumerate(pdf.pages, start=1):
                lines.extend(_page_lines(page, index))
            return lines, len(pdf.pages)
    except Exception as exc:  # pdfminer raises a zoo of exception types
        raise ParseError(f"Could not read the PDF: {exc}") from exc


def _text_lines(text: str) -> tuple[list[_Line], int]:
    pages = text.split("\f")
    lines = [_Line(index, raw) for index, page in enumerate(pages, start=1) for raw in page.splitlines()]
    return lines, len(pages)


def _heading_split(line: str) -> tuple[str, str] | None:
    """Return (heading, remainder-of-line) when the line opens a section."""
    stripped = line.strip()
    if m := _MD_RE.match(stripped):
        return m.group(1).strip(), ""
    if m := _IPID_RE.match(stripped):
        end = stripped.find("?", m.start(1))
        if end == -1:
            end = m.end(1)
            tail = stripped[end:].split(" ", 1)
            heading = (m.group(1) + (tail[0] if tail else "")).strip()
            return heading, ""
        return stripped[: end + 1].strip(" ✓!"), stripped[end + 1 :].strip()
    if m := _ARTICLE_RE.match(stripped):
        return m.group(1).strip(), ""
    if m := _NUMBERED_RE.match(stripped):
        return f"{m.group(1)} {m.group(2)}".strip(), ""
    return None


_PRIVATE_USE = re.compile("[-]")
_SYMBOLS = {"": "✓", "": "✗", "": "•", "": "▪"}


def _clean(text: str) -> str:
    """Map Wingdings-style private-use glyphs to real symbols; drop the rest."""
    for private, symbol in _SYMBOLS.items():
        text = text.replace(private, symbol)
    return re.sub(r"\s+", " ", _PRIVATE_USE.sub("", text)).strip()


def _join(parts: list[str]) -> str:
    text = ""
    for part in parts:
        if text.endswith("-") and part[:1].islower():
            text += part  # soft hyphenation: "garde-" + "meubles"
        else:
            text = f"{text} {part}".strip()
    return re.sub(r"\s+", " ", text)


_Paragraph = tuple[int, str]  # (page the paragraph starts on, text)


def _sections(lines: list[_Line]) -> list[tuple[str, list[_Paragraph]]]:
    """Group lines into (heading, paragraphs)."""
    result: list[tuple[str, list[_Paragraph]]] = []
    heading = "Introduction"
    paragraphs: list[_Paragraph] = []
    current: list[_Line] = []

    def close_paragraph() -> None:
        if current:
            paragraphs.append((current[0].page, _join([line.text for line in current])))
            current.clear()

    def close_section() -> None:
        close_paragraph()
        if any(text.strip() for _, text in paragraphs):
            result.append((heading, list(paragraphs)))
        paragraphs.clear()

    for line in lines:
        text = line.text.strip()
        if not text:
            close_paragraph()
            continue
        split = _heading_split(text)
        if split:
            close_section()
            heading = split[0]
            if split[1]:
                current.append(_Line(line.page, split[1]))
            continue
        if _BULLET_RE.match(text):
            close_paragraph()
        current.append(_Line(line.page, text))
    close_section()
    return result


def _chunk(heading: str, paragraphs: list[_Paragraph]) -> list[ParsedChunk]:
    pinned = bool(_PINNED_RE.search(heading))
    chunks: list[ParsedChunk] = []
    buf, buf_page = "", 1
    for page, paragraph in paragraphs:
        if buf and len(buf) + len(paragraph) + 1 > MAX_CHUNK_CHARS:
            chunks.append(ParsedChunk(heading, buf_page, buf, pinned))
            buf = ""
        while len(paragraph) > MAX_CHUNK_CHARS:  # a single huge paragraph
            cut = paragraph.rfind(". ", 0, MAX_CHUNK_CHARS)
            cut = cut + 1 if cut > 200 else MAX_CHUNK_CHARS
            chunks.append(ParsedChunk(heading, page, paragraph[:cut].strip(), pinned))
            paragraph = paragraph[cut:].strip()
        if not buf:
            buf_page = page
        buf = f"{buf}\n{paragraph}".strip() if buf else paragraph
    if buf:
        chunks.append(ParsedChunk(heading, buf_page, buf, pinned))
    return chunks


def parse_document(data: bytes, filename: str) -> tuple[list[ParsedChunk], ParseReport]:
    """Parse an uploaded document into chunks plus a quality report."""
    name = filename.lower()
    if name.endswith(".pdf"):
        lines, pages = _pdf_lines(data)
    elif name.endswith((".md", ".txt")):
        try:
            lines, pages = _text_lines(data.decode("utf-8"))
        except UnicodeDecodeError as exc:
            raise ParseError("Text files must be UTF-8 encoded.") from exc
    else:
        raise ParseError("Unsupported file type; upload a PDF, .md or .txt file.")

    lines = [_Line(line.page, _clean(line.text)) for line in lines]
    report = ParseReport(pages=pages)
    report.chars = sum(len(line.text) for line in lines)
    if report.chars < MIN_USEFUL_CHARS * max(pages, 1) * 0.5:
        raise ParseError("Almost no text could be extracted. Scanned PDFs need OCR before upload.")

    chunks: list[ParsedChunk] = []
    for heading, paragraphs in _sections(lines):
        report.sections.append(heading)
        chunks.extend(_chunk(heading, paragraphs))
    report.chunks = len(chunks)

    if len(report.sections) <= 1:
        report.warnings.append(
            "No section headings were recognised; the document was split by size only, "
            "so citations will be less precise."
        )
    if any(len(c.text) < 40 for c in chunks):
        report.warnings.append("Some very short chunks were produced; check the layout.")
    return chunks, report
