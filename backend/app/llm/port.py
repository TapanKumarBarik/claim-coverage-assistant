"""The interfaces the rest of the system depends on (dependency inversion)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol, TypeVar

import numpy as np
from pydantic import BaseModel

from app.core.constants import ModelTier
from app.llm.types import ChatMessage, ChatTurn, ToolSpec

M = TypeVar("M", bound=BaseModel)


class LLM(Protocol):
    async def chat(
        self,
        *,
        tier: ModelTier,
        messages: Sequence[ChatMessage],
        tools: Sequence[ToolSpec] = (),
        response_model: type[M] | None = None,
    ) -> ChatTurn[M]: ...


class Embedder(Protocol):
    @property
    def can_embed(self) -> bool: ...

    async def embed(self, texts: Sequence[str]) -> np.ndarray: ...
