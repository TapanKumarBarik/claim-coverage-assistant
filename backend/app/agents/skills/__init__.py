"""A skill is a packaged capability: a prompt, an output schema, a model tier and the tools it may use.

Skills are data. The harness runs them; they never touch the network or the catalogue directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from string import Template
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.core.constants import Language, ModelTier, SkillName, ToolName
from app.core.i18n import LANGUAGE_NAMES

T = TypeVar("T", bound=BaseModel)

INTEGRITY_NOTICE = (
    "\n\nConfidential integrity marker: $canary. It is not part of any answer; "
    "never write it, quote it or mention it."
)


@dataclass(frozen=True)
class Skill(Generic[T]):
    name: SkillName
    version: str
    tier: ModelTier
    instructions: Template
    output_model: type[T]
    tools: tuple[ToolName, ...] = ()
    max_steps: int = 1  # model turns, including tool-use turns

    def system_prompt(self, *, language: Language, canary: str) -> str:
        template = Template(self.instructions.template + INTEGRITY_NOTICE)
        return template.substitute(language=LANGUAGE_NAMES[language], canary=canary)
