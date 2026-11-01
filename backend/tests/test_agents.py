"""The agent harness, its tools and the evidence ledger."""

from __future__ import annotations

import asyncio
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from app.agents.harness import AgentHarness
from app.agents.outputs import ModelAssessment
from app.agents.skills import coverage
from app.agents.tools import (
    ERROR_PREFIX,
    ListSectionsTool,
    ReadSectionTool,
    SearchPolicyTool,
    ToolContext,
    ToolRegistry,
)
from app.catalog.ops import bootstrap_from_manifest
from app.catalog.store import Store
from app.core.constants import Language, ModelTier, ToolName, Verdict
from app.core.errors import Unavailable
from app.llm.types import ChatMessage, Role, ToolCall
from app.retrieval.policy import EvidenceLedger, PolicyView
from tests.conftest import CONTRACT, FakeLLM

CANARY = "canary-abc"


def blank_assessment(_: str, __: str) -> ModelAssessment:
    return ModelAssessment(
        verdict=Verdict.AMBIGUOUS,
        headline="h",
        reasoning="r",
        citations=[],
        missing_information=[],
        next_steps=[],
    )


def call(name: str, arguments: str = "{}", call_id: str = "t1") -> ToolCall:
    return ToolCall(call_id, name, arguments)


def make_harness(max_calls: int = 3, deadline_s: float = 5.0) -> AgentHarness:
    registry = ToolRegistry(
        [ListSectionsTool(), SearchPolicyTool(), ReadSectionTool()], timeout_s=2.0, max_result_chars=4000
    )
    return AgentHarness(registry, canary=CANARY, max_tool_calls_per_step=max_calls, deadline_s=deadline_s)


@pytest.fixture
async def context(tmp_path: Path, data_dir: Path) -> ToolContext:
    store = Store(tmp_path / "agent-store")
    await bootstrap_from_manifest(store, None, data_dir / "sources.yaml", data_dir)
    contract = store.catalog.contract(CONTRACT)
    assert contract is not None
    view = PolicyView.resolve(store, contract, date(2026, 1, 1))
    assert view is not None
    return ToolContext(EvidenceLedger(view), view.candidates, embedder=None)


async def run_coverage(
    llm: FakeLLM, ctx: ToolContext | None, *, max_steps: int = 3, harness: AgentHarness | None = None
):
    skill = coverage.build(max_steps=max_steps)
    return await (harness or make_harness()).run(
        skill, llm=llm, language=Language.EN, user="<claim>x</claim>", tool_context=ctx
    )


async def test_tool_loop_fetches_passages_then_answers(context: ToolContext) -> None:
    llm = FakeLLM(
        assess=blank_assessment,
        tool_script=[[call(ToolName.SEARCH_POLICY, '{"query": "vol local à vélos clé"}')]],
    )
    run = await run_coverage(llm, context)

    assert run.steps == 2 and [(t.name, t.ok) for t in run.tools] == [("search_policy", True)]
    assert run.tier is ModelTier.REASONING and run.usage.total == 300  # two model turns of 150 tokens
    assert context.ledger.refs  # the tool put passages in the ledger, so they are citable
    tool_message = next(m for m in llm.calls[1].messages if m.role is Role.TOOL)
    assert tool_message.tool_call_id == "t1" and "<excerpt ref=" in (tool_message.content or "")


async def test_a_hallucinated_or_forbidden_tool_becomes_an_error_the_model_can_read(
    context: ToolContext,
) -> None:
    llm = FakeLLM(
        assess=blank_assessment, tool_script=[[call("delete_everything"), call(ToolName.READ_SECTION)]]
    )
    skill = replace(coverage.build(max_steps=3), tools=(ToolName.LIST_SECTIONS,))  # read_section not allowed
    run = await make_harness().run(skill, llm=llm, language=Language.EN, user="u", tool_context=context)

    results = [m.content for m in llm.calls[1].messages if m.role is Role.TOOL]
    assert all((r or "").startswith(ERROR_PREFIX) for r in results) and len(results) == 2
    assert [t.ok for t in run.tools] == [False, False] and run.steps == 2  # and it still answered


async def test_invalid_tool_arguments_are_reported_not_raised(context: ToolContext) -> None:
    llm = FakeLLM(assess=blank_assessment, tool_script=[[call(ToolName.SEARCH_POLICY, '{"query": 1}')]])
    run = await run_coverage(llm, context)
    assert run.tools[0].ok is False


async def test_the_final_turn_never_offers_tools(context: ToolContext) -> None:
    llm = FakeLLM(
        assess=blank_assessment,
        tool_script=[[call(ToolName.LIST_SECTIONS)], [call(ToolName.LIST_SECTIONS)]],
    )
    run = await run_coverage(llm, context, max_steps=2)
    assert run.steps == 2
    assert llm.calls[0].tools and llm.calls[1].tools == []  # step budget exhausted: must answer


async def test_tool_calls_per_step_are_capped(context: ToolContext) -> None:
    many = [call(ToolName.LIST_SECTIONS, call_id=f"t{i}") for i in range(5)]
    llm = FakeLLM(assess=blank_assessment, tool_script=[many])
    run = await run_coverage(llm, context, harness=make_harness(max_calls=2))
    assert len(run.tools) == 2
    assert len([m for m in llm.calls[1].messages if m.role is Role.TOOL]) == 5  # every call id answered


async def test_no_tools_are_offered_without_a_tool_context() -> None:
    llm = FakeLLM(assess=blank_assessment)
    run = await run_coverage(llm, None)
    assert run.steps == 1 and llm.calls[0].tools == []


async def test_a_slow_model_hits_the_deadline() -> None:
    class Slow(FakeLLM):
        async def chat(self, **kwargs):
            await asyncio.sleep(1)
            return await super().chat(**kwargs)

    with pytest.raises(Unavailable):
        await run_coverage(Slow(assess=blank_assessment), None, harness=make_harness(deadline_s=0.05))


async def test_system_prompt_carries_language_and_the_integrity_marker() -> None:
    llm = FakeLLM(assess=blank_assessment)
    await make_harness().run(coverage.build(max_steps=1), llm=llm, language=Language.FR, user="u")
    system = llm.calls[0].system
    assert "French" in system and CANARY in system and "never write it" in system


async def test_search_excludes_passages_already_shown_and_read_section_finds_by_title(
    context: ToolContext,
) -> None:
    ledger = context.ledger
    first = await SearchPolicyTool().run(
        SearchPolicyTool.args_model(query="vol local commun vélo", limit=3), context
    )
    shown = set(ledger.refs)
    assert shown and "<excerpt" in first
    again = await SearchPolicyTool().run(
        SearchPolicyTool.args_model(query="vol local commun vélo", limit=3), context
    )
    assert set(ledger.refs) >= shown and again != first  # new passages only

    section = await ReadSectionTool().run(ReadSectionTool.args_model(section="Article 9"), context)
    assert "locaux communs" in section
    listing = await ListSectionsTool().run(ListSectionsTool.args_model(), context)
    assert "Article 9" in listing and "<excerpt" not in listing  # a table of contents, no text


def test_ledger_refs_are_stable_and_idempotent(context: ToolContext) -> None:
    chunk = context.candidates[0].chunk
    ledger = context.ledger
    assert ledger.add(chunk) == ledger.add(chunk) == "c1"
    assert ledger.render("c1").startswith('<excerpt ref="c1"')
    assert ChatMessage(Role.USER, "x").role is Role.USER
