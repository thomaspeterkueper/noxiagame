# Teilprojekt Bevölkerung und Ökonomie

Maßgeblich: `docs/decisions/NOXIA-LIVING-0006` bis `0010`, `NOXIA-FIN-0001`, `NOXIA-OMNI-0001`, `docs/research/colony-run.md`.

## Stand

- Schattenbetrieb Wohnen läuft live (`NOXIA_HOUSING_SHADOW`). Einzug in staatlichen Wohnraum gebaut, Schalter `NOXIA_HOUSING_PUBLIC_PLACEMENT` aus.
- Arbeitgeber leben von einer 14-Tage-Reserve (erster Lohnlauf Tick 2136). Laufende Einnahmen fehlen.
- Automatische Gebäudeausschüttung ist aus. Erlöse nur aus echten Zahlungen.
- Bestellung im Lokal: `order_hospitality_item` und `/api/game/hospitality/order` (Migration `20261010110000`).

## Offene Aufgaben

1. Prüfskript `supabase/tests/public_housing_placement.test.sql` laufen lassen, danach Schalter für den Einzug.
2. Stellenkapazität: offene Stellen eines Lokals aus dessen Personalplätzen ableiten (`VENUE_LAYOUTS`, siehe `hospitality-venues.md` 6.1).
3. Ortsspielraum: Mittellosigkeit einrechnen (Arbeitslosigkeit erhöht ihn derzeit).
4. Wahrnehmung im Lokal: „selber Sichtbereich" statt „selber Raum", bevor Begegnungen dort auf Stimmung wirken.
5. Hunger und Durst etablieren – **entschieden (Thomas, 12.10.2026): ja, auch für Spieler.** Entwurf: `docs/decisions/NOXIA-LIVING-0012-hunger-and-thirst.md` (Status: proposed). Kurz: `hunger` und `thirst` ersetzen `sustenance` in drei Schritten (Bestandswerte übernehmen, `sustenance` als `min(hunger, thirst)` ableiten, dann entfernen); Spielerwerte in `player_needs`, beim Lesen aus letztem Essen/Trinken und **aktiver Spielzeit** berechnet – **entschieden (12.10.2026): offline ändert sich nichts, Mangel ist vorerst nur sichtbar**, Untergrenze 0,25; eine Wirkungstabelle `hospitality_item_effects` für Spieler und Bewohner (Getränk → Durst, Kuchen → Hunger, Mahlzeit → beides). **Der Status ist für den Spieler sichtbar:** Hunger und Durst als Anzeige in der Topbar, Wirkung je Posten auf der Karte. Offene Fragen in NOXIA-LIVING-0012 am Ende. Voraussetzung für Aufgabe 9.
6. Rückbau und Verkauf von Gebäuden schreiben Credits ohne Gegenkonto gut (`app/api/game/build/route.ts`).
7. Siehe Request R-2.
8. Startcafé braucht Personal: Der Platzhalter-Wirt ist entfernt, ein Café ohne Personal ist ein Automatencafé ohne Einstiegsgespräch. Prüfen, ob `20261010090000_earth_cafe_host.sql` live angewendet ist (aus Teilprojekt Gastronomie).
9. Ausgeben im Lokal: Die Oberfläche sendet bei `POST /api/game/hospitality/order` jetzt `recipientPersonId`, wenn der Spieler für eine Person im Raum bestellt. Route und `order_hospitality_item` werten das Feld noch nicht aus. Gewünscht (Thomas, 12.10.2026): Die Eigenschaften der Person ändern sich – ihr Hunger bzw. Durst wird gestillt (nach Aufgabe 5, `hospitality_item_effects`), dazu Wirkung auf Beziehung und Stimmung. Entwurf: NOXIA-LIVING-0012 Abschnitt 7. Zu bauen: Prüfung, dass die Person in diesem Gebäude ist (`person_interior_presence`); Wiederholung per `requestId` wirkt nur einmal (Geld, Bedürfnis, Beziehung, Stimmung in einer Transaktion); Beziehungseffekt skaliert mit dem Bedarf der Person; neue Tabelle `person_player_relationships` nach den Regeln aus NOXIA-LIVING-0008 – eine Beziehung Person ↔ Spieler gibt es bisher nicht; Stimmung über ein `population_events`-Ereignis, nicht direkt in `person_affect`. Erst nach Aufgabe 5 Schritte 1–3 (aus Teilprojekt Gastronomie).

