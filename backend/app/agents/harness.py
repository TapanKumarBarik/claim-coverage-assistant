"""The agent harness: runs a skill to a validated structured answer, within hard limits.

Responsibilities, and nothing more: build the conversation, offer only the skill's tools, run the
tool-use loop under a step budget and a deadline, and hand back the typed output with usage and a
trace. Policy (who may call, what the answer means) lives elsewhere.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.agents.skills import Skill
from app.agents.tools import ToolContext, ToolRegistry
from app.core.constants import Language, ModelTier, ToolName
from app.core.errors import Unavailable, UpstreamError
from app.llm.errors import LLMError, to_app_error
from app.llm.port import LLM
from app.llm.types import ChatMessage, Role, Usage

T = TypeVar("T", bound=BaseModel)

DEADLINE_MESSAGE = "The analysis took too long. Please try again."
NO_ANSWER_MESSAGE = "The model did not return a usable answer."
SKIPPED_TOOL_CALL = "ERROR: too many tool calls in one step"


@dataclass(frozen=True)
class ToolTrace:
    name: str
    ok: bool


@dataclass
class AgentRun(Generic[T]):
    output: T
    tier: ModelTier
    usage: Usage = field(default_factory=Usage)
    steps: int = 0
    models: list[str] = field(default_factory=list)
    tools: list[ToolTrace] = field(default_factory=list)

    @property
    def tool_names(self) -> list[ToolName]:
        known = {t.value: t for t in ToolName}
        return [known[t.name] for t in self.tools if t.name in known]


class AgentHarness:
    def __init__(
        self, registry: ToolRegistry, *, canary: str, max_tool_calls_per_step: int, deadline_s: float
    ) -> None:
        self._registry = registry
        self._canary = canary
        self._max_calls = max_tool_calls_per_step
        self._deadline_s = deadline_s

    async def run(
        self,
        skill: Skill[T],
        *,
        llm: LLM,
        language: Language,
        user: str,
        tool_context: ToolContext | None = None,
    ) -> AgentRun[T]:
        messages = [
            ChatMessage(Role.SYSTEM, skill.system_prompt(language=language, canary=self._canary)),
            ChatMessage(Role.USER, user),
        ]
        run: AgentRun[T] | None = None
        try:
            async with asyncio.timeout(self._deadline_s):
                run = await self._loop(skill, llm, messages, tool_context)
        except TimeoutError as exc:
            raise Unavailable(DEADLINE_MESSAGE) from exc
        except LLMError as exc:
            raise to_app_error(exc) from exc
        return run

    async def _loop(
        self, skill: Skill[T], llm: LLM, messages: list[ChatMessage], ctx: ToolContext | None
    ) -> AgentRun[T]:
        specs = self._registry.specs(skill.tools) if ctx is not None else []
        usage = Usage()
        models: list[str] = []
        traces: list[ToolTrace] = []

        for step in range(1, skill.max_steps + 1):
            last_step = step == skill.max_steps
            offered = [] if last_step else specs  # the final turn must answer, not ask for more
            turn = await llm.chat(
                tier=skill.tier, messages=messages, tools=offered, response_model=skill.output_model
            )
            usage += turn.usage
            models.append(turn.model)

            if turn.message.tool_calls and offered and ctx is not None:
                messages.append(turn.message)
                for index, call in enumerate(turn.message.tool_calls):
                    if index >= self._max_calls:
                        messages.append(ChatMessage(Role.TOOL, SKIPPED_TOOL_CALL, tool_call_id=call.id))
                        continue
                    result = await self._registry.execute(call, skill.tools, ctx)
                    traces.append(ToolTrace(result.name, result.ok))
                    messages.append(ChatMessage(Role.TOOL, result.text, tool_call_id=call.id))
                continue

            if turn.parsed is None:
                raise UpstreamError(NO_ANSWER_MESSAGE)
            return AgentRun(
                output=turn.parsed,
                tier=skill.tier,
                usage=usage,
                steps=step,
                models=_unique(models),
                tools=traces,
            )
        raise UpstreamError(NO_ANSWER_MESSAGE)  # unreachable: the last step never offers tools


def _unique(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))
