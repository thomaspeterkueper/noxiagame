# Teilprojekt Gastronomie

Maßgeblich: `docs/gameplay/hospitality-venues.md`, `docs/gameplay/settlement-tiers.md`.

## Erledigt

- Bestellen am Tresen angebunden: Karte, gesperrte Posten, `requestId` je Versuch, Gesprächsfakten mit Karte (Branch `feat/hospitality-order-ui`). Beschreibung: `hospitality-venues.md` Abschnitt 5.
- `order`, `serve`, `pay` (dazu `sit`, `consume`) im `INTERIOR_CAPABILITY_REGISTRY`.
- Karten für Bar und Restaurant vorgeschlagen (`hospitality-venues.md` Abschnitt 5), nicht angelegt.
- Lokal ohne Personal: geschlossen oder Automatencafé (Entscheidung Thomas, 10.10.2026). Platzhalter-Wirt entfernt.

## Offene Aufgaben

1. Bestelloberfläche gegen die echte Datenbankfunktion prüfen, sobald Migration `20261010110000` angewendet ist.
2. „Geschlossen“ an anwesendes Personal binden statt an die Arbeitszuweisung, sobald `person_interior_presence` verlässlich geschrieben wird.

## Nicht in diesem Teilprojekt

- Wirt als Bewohner mit Stelle und Lohn, Stellenzahl aus den Personalplätzen.
- Hunger und Durst von Spielern.
- Wirkung des Lokals auf Stimmung.
