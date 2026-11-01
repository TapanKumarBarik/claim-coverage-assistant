"""Tools an agent may call. Each is small, typed, read-only and bounded.

Tools never raise into the model loop: a bad call becomes an ``ERROR:`` result the model can read
and recover from, which is also what stops a hallucinated tool name or malformed arguments from
crashing a request.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from typing import ClassVar

from pydantic import BaseModel, Field, ValidationError

from app.core.constants import ToolName
from app.core.errors import AppError
from app.llm.errors import LLMError
from app.llm.port import Embedder
from app.llm.types import ToolCall, ToolSpec
from app.retrieval.policy import EvidenceLedger
from app.retrieval.ranker import Candidate, rank_chunks

log = logging.getLogger(__name__)

ERROR_PREFIX = "ERROR: "
NOTHING_FOUND = "No matching passages."
SECTION_READ_LIMIT = 6
SEARCH_DEFAULT_LIMIT = 5
SEARCH_MAX_LIMIT = 8


@dataclass(frozen=True)
class ToolContext:
    ledger: EvidenceLedger
    candidates: Sequence[Candidate]
    embedder: Embedder | None  # None when stored vectors would not match the query model


@dataclass(frozen=True)
class ToolResult:
    name: str
    text: str
    ok: bool


class NoArgs(BaseModel):
    pass


class SearchArgs(BaseModel):
    query: str = Field(min_length=2, max_length=200, description="What to look for, in French.")
    limit: int = Field(default=SEARCH_DEFAULT_LIMIT, ge=1, le=SEARCH_MAX_LIMIT)


class SectionArgs(BaseModel):
    section: str = Field(
        min_length=2, max_length=120, description="Part of a section title, e.g. 'Article 9'."
    )


class Tool(ABC):
    name: ClassVar[ToolName]
    description: ClassVar[str]
    args_model: ClassVar[type[BaseModel]]

    @abstractmethod
    async def run(self, args: BaseModel, ctx: ToolContext) -> str: ...


class ListSectionsTool(Tool):
    name = ToolName.LIST_SECTIONS
    description = "List the section titles of every policy document, to find where to look. No text."
    args_model = NoArgs

    async def run(self, args: BaseModel, ctx: ToolContext) -> str:
        titles: dict[str, None] = {}
        for candidate in ctx.candidates:
            titles[f"{candidate.chunk.section} (p.{candidate.chunk.page})"] = None
        return "\n".join(f"- {title}" for title in titles) or NOTHING_FOUND


class SearchPolicyTool(Tool):
    name = ToolName.SEARCH_POLICY
    description = "Search the policy documents for passages not yet shown. Use French insurance vocabulary."
    args_model = SearchArgs

    async def run(self, args: BaseModel, ctx: ToolContext) -> str:
        assert isinstance(args, SearchArgs)
        pool = [c for c in ctx.candidates if not ctx.ledger.has(c.chunk.id)]
        vectors = None
        if ctx.embedder is not None and ctx.embedder.can_embed and any(c.vector is not None for c in pool):
            try:
                vectors = await ctx.embedder.embed([args.query])
            except LLMError:
                log.warning("tool_embedding_failed: keyword search only")
        chunks, _ = rank_chunks(pool, [args.query], vectors, args.limit)
        return ctx.ledger.render_chunks(chunks) or NOTHING_FOUND


class ReadSectionTool(Tool):
    name = ToolName.READ_SECTION
    description = "Read the full text of the section(s) whose title contains the given words."
    args_model = SectionArgs

    async def run(self, args: BaseModel, ctx: ToolContext) -> str:
        assert isinstance(args, SectionArgs)
        wanted = args.section.lower()
        matches = [c.chunk for c in ctx.candidates if wanted in c.chunk.section.lower()][:SECTION_READ_LIMIT]
        return ctx.ledger.render_chunks(matches) or NOTHING_FOUND


class ToolRegistry:
    def __init__(self, tools: Sequence[Tool], *, timeout_s: float, max_result_chars: int) -> None:
        self._tools = {tool.name: tool for tool in tools}
        self._timeout_s = timeout_s
        self._max_chars = max_result_chars

    @property
    def tools(self) -> list[Tool]:
        return list(self._tools.values())

    def specs(self, names: Collection[ToolName]) -> list[ToolSpec]:
        return [
            ToolSpec(tool.name.value, tool.description, tool.args_model.model_json_schema())
            for tool in self._tools.values()
            if tool.name in names
        ]

    async def execute(self, call: ToolCall, allowed: Collection[ToolName], ctx: ToolContext) -> ToolResult:
        tool = next(
            (t for t in self._tools.values() if t.name.value == call.name and t.name in allowed), None
        )
        if tool is None:
            return self._failure(call, "unknown or not permitted tool")
        try:
            args = tool.args_model.model_validate_json(call.arguments or json.dumps({}))
        except ValidationError as exc:
            return self._failure(call, f"invalid arguments ({exc.error_count()} problem(s))")
        try:
            async with asyncio.timeout(self._timeout_s):
                text = await tool.run(args, ctx)
        except (TimeoutError, AppError, LLMError) as exc:
            log.warning("tool_failed", extra={"tool": call.name, "error": type(exc).__name__})
            return self._failure(call, "the tool failed")
        return ToolResult(call.name, text[: self._max_chars], ok=True)

    @staticmethod
    def _failure(call: ToolCall, reason: str) -> ToolResult:
        return ToolResult(call.name, f"{ERROR_PREFIX}{reason}", ok=False)
