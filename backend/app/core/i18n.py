"""Server-side strings that are not produced by the model."""

from __future__ import annotations

from enum import StrEnum

from app.core.constants import Language


class Msg(StrEnum):
    DISCLAIMER = "disclaimer"
    SUMMARY_ONLY = "summary_only"
    DROPPED = "dropped"
    DOWNGRADED = "downgraded"
    PREDATES = "predates"
    PARTIAL = "partial"
    SYNTHETIC = "synthetic"
    NO_DOCUMENTS = "no_documents"
    BLOCKED = "blocked"
    FALLBACK_REPLY = "fallback_reply"


LANGUAGE_NAMES: dict[Language, str] = {Language.EN: "English", Language.FR: "French"}

_MESSAGES: dict[Language, dict[Msg, str]] = {
    Language.EN: {
        Msg.DISCLAIMER: (
            "Informational analysis of public policy documents, not an insurance decision or "
            "legal advice. Only the insurer can confirm coverage."
        ),
        Msg.SUMMARY_ONLY: (
            "This answer rests on a product summary or brochure, not the full general "
            "conditions. Confirm it against the contract before relying on it."
        ),
        Msg.DROPPED: (
            "{n} citation(s) proposed by the model could not be matched to the source text and were removed."
        ),
        Msg.DOWNGRADED: (
            "No quoted clause could be verified, so the conclusion was downgraded to "
            "'ambiguous' instead of being stated as fact."
        ),
        Msg.PREDATES: (
            "The loss date is before the earliest document version on file; the earliest "
            "available version was used."
        ),
        Msg.PARTIAL: "Long contract: {k} of {n} passages were reviewed.",
        Msg.SYNTHETIC: "This contract is fictional demo data, not a real policy.",
        Msg.NO_DOCUMENTS: "This contract has no live documents.",
        Msg.BLOCKED: "This message can't be processed. Please describe your claim in plain words.",
        Msg.FALLBACK_REPLY: (
            "I can check whether a home-insurance claim looks covered. Tell me what happened."
        ),
    },
    Language.FR: {
        Msg.DISCLAIMER: (
            "Analyse informative de documents contractuels publics, qui ne constitue ni une "
            "décision d'assurance ni un avis juridique. Seul l'assureur peut confirmer la couverture."
        ),
        Msg.SUMMARY_ONLY: (
            "Cette réponse repose sur un résumé de produit ou une brochure, et non sur les "
            "conditions générales complètes. Vérifiez-la dans le contrat avant de vous y fier."
        ),
        Msg.DROPPED: (
            "{n} citation(s) proposée(s) par le modèle n'ont pas pu être retrouvée(s) dans le "
            "texte source et ont été retirée(s)."
        ),
        Msg.DOWNGRADED: (
            "Aucune clause citée n'a pu être vérifiée ; la conclusion a donc été ramenée à "
            "« ambigu » plutôt qu'affirmée."
        ),
        Msg.PREDATES: (
            "La date du sinistre est antérieure à la plus ancienne version de document "
            "disponible ; cette version a été utilisée."
        ),
        Msg.PARTIAL: "Contrat volumineux : {k} passages sur {n} ont été examinés.",
        Msg.SYNTHETIC: "Ce contrat est fictif (données de démonstration), pas une vraie police.",
        Msg.NO_DOCUMENTS: "Ce contrat n'a aucun document actif.",
        Msg.BLOCKED: "Ce message ne peut pas être traité. Décrivez votre sinistre avec des mots simples.",
        Msg.FALLBACK_REPLY: (
            "Je peux vérifier si un sinistre habitation semble couvert. Dites-moi ce qui s'est passé."
        ),
    },
}


def message(language: Language, key: Msg, **values: object) -> str:
    return _MESSAGES[language][key].format(**values)
