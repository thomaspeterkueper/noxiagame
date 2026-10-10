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
5. Hunger und Durst von Spielern: Entwurf, noch keine Entscheidung.
6. Rückbau und Verkauf von Gebäuden schreiben Credits ohne Gegenkonto gut (`app/api/game/build/route.ts`).
7. Karten für `bar` und `restaurant` in `hospitality_menu` anlegen – Vorschlag in `docs/gameplay/hospitality-venues.md` Abschnitt 5 (aus Teilprojekt Gastronomie).
8. Startcafé braucht Personal: Der Platzhalter-Wirt ist entfernt, ein Café ohne Personal ist ein Automatencafé ohne Einstiegsgespräch. Prüfen, ob `20261010090000_earth_cafe_host.sql` live angewendet ist (aus Teilprojekt Gastronomie).
