# Teilprojekt Gastronomie

Maßgeblich: `docs/gameplay/hospitality-venues.md`, `docs/gameplay/settlement-tiers.md`.

## Erledigt

- Bestellen am Tresen angebunden: Karte, gesperrte Posten, `requestId` je Versuch, Gesprächsfakten mit Karte (Branch `feat/hospitality-order-ui`). Beschreibung: `hospitality-venues.md` Abschnitt 5.
- `order`, `serve`, `pay` (dazu `sit`, `consume`) im `INTERIOR_CAPABILITY_REGISTRY`.
- Karten für Bar und Restaurant vorgeschlagen (`hospitality-venues.md` Abschnitt 5), nicht angelegt.
- Lokal ohne Personal: geschlossen oder Automatencafé (Entscheidung Thomas, 10.10.2026). Platzhalter-Wirt entfernt.

- Ortswissen für Figuren im Lokal: reale Geographie aus den Kartendaten plus NOXIA-Einrichtungen am Ort (Branch `feat/hospitality-place-knowledge`). Die Gesprächsroute nimmt dafür das neue, optionale Feld `placeKnowledge` an.

- Karte am ganzen Tresen, Bestelltes sichtbar im Raum, „Für mich / Für <Person>“ beim Bestellen, Kontostand in der Kopfzeile folgt der Bestellung (Branch `feat/hospitality-treat`). Erste echte Bestellung live am 12.10.2026.

- Gebäudeansicht fürs Café auf der Erde: `public/assets/buildings/cafe/earth/style-anchor.svg`, eingetragen in `lib/game/buildings/visuals.ts` (Branch `feat/cafe-building-view`).

## Offene Aufgaben

2. „Geschlossen“ an anwesendes Personal binden statt an die Arbeitszuweisung, sobald `person_interior_presence` verlässlich geschrieben wird.

3. Ortswissen-Abruf einmal live prüfen (`/api/game/hospitality/place`); die Regeln sind mit echten Daten aus Sundern getestet, der Abruf selbst lief noch nicht.

## Nicht in diesem Teilprojekt

- Wirt als Bewohner mit Stelle und Lohn, Stellenzahl aus den Personalplätzen.
- Hunger und Durst als Bedürfnisse, auch für Spieler (entschieden am 12.10.2026, liegt bei Bevölkerung und Ökonomie). Sobald es sie gibt: im Lokal anzeigen, was ein Posten stillt.
- Wirkung des Lokals auf Stimmung.
