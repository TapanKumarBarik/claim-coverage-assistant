"""Hybrid retrieval scoped to one contract.

Scoping to the customer's contract *first* is what makes this scale: a corpus of
hundreds of contracts is never searched as one pile, so clauses from different
insurers cannot be mixed up. Within a contract we fuse BM25 with embedding
similarity (reciprocal rank fusion) and always keep exclusion/obligation
sections, because a matching coverage clause is useless without them.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

import numpy as np
from rank_bm25 import BM25Okapi

from app.catalog.domain import Chunk
from app.core.constants import RetrievalMode

_STOPWORDS = frozenset(
    "le la les un une des de du d l et ou en au aux a à est sont que qui qu ce ces se sa son ses "
    "pour par sur sous dans avec sans ne pas plus il elle ils elles vous votre vos nous notre "
    "the an of and or in on at to is are was were be been for with by from it its this that "
    "i my me we our you your has have had".split()
)
RRF_K = 60
MAX_PINNED = 6


def tokenize(text: str) -> list[str]:
    folded = unicodedata.normalize("NFKD", text.lower())
    folded = "".join(ch for ch in folded if not unicodedata.combining(ch))
    tokens = re.findall(r"[a-z0-9]+", folded)
    # Crude French/English plural stripping is enough for lexical matching here.
    return [
        t[:-1] if len(t) >= 4 and t.endswith(("s", "x")) else t
        for t in tokens
        if t not in _STOPWORDS and len(t) > 1
    ]


@dataclass(frozen=True)
class Candidate:
    chunk: Chunk
    vector: np.ndarray | None = None


def _rank_by_score(scores: list[float]) -> list[int]:
    return [i for i in sorted(range(len(scores)), key=lambda i: scores[i], reverse=True) if scores[i] > 0]


def rank_chunks(
    candidates: list[Candidate],
    queries: list[str],
    query_vectors: np.ndarray | None,
    k: int,
) -> tuple[list[Chunk], RetrievalMode]:
    """Return up to ``k`` chunks and the retrieval mode used."""
    if not candidates:
        return [], RetrievalMode.KEYWORD

    rankings: list[list[int]] = []
    bm25 = BM25Okapi([tokenize(c.chunk.section + " " + c.chunk.text) or ["_"] for c in candidates])
    for query in queries:
        tokens = tokenize(query)
        if tokens:
            rankings.append(_rank_by_score(list(bm25.get_scores(tokens))))

    mode = RetrievalMode.KEYWORD
    vector_idx = [i for i, c in enumerate(candidates) if c.vector is not None]
    if query_vectors is not None and vector_idx:
        matrix = np.stack([candidates[i].vector for i in vector_idx])  # type: ignore[misc]
        for query_vector in query_vectors:
            sims = matrix @ query_vector
            order = np.argsort(-sims)
            rankings.append([vector_idx[j] for j in order])
        mode = RetrievalMode.HYBRID

    fused: dict[int, float] = {}
    for ranking in rankings:
        for position, index in enumerate(ranking):
            fused[index] = fused.get(index, 0.0) + 1.0 / (RRF_K + position + 1)

    pinned = [c.chunk for c in candidates if c.chunk.pinned][:MAX_PINNED]
    pinned_ids = {c.id for c in pinned}
    ranked = [
        candidates[i].chunk
        for i, _ in sorted(fused.items(), key=lambda item: item[1], reverse=True)
        if candidates[i].chunk.id not in pinned_ids
    ]
    selected = pinned + ranked[: max(k - len(pinned), 0)]
    return selected, mode
