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
5. Hunger und Durst etablieren – **entschieden (Thomas, 12.10.2026): ja, auch für Spieler.** Entwurf: `docs/decisions/NOXIA-LIVING-0012-hunger-and-thirst.md` (Status: proposed). Kurz: `hunger` und `thirst` ersetzen `sustenance` in drei Schritten (Bestandswerte übernehmen, `sustenance` als `min(hunger, thirst)` ableiten, dann entfernen); Spielerwerte in `player_needs`, beim Lesen aus letztem Essen/Trinken und verstrichenen Ticks berechnet, Untergrenze 0,25; eine Wirkungstabelle `hospitality_item_effects` für Spieler und Bewohner (Getränk → Durst, Kuchen → Hunger, Mahlzeit → beides). **Der Status ist für den Spieler sichtbar:** Hunger und Durst als Anzeige in der Topbar, Wirkung je Posten auf der Karte. Offene Fragen in NOXIA-LIVING-0012 am Ende. Voraussetzung für Aufgabe 9.
6. Rückbau und Verkauf von Gebäuden schreiben Credits ohne Gegenkonto gut (`app/api/game/build/route.ts`).
7. Karten für `bar` und `restaurant` in `hospitality_menu` anlegen – Vorschlag in `docs/gameplay/hospitality-venues.md` Abschnitt 5 (aus Teilprojekt Gastronomie).
8. Startcafé braucht Personal: Der Platzhalter-Wirt ist entfernt, ein Café ohne Personal ist ein Automatencafé ohne Einstiegsgespräch. Prüfen, ob `20261010090000_earth_cafe_host.sql` live angewendet ist (aus Teilprojekt Gastronomie).
9. Ausgeben im Lokal: Die Oberfläche sendet bei `POST /api/game/hospitality/order` jetzt `recipientPersonId`, wenn der Spieler für eine Person im Raum bestellt. Route und `order_hospitality_item` werten das Feld noch nicht aus. Gewünscht (Thomas, 12.10.2026): Die Eigenschaften der Person ändern sich – ihr Hunger bzw. Durst wird gestillt (nach Aufgabe 5, `hospitality_item_effects`), dazu Wirkung auf Beziehung und Stimmung. Entwurf: NOXIA-LIVING-0012 Abschnitt 7. Zu bauen: Prüfung, dass die Person in diesem Gebäude ist (`person_interior_presence`); Wiederholung per `requestId` wirkt nur einmal (Geld, Bedürfnis, Beziehung, Stimmung in einer Transaktion); Beziehungseffekt skaliert mit dem Bedarf der Person; neue Tabelle `person_player_relationships` nach den Regeln aus NOXIA-LIVING-0008 – eine Beziehung Person ↔ Spieler gibt es bisher nicht; Stimmung über ein `population_events`-Ereignis, nicht direkt in `person_affect`. Erst nach Aufgabe 5 Schritte 1–3 (aus Teilprojekt Gastronomie).
