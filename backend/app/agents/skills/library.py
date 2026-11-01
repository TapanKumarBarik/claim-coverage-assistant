"""The skills this application ships with."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.agents.outputs import ModelAssessment, QueryRewrite, RouteDecision
from app.agents.skills import Skill, concierge, coverage, query_rewrite
from app.core.config import Settings


@dataclass(frozen=True)
class SkillSet:
    concierge: Skill[RouteDecision]
    query_rewrite: Skill[QueryRewrite]
    coverage: Skill[ModelAssessment]

    def all(self) -> tuple[Skill[Any], ...]:
        return (self.concierge, self.query_rewrite, self.coverage)


def build_skills(settings: Settings) -> SkillSet:
    return SkillSet(
        concierge=concierge.build(),
        query_rewrite=query_rewrite.build(),
        coverage=coverage.build(max_steps=settings.agent_max_steps),
    )