## Requests aus anderen Teilprojekten

Ein Request ist eine Bitte eines anderen Teilprojekts an dieses. Erledigtes hier abhaken und im anfragenden Teilprojekt vermerken.

### R-1 (Gastronomie, 13.10.2026): Bar und Restaurant baubar machen

Innenraum, Figuren, Gesprächswissen, Eintritt und Gebäudeansicht sind fertig (`docs/gameplay/hospitality-venues.md`). Es gibt aber kein einziges solches Gebäude, weil beide Arten nicht gebaut werden können.

- `building_definitions`: je eine aktive Zeile für `bar` und `restaurant`. Zum Vergleich das Café: Kategorie `life`, Stufe 1, 900 Credits, 1 Tick Bauzeit, überall erlaubt. Vorschlag: Bar 1 800 Credits (so steht es schon im lokalen Katalog), Restaurant 2 400 Credits, beide 2 Ticks.
- `lib/game/buildings/index.ts`: `bar` steht dort auf `planned: true`; `restaurant` fehlt.
- Zu entscheiden: ab welcher Ortsstufe (siehe `docs/gameplay/settlement-tiers.md` – Café ab Siedlung, Bar ab Ort?) und ob Spieler sie als zusätzliche Einrichtung bauen dürfen.
- Stellen: Bar 2, Restaurant 3 Personalplätze (Aufgabe 2). Ohne Personal sind beide geschlossen.

### R-2 (Gastronomie, 13.10.2026): Karten für Bar und Restaurant anlegen

Ersetzt Aufgabe 7. Zeilen in `hospitality_menu`; Vorschlag, an Getränk 3 / Kuchen 5 / Mahlzeit 8 des Cafés ausgerichtet:

| `entity_id` | `item_code` | `label` | Credits |
|---|---|---|---|
| `bar` | `drink` | Getränk | 3 |
| `bar` | `snack` | Snack | 4 |
| `bar` | `longdrink` | Longdrink | 6 |
| `restaurant` | `drink` | Getränk | 3 |
| `restaurant` | `dessert` | Nachtisch | 5 |
| `restaurant` | `starter` | Vorspeise | 6 |
| `restaurant` | `main` | Hauptgericht | 12 |

Die Oberfläche zeigt eine neue Karte ohne weitere Änderung. Für Bewohner fehlt dazu der Eintrag in `npc_service_catalog` (heute nur `cafe` / `cafe_meal`), sonst kaufen sie in Bar und Restaurant nichts.

### R-3 (Gastronomie, 13.10.2026): Käufe der Bewohner sind selten

Im Lokal erscheinen jetzt die Bewohner als Gäste, die dort wirklich gekauft haben (`person_consumption_events`, letzte Stunde). Bisher gibt es 19 Käufe insgesamt, etwa einen alle paar Stunden – das Café ist deshalb meist leer bis auf das Personal. Kein Fehler der Anzeige; ob häufiger gegessen und getrunken wird, hängt an Bedarf, Geld und `min_interval_ticks`, also an den Aufgaben 5 und 9.

### R-4 (Gastronomie, 13.10.2026): Öffnungszeiten als Daten

Der Innenraum kennt jetzt Öffnungszeiten nach Koloniezeit (`VENUE_HOURS` in `lib/game/hospitality/venues.ts`: Café 6–20, Restaurant 11–23, Bar 17–2) und zeigt außerhalb davon „geschlossen“. Die Simulation weiß davon nichts.

