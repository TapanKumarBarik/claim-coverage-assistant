from __future__ import annotations

import re
import shutil
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pytest
import yaml
from fastapi.testclient import TestClient
from pydantic import BaseModel, SecretStr

from app.agents.outputs import ModelAssessment, ModelCitation, QueryRewrite, RouteDecision
from app.core.config import Settings
from app.core.constants import CitationRole, Environment, Intent, ModelTier, Verdict
from app.core.secrets import sha256_hex
from app.llm.types import ChatMessage, ChatTurn, Role, ToolCall, ToolSpec, Usage
from app.main import create_app

BACKEND = Path(__file__).resolve().parent.parent
ADMIN_TOKEN = "test-admin-token-123"
FAKE_USAGE = Usage(100, 50)
CLAIM = (
    "My bike was stolen from the shared bike room of my building. The door of the room was unlocked that day."
)
CONTRACT = "demo-habitat-confort"
DOC = "demo-habitat-confort-cg"
ARTICLE_9 = "Article 9 - Vol dans les locaux communs"

Responder = Callable[[str, str], ModelAssessment]


def find_excerpt(prompt: str, section_contains: str) -> tuple[str, str]:
    """Return (ref, text) of the first excerpt whose section header matches."""
    pattern = re.compile(r'<excerpt ref="(c\d+)"[^>]*section="([^"]*)"[^>]*>\n(.*?)\n</excerpt>', re.S)
    for ref, section, text in pattern.findall(prompt):
        if section_contains.lower() in section.lower():
            return ref, text
    raise AssertionError(f"no excerpt with section containing {section_contains!r}")


def message_text(user_prompt: str) -> str:
    """The user's text inside its <message>/<claim> fence."""
    match = re.search(r"<(?:message|claim)>\n(.*?)\n</(?:message|claim)>", user_prompt, re.S)
    return match.group(1).strip().lower() if match else ""


def default_route(text: str) -> RouteDecision:
    if text in {"hi", "hello", "bonjour", "thanks"}:
        return RouteDecision(intent=Intent.SMALLTALK, reply="Hello! Tell me what happened to your home.")
    if "recipe" in text or "weather" in text:
        return RouteDecision(intent=Intent.OFF_TOPIC, reply="I can only help with home-insurance claims.")
    if "pretend" in text:
        return RouteDecision(intent=Intent.ATTACK, reply="")
    return RouteDecision(intent=Intent.CLAIM, reply="")


def default_assessment(_: str, user: str) -> ModelAssessment:
    ref, text = find_excerpt(user, "Article 9")
    return ModelAssessment(
        verdict=Verdict.NOT_COVERED,
        headline="Not covered: the shared room was unlocked.",
        reasoning="Article 9 requires a locked room and a break-in.",
        citations=[ModelCitation(ref=ref, quote=text.split(".")[0], role=CitationRole.EXCLUDES)],
        missing_information=["Was there any sign of forced entry?"],
        next_steps=["File a police report within 24 hours."],
    )


@dataclass
class Call:
    tier: ModelTier
    messages: list[ChatMessage]
    tools: list[ToolSpec]
    response_model: type[BaseModel] | None

    @property
    def system(self) -> str:
        return self.messages[0].content or ""

    @property
    def user(self) -> str:
        return next(m.content or "" for m in reversed(self.messages) if m.role is Role.USER)


@dataclass
class FakeLLM:
    """A scriptable stand-in for Azure OpenAI that records every call."""

    route: Callable[[str], RouteDecision] = default_route
    assess: Responder = default_assessment
    tool_script: list[list[ToolCall]] = field(default_factory=list)  # tool calls to emit before answering
    usage: Usage = FAKE_USAGE
    calls: list[Call] = field(default_factory=list)

    @property
    def tiers(self) -> list[ModelTier]:
        return [c.tier for c in self.calls]

    async def chat(
        self,
        *,
        tier: ModelTier,
        messages: Sequence[ChatMessage],
        tools: Sequence[ToolSpec] = (),
        response_model: type[BaseModel] | None = None,
    ) -> ChatTurn:  # type: ignore[type-arg]
        call = Call(tier, list(messages), list(tools), response_model)
        self.calls.append(call)
        model = f"fake-{tier.value}"
        assistant = ChatMessage(Role.ASSISTANT)
        if response_model is ModelAssessment and tools and self.tool_script:
            calls = self.tool_script.pop(0)
            return ChatTurn(ChatMessage(Role.ASSISTANT, tool_calls=tuple(calls)), None, self.usage, model)
        if response_model is RouteDecision:
            parsed: BaseModel | None = self.route(message_text(call.user))
        elif response_model is QueryRewrite:
            parsed = QueryRewrite(queries=["vol local commun vélo", "exclusion effraction"])
        elif response_model is ModelAssessment:
            parsed = self.assess(call.system, call.user)
        else:
            parsed = None  # a plain-text call such as the credential probe
            assistant = ChatMessage(Role.ASSISTANT, "OK")
        return ChatTurn(assistant, parsed, self.usage, model)


class FakeEmbedder:
    can_embed = True

    async def embed(self, texts: Sequence[str]) -> np.ndarray:
        return np.ones((len(texts), 4), dtype=np.float32)


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    """A throwaway data dir holding only the synthetic full-text contract."""
    folder = tmp_path / "data"
    (folder / "synthetic").mkdir(parents=True)
    shutil.copy(BACKEND / "data/synthetic/exemple_habitat_cg.md", folder / "synthetic")
    manifest = {
        "contracts": [
            {
                "id": CONTRACT,
                "insurer": "Exemple Assurances S.A. (fictional)",
                "product": "Habitat Confort",
                "synthetic": True,
                "documents": [
                    {
                        "id": DOC,
                        "title": "Habitat Confort - general conditions",
                        "kind": "cg",
                        "file": "synthetic/exemple_habitat_cg.md",
                        "version_label": "v1",
                        "effective_from": "2024-01-01",
                    }
                ],
            }
        ]
    }
    (folder / "sources.yaml").write_text(yaml.safe_dump(manifest), encoding="utf-8")
    return folder


@pytest.fixture
def settings(tmp_path: Path, data_dir: Path) -> Settings:
    return Settings(
        _env_file=None,
        app_env=Environment.TEST,
        storage_dir=tmp_path / "storage",
        data_dir=data_dir,
        static_dir=tmp_path / "no-static",
        admin_token_sha256=SecretStr(sha256_hex(ADMIN_TOKEN)),
        analyze_rate_per_minute=100,
        connect_rate_per_minute=100,
        llm_retry_base_delay_s=0.0,
        llm_retry_max_delay_s=0.0,
        full_context_char_budget=30_000,
    )


@pytest.fixture
def fake_llm() -> FakeLLM:
    return FakeLLM()


@pytest.fixture
def client(settings: Settings, fake_llm: FakeLLM) -> Iterator[TestClient]:
    with TestClient(create_app(settings, llm=fake_llm, embedder=None)) as test_client:
        yield test_client


@pytest.fixture
def admin() -> dict[str, str]:
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


def make_client(settings: Settings, llm: FakeLLM | None, **overrides: object) -> TestClient:
    return TestClient(create_app(settings.model_copy(update=overrides), llm=llm, embedder=None))


def analyze(client: TestClient, **overrides: object):
    payload = {"contract_id": CONTRACT, "claim": CLAIM, "language": "en"} | overrides
    return client.post("/api/analyze", json=payload)
