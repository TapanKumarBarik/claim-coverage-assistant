"""Preset claims for the UI. The first two are the scenarios from the brief."""

from __future__ import annotations

from app.api.schemas import Example

EXAMPLES: list[Example] = [
    Example(
        id="bike-shared-storage",
        contract_id="demo-habitat-confort",
        title={
            "en": "Bike stolen from the shared storage room",
            "fr": "Vélo volé dans le local commun",
        },
        claim={
            "en": (
                "My bike was stolen from the shared bike storage room of my apartment building. "
                "The room's door was unlocked that day because a neighbour had left it open. "
                "The bike was not locked to anything."
            ),
            "fr": (
                "Mon vélo a été volé dans le local à vélos commun de mon immeuble. La porte du "
                "local n'était pas verrouillée ce jour-là car un voisin l'avait laissée ouverte. "
                "Le vélo n'était attaché à rien."
            ),
        },
    ),
    Example(
        id="candle-garden-table",
        contract_id="demo-habitat-confort",
        title={
            "en": "Candle melts and marks the garden table",
            "fr": "Une bougie fait fondre la table de jardin",
        },
        claim={
            "en": (
                "During our holiday week at home, we lit a candle on the wooden table in our "
                "garden. The heat melted the wax and scorched the tabletop, leaving a permanent "
                "mark. Nothing caught fire."
            ),
            "fr": (
                "Pendant notre semaine de vacances à la maison, nous avons allumé une bougie sur "
                "la table en bois de notre jardin. La chaleur a fait fondre la cire et roussi le "
                "plateau, laissant une marque permanente. Rien n'a pris feu."
            ),
        },
    ),
    Example(
        id="phone-stolen-cafe",
        contract_id="foyer-mozaik",
        title={
            "en": "Phone stolen from a bag at a café",
            "fr": "Téléphone volé dans un sac au café",
        },
        claim={
            "en": (
                "My smartphone was stolen from my bag while I was sitting in a café in "
                "Luxembourg City. I have filed a police report."
            ),
            "fr": (
                "Mon smartphone a été volé dans mon sac alors que j'étais assis dans un café à "
                "Luxembourg-Ville. J'ai déposé plainte à la police."
            ),
        },
    ),
    Example(
        id="water-leak-neighbour",
        contract_id="axa-optihome",
        title={
            "en": "Water leak damages the ceiling",
            "fr": "Une fuite d'eau abîme le plafond",
        },
        claim={
            "en": (
                "A pipe burst in the flat above mine and water came through my living-room "
                "ceiling, damaging the paint and a bookshelf."
            ),
            "fr": (
                "Une canalisation a éclaté dans l'appartement au-dessus du mien et l'eau a "
                "traversé le plafond de mon salon, abîmant la peinture et une bibliothèque."
            ),
        },
    ),
]
