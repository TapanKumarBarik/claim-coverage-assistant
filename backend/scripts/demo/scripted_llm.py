"""A scripted stand-in for Azure OpenAI, for deterministic screenshots and UI smoke tests.

It is NOT a model. It recognises a handful of demo scenarios and answers them with text that quotes the
real policy excerpts it is given, so the application's real guardrails, citation verifier, confidence
rules and governance recording all run exactly as they would against a live model. Anything it does not
recognise is answered conservatively as "needs more info".
"""

from __future__ import annotations

import re
from collections.abc import Sequence

from pydantic import BaseModel

from app.agents.outputs import ModelAssessment, ModelCitation, QueryRewrite, RouteDecision
from app.core.constants import CitationRole, Intent, ModelTier, Verdict
from app.llm.types import ChatMessage, ChatTurn, Role, ToolSpec, Usage

_EXCERPT = re.compile(r'<excerpt ref="(c\d+)"[^>]*section="([^"]*)"[^>]*>\n(.*?)\n</excerpt>', re.S)
_FENCED = re.compile(r"<(?:message|claim)>\n(.*?)\n</(?:message|claim)>", re.S)

GREETINGS = ("hello", "hi", "bonjour", "salut", "hey")
OFF_TOPIC = ("poem", "recipe", "weather", "pancake")

REPLIES = {
    "English": "Hello! I can check whether a home-insurance claim looks covered. Tell me what happened, "
    "where, and whether the doors were locked.",
    "French": "Bonjour ! Je peux vérifier si un sinistre habitation semble couvert. Dites-moi ce qui s'est "
    "passé, où, et si les portes étaient verrouillées.",
}
SCOPE = {
    "English": "I can only help with home-insurance claims. Describe a loss or damage and I will check the policy.",
    "French": "Je ne peux aider que pour les sinistres habitation. Décrivez un dommage et je consulterai la police.",
}


Excerpts = list[tuple[str, str]]  # (ref, text) for every excerpt in the prompt


def _excerpts(prompt: str) -> Excerpts:
    return [(ref, text) for ref, _section, text in _EXCERPT.findall(prompt)]


def _plain(text: str) -> str:
    return text.replace("’", "'")


def _cite(excerpts: Excerpts, quote: str, role: CitationRole) -> ModelCitation:
    """Cite the excerpt that really contains the quote; fail loudly if there is none."""
    for ref, text in excerpts:
        if _plain(quote) in _plain(text):
            return ModelCitation(ref=ref, quote=quote, role=role)
    raise LookupError(quote)


