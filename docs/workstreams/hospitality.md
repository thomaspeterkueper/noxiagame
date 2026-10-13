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

- Gebäudeansichten für Bar und Restaurant (Erde), eingetragen in `visuals.ts`.
- Leben im Lokal: Bewohner, die dort in der letzten Stunde wirklich gekauft haben, stehen am Tresen an, gehen um die Möbel herum zu ihrem Platz, sitzen mit ihrer Bestellung und gehen wieder (`guestMoment`, `venuePath`, `GET /api/game/hospitality/guests`). Nichts wird erfunden oder gespeichert.
- Öffnungszeiten nach Koloniezeit (Café 6–20, Restaurant 11–23, Bar 17–2), Mitbekommenes fürs Personal aus echten Ereignissen am Ort, Treppe ins Obergeschoss, sobald das Gebäude Wohn- oder Gästeplätze hat (Branch `feat/hospitality-hours-hearsay-upper`). Beschreibung: `hospitality-venues.md` Abschnitte 3 und 4.
- Karte mit gezeichneten Bildern je Posten statt nur Text, dieselben Bilder im Raum (Branch `feat/hospitality-item-icons`).

## Gestellte Requests

- R-1 an Bevölkerung und Ökonomie: Bar und Restaurant baubar machen.
- R-2 an Bevölkerung und Ökonomie: Karten für Bar und Restaurant.
- R-3 an Bevölkerung und Ökonomie: Käufe der Bewohner sind selten, das Lokal meist leer.
- R-4 an Bevölkerung und Ökonomie: Öffnungszeiten als Gebäudedaten; Bewohner kaufen und Personal arbeitet nur in dieser Zeit.
- R-5 an Bevölkerung und Ökonomie: Ausgehen nach Tageszeit.
- R-6 an Bevölkerung und Ökonomie: Wohnen über dem Lokal.
- R-7 an Bevölkerung und Ökonomie: Hotel und Gästezimmer.
- R-8 an Bevölkerung und Ökonomie: Gerüchte als Wissen der Personen, Auskunft kaufen und verkaufen.
- R-9 an Bevölkerung und Ökonomie: Lehren aus SunDog – sichtbare Bedürfnisbalken, Wirkung von Alkohol, Ware beim Wirt, Bilder als gemeinsamer Bestand.

## Offene Aufgaben

2. „Geschlossen“ an anwesendes Personal binden statt an die Arbeitszuweisung, sobald `person_interior_presence` verlässlich geschrieben wird.

3. Ortswissen-Abruf einmal live prüfen (`/api/game/hospitality/place`); die Regeln sind mit echten Daten aus Sundern getestet, der Abruf selbst lief noch nicht.

4. Gäste-Abruf einmal live prüfen (`/api/game/hospitality/guests`): Erscheint nach einem echten Kauf eines Bewohners eine Person am Tresen?

5. Öffnungszeiten, Treppe und Mitbekommenes einmal live prüfen; bisher nur Regeltests.

6. Empfang und Lobby fürs Hotel als eigener Innenraum, sobald R-7 entschieden ist.

7. „Auskunft“ als Posten am Tresen (SunDog: Info kaufen und verkaufen), sobald R-8 entschieden ist.

## Nicht in diesem Teilprojekt

- Wirt als Bewohner mit Stelle und Lohn, Stellenzahl aus den Personalplätzen.
- Hunger und Durst als Bedürfnisse, auch für Spieler (entschieden am 12.10.2026, liegt bei Bevölkerung und Ökonomie). Sobald es sie gibt: im Lokal anzeigen, was ein Posten stillt.
- Wirkung des Lokals auf Stimmung.
