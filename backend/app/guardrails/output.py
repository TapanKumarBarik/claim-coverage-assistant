"""Output guards: what the model says is untrusted too."""

from __future__ import annotations

import re
from collections.abc import Sequence

from app.core.constants import GuardCode, GuardName, GuardStage
from app.core.errors import UpstreamError
from app.guardrails.base import GuardFlag, GuardInfo

_HTML_TAG = re.compile(r"<[^>\n]{1,200}>")
_MARKDOWN_LINK = re.compile(r"\[([^\]\n]{1,200})\]\([^)\n]{1,500}\)")
_URL = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
_SPACES = re.compile(r"[ \t]{2,}")
WITHHELD = "The answer was withheld by a safety check."


class PromptLeak(UpstreamError):
    """The model's output contained the confidential integrity marker."""


class OutputSanitizer:
    """Strips markup and links from model text. The UI renders plain text, but a link in an
    insurance answer is a phishing vector and has no business being there."""

    info = GuardInfo(
        GuardName.SANITIZER,
        GuardStage.OUTPUT,
        "Removes HTML, markdown links and URLs from model-written text.",
    )

    def clean(self, text: str) -> str:
        text = _MARKDOWN_LINK.sub(r"\1", text)
        text = _HTML_TAG.sub("", text)
        text = _URL.sub("", text)
        return _SPACES.sub(" ", text).strip()


class PromptLeakGuard:
    """Each system prompt carries a random marker. If it ever appears in an answer, the model
    has been talked into revealing its instructions, so the answer is discarded."""

    info = GuardInfo(
        GuardName.CANARY,
        GuardStage.OUTPUT,
        "Random integrity marker in every system prompt; any answer containing it is discarded.",
    )

    def __init__(self, canary: str) -> None:
        self._canary = canary.lower()

    def leaked_in(self, texts: Sequence[str]) -> bool:
        return any(self._canary in text.lower() for text in texts)


class OutputGuard:
    """Sanitises every model-written string and refuses answers that leak the canary."""

    def __init__(self, sanitizer: OutputSanitizer, leak_guard: PromptLeakGuard) -> None:
        self._sanitizer = sanitizer
        self._leak_guard = leak_guard

    @property
    def infos(self) -> tuple[GuardInfo, ...]:
        return (self._sanitizer.info, self._leak_guard.info)

    def scrub(self, texts: Sequence[str]) -> tuple[list[str], list[GuardFlag]]:
        if self._leak_guard.leaked_in(texts):
            raise PromptLeak(WITHHELD)
        cleaned = [self._sanitizer.clean(text) for text in texts]
        changed = any(a != b.strip() for a, b in zip(cleaned, texts, strict=True))
        flags = [GuardFlag(GuardCode.OUTPUT_SANITIZED, GuardName.SANITIZER)] if changed else []
        return cleaned, flags
