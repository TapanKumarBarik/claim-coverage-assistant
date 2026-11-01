"""Guardrail building blocks: a uniform result type and an ordered input pipeline."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from app.core.constants import GuardCode, GuardName, GuardStage


@dataclass(frozen=True)
class GuardInfo:
    """Human-readable description of a guard, shown in the governance policy view."""

    name: GuardName
    stage: GuardStage
    description: str


@dataclass(frozen=True)
class GuardFlag:
    code: GuardCode
    guard: GuardName
    detail: str = ""


@dataclass(frozen=True)
class GuardResult:
    text: str
    flags: tuple[GuardFlag, ...] = ()
    block: GuardCode | None = None

    @property
    def blocked(self) -> bool:
        return self.block is not None


class InputGuard(Protocol):
    info: GuardInfo

    def check(self, text: str) -> GuardResult: ...


class InputPipeline:
    """Runs guards in order, feeding each the previous guard's cleaned text; stops at a block."""

    def __init__(self, guards: Sequence[InputGuard]) -> None:
        self._guards = tuple(guards)

    @property
    def guards(self) -> tuple[InputGuard, ...]:
        return self._guards

    def run(self, text: str) -> GuardResult:
        flags: list[GuardFlag] = []
        current = text
        for guard in self._guards:
            result = guard.check(current)
            flags.extend(result.flags)
            current = result.text
            if result.blocked:
                return GuardResult(current, tuple(flags), result.block)
        return GuardResult(current, tuple(flags))
