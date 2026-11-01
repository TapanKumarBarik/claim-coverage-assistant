from __future__ import annotations

import numpy as np

from app.catalog.domain import Chunk
from app.retrieval.ranker import Candidate, rank_chunks, tokenize


def make(i: int, section: str, text: str, pinned: bool = False) -> Candidate:
    chunk = Chunk(
        id=f"v@1#{i}",
        document_id="d",
        version_id="v@1",
        ordinal=i,
        section=section,
        page=1,
        text=text,
        pinned=pinned,
    )
    return Candidate(chunk)


CORPUS = [
    make(
        0,
        "Article 9 - Vol dans les locaux communs",
        "Le vol dans le local à vélos exige effraction et porte fermée à clé.",
    ),
    make(1, "Article 6 - Dégâts des eaux", "Écoulement accidentel d'eau provenant de conduites."),
    make(2, "Article 5 - Tempête", "Vent d'au moins 80 km/h et grêle."),
    make(3, "Article 15 - Exclusions générales", "Dommages intentionnels, guerre, usure.", pinned=True),
    make(4, "Article 18 - Déclaration", "Déclarer le sinistre dans les 8 jours."),
]


def test_tokenizer_folds_accents_and_plurals() -> None:
    assert tokenize("Dégâts des EAUX") == ["degat", "eau"]


def test_keyword_retrieval_finds_the_relevant_clause_and_keeps_pinned_exclusions() -> None:
    chunks, mode = rank_chunks(CORPUS, ["vol de vélo dans le local commun"], None, k=3)
    ids = [c.ordinal for c in chunks]
    assert mode == "keyword"
    assert ids[0] == 3  # pinned exclusions always come along
    assert 0 in ids  # the matching theft clause
    assert 1 not in ids and 2 not in ids


def test_dense_scores_are_fused_when_vectors_exist() -> None:
    vectors = np.eye(5, dtype=np.float32)
    with_vectors = [Candidate(c.chunk, vectors[i]) for i, c in enumerate(CORPUS)]
    query_vec = np.stack([vectors[2]])  # semantically closest to "Tempête"
    chunks, mode = rank_chunks(with_vectors, ["quelque chose sans mots communs"], query_vec, k=3)
    assert mode == "hybrid"
    assert 2 in [c.ordinal for c in chunks]


def test_empty_corpus_is_safe() -> None:
    assert rank_chunks([], ["x"], None, k=5) == ([], "keyword")
