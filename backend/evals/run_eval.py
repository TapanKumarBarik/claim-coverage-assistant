"""Run the regression cases against the real model and report pass/fail.

    python -m evals.run_eval                 # all cases
    python -m evals.run_eval --case bike-unlocked-shared-room
    python -m evals.run_eval --repeat 3      # surface non-determinism

Needs server-side Azure OpenAI settings in the environment (see .env.example). Exit code 1 if any
case fails. Rate limits and budgets are lifted for the run; everything else is the real pipeline.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from app.api.schemas import AnalyzeOutcome, AnalyzeRequest, AssessmentResponse, ReplyResponse
from app.bootstrap import build_services
from app.catalog.ops import bootstrap_from_manifest
from app.core.config import get_settings
from app.core.errors import AppError, GuardrailBlocked
from app.core.identity import ClientId
from app.core.secrets import Redactor

CASES = Path(__file__).with_name("cases.yaml")
REPORT = Path(__file__).with_name("last_run.json")
EVAL_CLIENT = ClientId("eval-runner")
UNLIMITED = 1_000_000


def describe(outcome: AnalyzeOutcome) -> str:
    if isinstance(outcome, AssessmentResponse):
        return f"{outcome.verdict}/{outcome.confidence}"
    return f"reply/{outcome.intent}"


def check_case(expect: dict[str, Any], result: AnalyzeOutcome | AppError) -> list[str]:
    """Return human-readable failures (empty means the case passed)."""
    if isinstance(result, AppError):
        if expect.get("blocked") and isinstance(result, GuardrailBlocked):
            return []
        return [f"unexpected error {result.code}: {result.message}"]
    if expect.get("blocked"):
        return [f"expected the message to be blocked, got a {result.kind} response"]

    failures: list[str] = []
    if "kind" in expect and result.kind != expect["kind"]:
        failures.append(f"kind {result.kind!r}, expected {expect['kind']!r}")
    if isinstance(result, ReplyResponse):
        if "intent_in" in expect and result.intent not in expect["intent_in"]:
            failures.append(f"intent {result.intent!r} not in {expect['intent_in']}")
        return failures

    assert isinstance(result, AssessmentResponse)
    if "verdict_in" in expect and result.verdict not in expect["verdict_in"]:
        failures.append(f"verdict {result.verdict!r} not in {expect['verdict_in']}")
    if "cites_any_section" in expect:
        wanted = [s.lower() for s in expect["cites_any_section"]]
        sections = [e.section.lower() for e in result.evidence]
        if not any(w in s for w in wanted for s in sections):
            failures.append(f"no verified citation from {expect['cites_any_section']}; got {sections}")
    if "confidence_in" in expect and result.confidence not in expect["confidence_in"]:
        failures.append(f"confidence {result.confidence!r} not in {expect['confidence_in']}")
    if expect.get("needs_questions") and not result.missing_information:
        failures.append("expected questions about missing facts, got none")
    for fragment in expect.get("caveat_contains", []):
        if not any(fragment.lower() in c.lower() for c in result.caveats):
            failures.append(f"no caveat containing {fragment!r}")
    return failures


async def run(selected: str | None, repeat: int) -> int:
    settings = get_settings().model_copy(
        update={
            "analyze_rate_per_minute": UNLIMITED,
            "client_daily_token_budget": UNLIMITED * 100,
            "global_daily_token_budget": UNLIMITED * 100,
        }
    )
    if not settings.llm_configured:
        print("Azure OpenAI is not configured; set the AZURE_OPENAI_* variables first (see .env.example).")
        return 2
    services = build_services(settings, redactor=Redactor(settings.secret_values()))
    try:
        if services.store.is_empty:
            await bootstrap_from_manifest(
                services.store, services.embedder, settings.data_dir / "sources.yaml", settings.data_dir
            )
        return await _run_cases(services, selected, repeat)
    finally:
        await services.http_client.aclose()


async def _run_cases(services: Any, selected: str | None, repeat: int) -> int:
    cases = yaml.safe_load(CASES.read_text(encoding="utf-8"))["cases"]
    if selected:
        cases = [c for c in cases if c["id"] == selected]
        if not cases:
            print(f"Unknown case {selected!r}")
            return 2

    report: list[dict[str, Any]] = []
    failed = 0
    for case in cases:
        for attempt in range(1, repeat + 1):
            request = AnalyzeRequest(
                contract_id=case["contract_id"],
                claim=case["claim"].strip(),
                language=case.get("language", "en"),
                loss_date=date.fromisoformat(str(case["loss_date"])) if case.get("loss_date") else None,
            )
            outcome: AnalyzeOutcome | AppError
            try:
                answer: AnalyzeOutcome = await services.claims.handle(
                    request, client=EVAL_CLIENT, request_id=f"eval-{case['id']}-{attempt}", session_id=None
                )
                outcome, summary = answer, describe(answer)
            except AppError as error:
                outcome, summary = error, f"error/{error.code}"
            problems = check_case(case["expect"], outcome)
            failed += bool(problems)
            label = case["id"] + (f" #{attempt}" if repeat > 1 else "")
            print(f"{'FAIL' if problems else 'ok  '}  {label:<34} {summary}")
            for problem in problems:
                print(f"        - {problem}")
            report.append({"case": case["id"], "attempt": attempt, "outcome": summary, "problems": problems})

    total = len(report)
    print(f"\n{total - failed}/{total} passed")
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case")
    parser.add_argument("--repeat", type=int, default=1)
    args = parser.parse_args()
    return asyncio.run(run(args.case, args.repeat))


if __name__ == "__main__":
    sys.exit(main())
