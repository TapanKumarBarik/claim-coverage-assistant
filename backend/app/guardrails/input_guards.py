"""Deterministic input guards. Cheap, auditable, and run before any model is called."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable
from enum import StrEnum

from app.core.constants import GuardCode, GuardName, GuardStage
from app.guardrails.base import GuardFlag, GuardInfo, GuardResult

# --- text normalisation -----------------------------------------------------------

_KEPT_CONTROL = frozenset("\n\t")
# Control, format (zero-width / bidi), surrogate, private-use and unassigned characters.
_STRIPPED_CATEGORIES = frozenset({"Cc", "Cf", "Cs", "Co", "Cn"})
_SPACES = re.compile(r"[ \t]+")
_BLANK_LINES = re.compile(r"\n{3,}")


class TextNormalizer:
    """Unicode-normalises text and strips invisible characters used to smuggle instructions."""

    info = GuardInfo(
        GuardName.NORMALIZER,
        GuardStage.INPUT,
        "Unicode NFKC normalisation, removal of invisible/control characters, length and emptiness checks.",
    )

    def __init__(self, max_chars: int) -> None:
        self._max_chars = max_chars

    def check(self, text: str) -> GuardResult:
        folded = unicodedata.normalize("NFKC", text)
        cleaned = "".join(
            ch for ch in folded if ch in _KEPT_CONTROL or unicodedata.category(ch) not in _STRIPPED_CATEGORIES
        )
        cleaned = _BLANK_LINES.sub("\n\n", _SPACES.sub(" ", cleaned)).strip()

        flags: list[GuardFlag] = []
        if len(cleaned) != len(folded.strip()):
            flags.append(GuardFlag(GuardCode.CONTROL_CHARS, self.info.name))
        if not cleaned:
            return GuardResult(cleaned, tuple(flags), GuardCode.EMPTY)
        if len(cleaned) > self._max_chars:
            return GuardResult(cleaned[: self._max_chars], tuple(flags), GuardCode.TOO_LONG)
        return GuardResult(cleaned, tuple(flags))


# --- personal data ------------------------------------------------------------------

_DATE_LIKE = re.compile(r"^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$")
_MIN_PHONE_DIGITS = 8
_CARD_LENGTHS = range(13, 20)


class PiiKind(StrEnum):
    EMAIL = "EMAIL"
    IBAN = "IBAN"
    CARD = "CARD"
    PHONE = "PHONE"


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def _luhn_ok(value: str) -> bool:
    digits = [int(d) for d in _digits(value)]
    if len(digits) not in _CARD_LENGTHS:
        return False
    total = 0
    for index, digit in enumerate(reversed(digits)):
        if index % 2 == 1:
            digit = digit * 2 - 9 if digit > 4 else digit * 2
        total += digit
    return total % 10 == 0


def _phone_ok(value: str) -> bool:
    return len(_digits(value)) >= _MIN_PHONE_DIGITS and not _DATE_LIKE.match(value.strip())


def _always(_: str) -> bool:
    return True


# Order matters: IBANs contain long digit runs that would otherwise be read as cards or phones.
_PII_RULES: tuple[tuple[PiiKind, re.Pattern[str], Callable[[str], bool]], ...] = (
    (PiiKind.EMAIL, re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"), _always),
    (PiiKind.IBAN, re.compile(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b"), _always),
    (PiiKind.CARD, re.compile(r"\b(?:\d[ -]?){13,19}\b"), _luhn_ok),
    (PiiKind.PHONE, re.compile(r"(?<![\w/])\+?\d[\d ./()-]{6,}\d"), _phone_ok),
)


class PiiRedactor:
    """Replaces e-mail, IBAN, card and phone numbers with placeholders before text leaves the app."""

    info = GuardInfo(
        GuardName.PII_REDACTOR,
        GuardStage.INPUT,
        "Replaces e-mail addresses, IBANs, card and phone numbers with placeholders before any model call.",
    )

    def check(self, text: str) -> GuardResult:
        counts: dict[PiiKind, int] = {}
        for kind, pattern, accept in _PII_RULES:

            def replace(
                match: re.Match[str], kind: PiiKind = kind, accept: Callable[[str], bool] = accept
            ) -> str:
                if not accept(match.group()):
                    return match.group()
                counts[kind] = counts.get(kind, 0) + 1
                return f"[{kind.value}]"

            text = pattern.sub(replace, text)
        flags = tuple(
            GuardFlag(GuardCode.PII_REDACTED, self.info.name, f"{kind.value}={n}")
            for kind, n in counts.items()
        )
        return GuardResult(text, flags)


# --- prompt injection ---------------------------------------------------------------


class InjectionRule(StrEnum):
    OVERRIDE_INSTRUCTIONS = "override_instructions"
    REVEAL_PROMPT = "reveal_prompt"
    ROLE_HIJACK = "role_hijack"
    JAILBREAK_PERSONA = "jailbreak_persona"
    DELIMITER_SPOOF = "delimiter_spoof"


def _rx(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE | re.MULTILINE | re.DOTALL)


_INJECTION_RULES: tuple[tuple[InjectionRule, re.Pattern[str]], ...] = (
    (
        InjectionRule.OVERRIDE_INSTRUCTIONS,
        _rx(
            r"\b(?:ignore|disregard|forget|override|bypass|oublie[rz]?|ignore[rz]|n['’]?obe[iî]s? pas)\b"
            r".{0,40}?\b(?:previous|prior|above|earlier|all|any|your|these|the|pr[eé]c[eé]dent\w*|toutes?|tes|vos|les)\b"
            r".{0,40}?\b(?:instruction|rule|prompt|guideline|polic|directive|consigne|r[eè]gle)"
        ),
    ),
    (
        InjectionRule.REVEAL_PROMPT,
        _rx(
            r"\b(?:reveal|show|print|repeat|output|leak|dump|r[eé]v[eè]le|affiche|montre|r[eé]p[eè]te)\b"
            r".{0,40}?\b(?:system|developer|hidden|initial|secret|syst[eè]me|cach[eé]\w*)\b"
            r".{0,20}?\b(?:prompt|instruction|message|consigne)s?\b"
        ),
    ),
    (
        # French puts the adjective after the noun: "ton prompt système".
        InjectionRule.REVEAL_PROMPT,
        _rx(
            r"\b(?:r[eé]v[eè]le|affiche|montre|r[eé]p[eè]te|donne)\b"
            r".{0,40}?\b(?:prompt|instruction|consigne)s?\s+(?:syst[eè]me|cach[eé]\w*|secr[eè]t\w*|initiale?s?)"
        ),
    ),
    (
        InjectionRule.ROLE_HIJACK,
        _rx(
            r"\b(?:you are (?:now|no longer)|from now on you|new instructions?\s*:"
            r"|system (?:override|prompt)\b"
            r"|tu es (?:maintenant|d[eé]sormais)|nouvelles? instructions?\s*:)"
        ),
    ),
    (
        InjectionRule.JAILBREAK_PERSONA,
        # No bare "DAN": that would flag anyone called Dan. The phrase form is the real jailbreak.
        _rx(r"\b(?:developer mode|jailbreak(?:en|ed)?|do anything now|unfiltered mode|mode sans filtre)\b"),
    ),
    (
        InjectionRule.DELIMITER_SPOOF,
        _rx(
            r"</?\s*(?:claim|message|documents?|excerpt|system|assistant|user)\b|<\|.*?\|>|\[/?INST\]|^#{2,}\s*system\b"
        ),
    ),
)


class InjectionDetector:
    """Blocks messages that try to rewrite the assistant's instructions or spoof prompt structure.

    This is the first of three layers: the small-model classifier, fenced untrusted input and
    output verification each assume the others can be bypassed.
    """

    info = GuardInfo(
        GuardName.INJECTION_DETECTOR,
        GuardStage.INPUT,
        "Pattern rules (English and French) for instruction-override, prompt-extraction, role-hijack, "
        "jailbreak personas and prompt-delimiter spoofing.",
    )

    def check(self, text: str) -> GuardResult:
        for rule, pattern in _INJECTION_RULES:
            if pattern.search(text):
                flag = GuardFlag(GuardCode.INJECTION_PATTERN, self.info.name, rule.value)
                return GuardResult(text, (flag,), GuardCode.INJECTION_PATTERN)
        return GuardResult(text)
