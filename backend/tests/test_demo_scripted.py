"""The scripted demo model must pass through the real pipeline with every citation verified."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.core.constants import Environment, Verdict
from app.main import create_app
from scripts.demo.scripted_llm import ScriptedLLM
from tests.conftest import BACKEND, analyze

RAW = BACKEND / "data" / "raw"
HAVE_REAL_DOCS = (RAW / "foyer_mozaik_ipid.pdf").exists() and (RAW / "axa_YiCYJh.pdf").exists()

SCENARIOS = [
    (
        "demo-habitat-confort",
        "My bike was stolen from the shared bike room. The door was unlocked.",
        Verdict.NOT_COVERED,
        2,
    ),
    (
        "demo-habitat-confort",
        "We lit a candle on the garden table and it scorched the wood.",
        Verdict.AMBIGUOUS,
        3,
    ),
]
REAL_DOC_SCENARIOS = [
    ("foyer-mozaik", "My smartphone was stolen from my bag in a cafe.", Verdict.AMBIGUOUS, 2),
    ("axa-optihome", "A pipe burst in the flat above and water came through my ceiling.", Verdict.COVERED, 1),
]


@pytest.fixture(scope="module")
def demo_client(tmp_path_factory: pytest.TempPathFactory) -> Iterator[TestClient]:
    settings = Settings(
        _env_file=None,
        app_env=Environment.TEST,
        storage_dir=tmp_path_factory.mktemp("demo-storage"),
        data_dir=BACKEND / "data",
        static_dir=Path("/nonexistent"),
        admin_token_sha256=SecretStr("0" * 64),
        analyze_rate_per_minute=1000,
    )
    with TestClient(create_app(settings, llm=ScriptedLLM(), embedder=None)) as client:
        yield client


def check(client: TestClient, contract: str, claim: str, verdict: Verdict, citations: int) -> None:
    body = analyze(client, contract_id=contract, claim=claim).json()
    assert body["verdict"] == verdict, body
    assert len(body["evidence"]) == citations, "a scripted quote was not found in the real policy text"
    assert not any("could not be matched" in c for c in body["caveats"])
    assert body["model"] == "scripted-thinking"


@pytest.mark.parametrize(("contract", "claim", "verdict", "citations"), SCENARIOS)
def test_synthetic_scenarios_cite_verified_clauses(
    demo_client: TestClient, contract: str, claim: str, verdict: Verdict, citations: int
) -> None:
    check(demo_client, contract, claim, verdict, citations)


@pytest.mark.skipif(not HAVE_REAL_DOCS, reason="run scripts/fetch_sources.py first")
@pytest.mark.parametrize(("contract", "claim", "verdict", "citations"), REAL_DOC_SCENARIOS)
def test_real_document_scenarios_cite_verified_text(
    demo_client: TestClient, contract: str, claim: str, verdict: Verdict, citations: int
) -> None:
    check(demo_client, contract, claim, verdict, citations)


def test_greetings_get_the_small_model(demo_client: TestClient) -> None:
    body = analyze(demo_client, claim="Hello!").json()
    assert body["kind"] == "reply" and body["model"] == "scripted-fast"
    assert analyze(demo_client, claim="Bonjour", language="fr").json()["text"].startswith("Bonjour")
