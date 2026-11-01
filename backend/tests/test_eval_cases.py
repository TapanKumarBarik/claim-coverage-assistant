"""The eval harness itself must be trustworthy, and every case must be well formed."""

from __future__ import annotations

from datetime import UTC, date, datetime

import yaml
from fastapi.testclient import TestClient

from app.api.schemas import AssessmentResponse, ReplyResponse
from app.core.constants import Confidence, Intent, ResponseKind, Verdict
from app.core.errors import GuardrailBlocked, RateLimited
from evals.run_eval import CASES, check_case
from tests.conftest import analyze

KNOWN_KEYS = {
    "kind", "intent_in", "blocked", "verdict_in", "cites_any_section", "confidence_in",
    "needs_questions", "caveat_contains",
}  # fmt: skip
VERDICTS = {v.value for v in Verdict}
INTENTS = {i.value for i in Intent}
CONFIDENCES = {c.value for c in Confidence} | {None}
KINDS = {k.value for k in ResponseKind}


def test_every_case_is_well_formed() -> None:
    cases = yaml.safe_load(CASES.read_text(encoding="utf-8"))["cases"]
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids)), "duplicate case ids"
    for case in cases:
        expect = case["expect"]
        assert set(expect) <= KNOWN_KEYS, case["id"]
        assert set(expect.get("verdict_in", [])) <= VERDICTS, case["id"]
        assert set(expect.get("intent_in", [])) <= INTENTS, case["id"]
        assert set(expect.get("confidence_in", [])) <= CONFIDENCES, case["id"]
        assert expect.get("kind", ResponseKind.ASSESSMENT.value) in KINDS, case["id"]
        if case.get("loss_date"):
            date.fromisoformat(str(case["loss_date"]))


def test_the_checker_reports_each_kind_of_failure(client: TestClient) -> None:
    assessment = AssessmentResponse.model_validate(analyze(client).json())
    assert check_case({"verdict_in": ["not_covered"], "cites_any_section": ["Article 9"]}, assessment) == []

    failures = check_case(
        {
            "verdict_in": ["covered"],
            "cites_any_section": ["Article 99"],
            "confidence_in": [None],
            "caveat_contains": ["nonexistent"],
            "kind": "reply",
        },
        assessment,
    )
    assert len(failures) == 5


def test_blocked_and_reply_expectations() -> None:
    blocked = GuardrailBlocked("no")
    assert check_case({"blocked": True}, blocked) == []
    assert check_case({}, blocked)  # an unexpected block is a failure
    assert check_case({}, RateLimited("slow"))  # and so is any other error

    reply = ReplyResponse(
        request_id="r",
        generated_at=datetime.now(UTC),
        intent=Intent.SMALLTALK,
        language="en",
        text="hi",
        model="m",
        latency_ms=1,
    )
    assert check_case({"kind": "reply", "intent_in": ["smalltalk"]}, reply) == []
    assert check_case({"blocked": True}, reply)  # it should have been blocked
    assert check_case({"kind": "reply", "intent_in": ["off_topic"]}, reply)