- Öffnungszeiten als Eigenschaft der Gebäudeart oder des Gebäudes (der Betreiber legt sie fest); der Innenraum liest sie dann statt der festen Werte.
- `order_hospitality_item` und die Käufe der Bewohner lehnen außerhalb der Zeit ab – heute kann ein Bewohner um 3 Uhr im Café kaufen und erscheint dann als Gast im geschlossenen Raum. Der Spieler wird nur von der Oberfläche aufgehalten, nicht vom Server.
- Personal arbeitet in Schichten, die zur Öffnungszeit passen (hängt an Aufgabe 2 und `person_interior_presence`).
- Zu entscheiden: Das Startcafé neuer Spieler ist nachts geschlossen. Entweder öffnet es durchgehend, oder der Einstieg bekommt einen anderen Ort.

### R-5 (Gastronomie, 13.10.2026): Ausgehen nach Tageszeit

Damit sich die drei Lokale unterscheiden: Bewohner gehen morgens ins Café, mittags und abends ins Restaurant, abends in die Bar. Gewichtung der Käufe nach Stunde (`circadian.ts`) und nach Bedürfnis (Aufgabe 5); Freizeit und Geselligkeit als Anlass, nicht nur Hunger. Folgt auf R-2 und R-3.

### R-6 (Gastronomie, 13.10.2026): Wohnen über dem Lokal

Der Innenraum zeigt eine Treppe „PRIVAT ↑“, sobald ein Gastronomiegebäude `residential_capacity` hat; das Personal weiß, dass oben gewohnt wird. Heute hat kein solches Gebäude Wohnplätze.

- Wohnplätze für Café, Bar und Restaurant (als Variante oder Ausbau), Vorschlag: 1–2.
- Der Wirt wohnt bevorzugt über seinem Lokal; sonst Vermietung mit Miete an den Eigentümer.
- Zu entscheiden: eigene Gebäudeart „Wohn- und Geschäftshaus“ oder Ausbau eines bestehenden Lokals.

### R-7 (Gastronomie, 13.10.2026): Hotel und Gästezimmer

Vorbild SunDog: Im Hotel mietet man am Empfang ein Zimmer und ruht sich aus. Der Innenraum zeigt bereits „ZIMMER ↑“, sobald ein Gebäude `transient_capacity` hat.

- Gebäudeart `hotel` (oder Gasthof = Restaurant mit Gästezimmern), baubar, mit `transient_capacity`.
- Zimmerpreis je Nacht, Buchung als versteuerte Überweisung wie bei `order_hospitality_item`; belegte Zimmer zählen gegen die Plätze.
- Wirkung der Übernachtung: Erholung für Spieler und Reisende (zusammen mit Hunger und Durst, Aufgabe 5); Reisende als Personen, die nur vorübergehend am Ort sind.
- Gastronomie baut danach Lobby und Empfang als Innenraum und den Knopf „Zimmer nehmen“.

### R-8 (Gastronomie, 13.10.2026): Gerüchte als Wissen der Personen, Auskunft gegen Geld

Das Personal erzählt jetzt, was am Ort geschehen ist (`lib/game/hospitality/hearsay.ts`, aus Käufen, Baustellen und `population_events`). Das ist aber ein Blick des Lokals auf die Daten: Niemand hat es wirklich erfahren, niemand erinnert sich, und es wandert nicht weiter.

- Wissensspuren je Person: wer was gesehen oder von wem gehört hat, mit Alter und Verlässlichkeit; Weitergabe bei Begegnungen, im Lokal besonders. Der Innenraum liest dann das Wissen der anwesenden Person statt `venueState`.
- Auskunft als Ware nach SunDog (in der Bar kauft und verkauft man „Info“ beim Wirt): Preis, was eine Auskunft enthält (Preise anderer Orte, Stellen, Aufträge), und was der Spieler selbst verkaufen kann. Buchung über den Server, nicht im Gespräch.
- Gastronomie baut danach den Posten „Auskunft“ am Tresen.
