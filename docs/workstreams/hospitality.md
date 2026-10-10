# Teilprojekt Gastronomie

Maßgeblich: `docs/gameplay/hospitality-venues.md`, `docs/gameplay/settlement-tiers.md`.

## Offene Aufgaben

### 1. Bestellen am Tresen anbinden

Die Buchung ist gebaut (Teilprojekt Bevölkerung und Ökonomie). Es fehlt die Oberfläche.

- Karte laden: `GET /api/game/hospitality/order?tileEntityId=…` liefert `credits` und `items` mit `itemCode`, `label`, `priceCredits`, `affordable`.
- Was nicht `affordable` ist, wird angezeigt, ist aber nicht bestellbar – wie beim Kauf von Waren oder Gebäuden. Kein Anschreiben, keine Szene.
- Bestellen: `POST /api/game/hospitality/order` mit `tileEntityId`, `itemCode` und einer frischen `requestId` (UUID je Klick; bei Wiederholung dieselbe, dann wird nicht doppelt gebucht). Antwort enthält `credits` (neuer Stand), `priceCredits`, `taxCredits`.
- Fehlercodes: `NOXIA_CREDITS_INSUFFICIENT` (402), `NOXIA_ORDER_ITEM_NOT_OFFERED` (404), `NOXIA_ORDER_SELLER_ACCOUNT_MISSING` (409).
- Der Knopf am `servicePoint` ersetzt die Meldung „Bestellen noch nicht möglich".
- Gesprächsfakten: Die zwei Fakten „es wird nichts ausgeschenkt oder kassiert" durch Karte und Preise ersetzen, sobald der Knopf funktioniert. Das Personal kennt die Karte, nicht den Kontostand des Gastes.
- Karte bisher nur für `cafe` (Getränk 3, Kuchen 5, Mahlzeit 8). Zeilen für `bar` und `restaurant` in `hospitality_menu` vorschlagen, nicht selbst anlegen.

### 2. Fähigkeiten eintragen

`order`, `serve`, `pay` in `INTERIOR_CAPABILITY_REGISTRY` aufnehmen, damit `validateInteriorTemplate` sie nicht mehr als unbekannt meldet.

### 3. Lokal ohne anwesendes Personal

Entscheidung steht aus (Thomas): geschlossen oder Platzhalter. Bis dahin nichts ändern.

## Nicht in diesem Teilprojekt

- Wirt als Bewohner mit Stelle und Lohn, Stellenzahl aus den Personalplätzen.
- Hunger und Durst von Spielern.
- Wirkung des Lokals auf Stimmung.