class ScriptedLLM:
    """Implements the ``LLM`` port."""

    def __init__(self) -> None:
        self.calls = 0

    async def chat(
        self,
        *,
        tier: ModelTier,
        messages: Sequence[ChatMessage],
        tools: Sequence[ToolSpec] = (),
        response_model: type[BaseModel] | None = None,
    ) -> ChatTurn:  # type: ignore[type-arg]
        self.calls += 1
        system = messages[0].content or ""
        user = next(m.content or "" for m in reversed(messages) if m.role is Role.USER)
        language = "French" if "French" in system else "English"
        model = "scripted-fast" if tier is ModelTier.FAST else "scripted-thinking"

        if response_model is RouteDecision:
            parsed: BaseModel | None = self._route(user, language)
            usage = Usage(212, 38)
        elif response_model is QueryRewrite:
            parsed, usage = QueryRewrite(queries=["vol vélo local commun"]), Usage(150, 20)
        elif response_model is ModelAssessment:
            parsed, usage = self._assess(user, language), Usage(2480, 410)
        else:  # the credential probe
            return ChatTurn(ChatMessage(Role.ASSISTANT, "OK"), None, Usage(12, 1), model)
        return ChatTurn(ChatMessage(Role.ASSISTANT), parsed, usage, model)

    # --- concierge -------------------------------------------------------------------------------

    @staticmethod
    def _route(user: str, language: str) -> RouteDecision:
        match = _FENCED.search(user)
        text = match.group(1).strip().lower() if match else ""
        if any(text.startswith(g) for g in GREETINGS):
            return RouteDecision(intent=Intent.SMALLTALK, reply=REPLIES[language])
        if any(word in text for word in OFF_TOPIC):
            return RouteDecision(intent=Intent.OFF_TOPIC, reply=SCOPE[language])
        return RouteDecision(intent=Intent.CLAIM, reply="")

    # --- analyst -----------------------------------------------------------------------------------

    def _assess(self, user: str, language: str) -> ModelAssessment:
        match = _FENCED.search(user)
        claim = match.group(1).lower() if match else ""
        excerpts = _excerpts(user)
        fr = language == "French"
        try:
            if "bike" in claim or "vélo" in claim:
                return self._bike(excerpts, fr)
            if "candle" in claim or "bougie" in claim:
                return self._candle(excerpts, fr)
            if "phone" in claim or "smartphone" in claim or "téléphone" in claim:
                return self._phone(excerpts, fr)
            if "pipe" in claim or "canalisation" in claim or "water" in claim:
                return self._water(excerpts, fr)
        except LookupError:
            pass
        return ModelAssessment(
            verdict=Verdict.NEEDS_MORE_INFO,
            headline="Je ne peux pas conclure sans plus de détails."
            if fr
            else "I can't conclude without more detail.",
            reasoning="Les extraits ne permettent pas de trancher."
            if fr
            else "The excerpts do not settle this.",
            citations=[],
            missing_information=["Que s'est-il passé exactement ?" if fr else "What exactly happened?"],
            next_steps=[],
        )

    @staticmethod
    def _bike(excerpts: Excerpts, fr: bool) -> ModelAssessment:
        return ModelAssessment(
            verdict=Verdict.NOT_COVERED,
            headline=(
                "Non couvert : le local commun n'était pas verrouillé."
                if fr
                else "Not covered: the shared bike room was not locked."
            ),
            reasoning=(
                "L'article 9 n'accorde la garantie pour un vol dans un local commun que si le local était fermé "
                "à clé et que le vol a eu lieu avec effraction. Ici la porte était ouverte, donc l'exclusion "
                "s'applique, quelle que soit la personne responsable."
                if fr
                else "Article 9 only covers theft from a shared room if the room was locked and the thief "
                "broke in. Here the door had been left open, so the exclusion applies no matter who was "
                "responsible."
            ),
            citations=[
                _cite(
                    excerpts,
                    "n'est garanti que si deux conditions sont réunies",
                    CitationRole.CONDITION,
                ),
                _cite(
                    excerpts,
                    "Aucune garantie n'est due lorsque le local commun était ouvert, non verrouillé",
                    CitationRole.EXCLUDES,
                ),
            ],
            missing_information=[
                "Y a-t-il des traces d'effraction ?" if fr else "Was there any sign of forced entry?",
                "Une plainte a-t-elle été déposée sous 24 heures ?"
                if fr
                else "Was a police report filed within 24 hours?",
            ],
            next_steps=[
                "Déposez plainte et déclarez le sinistre dans les 8 jours."
                if fr
                else "File a police report and declare the loss within 8 days."
            ],
        )

    @staticmethod
    def _candle(excerpts: Excerpts, fr: bool) -> ModelAssessment:
        return ModelAssessment(
            verdict=Verdict.AMBIGUOUS,
            headline=(
                "Probablement exclu, sauf si la garantie « Dommages accidentels » est souscrite."
                if fr
                else "Probably excluded, unless the optional Accidental damage cover was taken."
            ),
            reasoning=(
                "La chaleur sans embrasement (roussissement, fonte) n'est pas garantie par l'article 4, et "
                "l'article 11 exclut les marques de cire ou de bougie. L'article 12 les couvrirait seulement "
                "si l'option figure aux conditions particulières, ce que je ne peux pas voir."
                if fr
                else "Heat damage without flames (scorching, melting) is not covered by Article 4, and Article 11 "
                "excludes wax and candle marks. Article 12 would cover them only if the option appears in your "
                "particular conditions, which I cannot see."
            ),
            citations=[
                _cite(
                    excerpts,
                    "Ne sont pas garantis les dégâts causés par la chaleur sans embrasement",
                    CitationRole.EXCLUDES,
                ),
                _cite(excerpts, "marques de cire ou de bougie", CitationRole.EXCLUDES),
                _cite(
                    excerpts,
                    "Cette garantie n'est acquise que si elle est mentionnée aux conditions particulières",
                    CitationRole.CONDITION,
                ),
            ],
            missing_information=[
                "Vos conditions particulières mentionnent-elles « Dommages accidentels » ?"
                if fr
                else "Do your particular conditions list the optional Accidental damage cover?"
            ],
            next_steps=[
                "Vérifiez vos conditions particulières, puis déclarez le sinistre sous 8 jours."
                if fr
                else "Check your particular conditions, then declare the loss within 8 days."
            ],
        )

    @staticmethod
    def _phone(excerpts: Excerpts, fr: bool) -> ModelAssessment:
        return ModelAssessment(
            verdict=Verdict.AMBIGUOUS,
            headline=(
                "Peut-être couvert, mais cela dépend d'options que le résumé ne détaille pas."
                if fr
                else "Possibly covered, but it depends on options the summary does not detail."
            ),
            reasoning=(
                "Le résumé du produit cite le vol parmi les garanties optionnelles et mentionne les biens nomades "
                "pour les occupants. Il ne dit pas si ces options sont souscrites, ni les conditions et plafonds : "
                "seules les conditions générales complètes peuvent trancher."
                if fr
                else "The product summary lists theft among the optional covers and mentions portable items for "
                "occupants. It does not say whether those options are subscribed, nor their conditions and limits: "
                "only the full general conditions can settle this."
            ),
            citations=[
                _cite(
                    excerpts,
                    "Le vol, les actes de vandalisme et de malveillance si",
                    CitationRole.CONDITION,
                ),
                _cite(excerpts, "Les biens nomades", CitationRole.GRANTS),
            ],
            missing_information=[
                "Le module « Biens nomades » figure-t-il sur votre contrat ?"
                if fr
                else "Is the Portable items option on your policy?"
            ],
            next_steps=[
                "Contactez votre agent avec le numéro de plainte."
                if fr
                else "Contact your agent with the police report number."
            ],
        )

    @staticmethod
    def _water(excerpts: Excerpts, fr: bool) -> ModelAssessment:
        return ModelAssessment(
            verdict=Verdict.COVERED,
            headline="Semble couvert par la garantie de base Dégâts des eaux."
            if fr
            else "Appears covered by the base Water damage cover.",
            reasoning=(
                "Les dégâts des eaux figurent parmi les couvertures de base. Franchise, plafonds et vétusté ne sont "
                "pas détaillés dans ce résumé et peuvent réduire l'indemnité."
                if fr
                else "Water damage is listed among the base covers. Deductible, limits and depreciation are not "
                "detailed in this summary and may reduce the payout."
            ),
            citations=[_cite(excerpts, "Dégâts des eaux", CitationRole.GRANTS)],
            missing_information=[],
            next_steps=["Déclarez le sinistre sous 8 jours." if fr else "Declare the loss within 8 days."],
        )
