# Seelenberg ↔ NOXIA-FOOD-0002 – Integrationsvertrag

Stand: 2026-10-27
Status: Pilotentscheidung / noch keine Live-Core-Anbindung
Upstream: main (NOXIA-FOOD-0002, Lebensmittel-Fachmodell und bestehende Hospitality-Linie bleiben unverändert)
Pilot: feat/seelenberg-living-systems-pilot / PR #526

## Priorität beim Synchronisieren
**Upstream-Hospitality behalten, Lebensmittel-Fachmodell von main übernehmen, die additive Seelenberg-Erprobung erhalten.**
Keine pauschale Konfliktauflösung `ours` oder `theirs`; die bestehenden Hospitality-Änderungen und Food-/School-Entwicklungen dürfen nicht überschrieben werden. Vor dem Merge zunächst lokalen Merge/Rebase samt Diff-Prüfung, dann `pnpm test:food-chain`, Hospitality-Regressionen, Earth-/Transport-Tests sowie Pilot-CI ausführen. Keine automatische Zusammenführung in die Produktion.

## Quelle der Wahrheit
- Prozesse, Güter, Haltbarkeit und Nährwert: `lib/game/food/chain.ts` auf `main`.
- Begründung und offene Core-Requests: `docs/decisions/NOXIA-FOOD-0002-lebensmittelkette-fachmodell.md`.
- Routen-Geometrie und Wegeklassifikation: bestehender Earth-Layer; Seelenberg-Routengraph nur Experimental-Fallback.
- Reservierung, Transportjobs, Fracht, Buchungsorte, Produktions-Tick: Core.
- Hotel/Café/Gastronomie-Gäste und Hospitality-Konsum: vorhandene Hospitality-Domäne; Änderungen daran sind ausdrücklich **nicht** Teil dieses Piloten.

## Einheitenentscheidung
Lebensmittelmengen werden fachlich in **kg** geführt (wie bereits in `GoodSpec.unit` auf `main`). Keine Umstellung der allgemeinen Energieeinheit MWh. Für kleinste Mengen (Salz/Hefe, Verderb-/Teilchargen) muss die Core-Persistenz entweder sichere fraktionale kg mit dokumentierter Dezimalpräzision oder integer Gramm als interne Speicherauflösung unterstützen. Präferenz: integer Gramm in persistenten Buchungen, öffentlich kg als Einheit. Keine Float-Drift in Summen/Bilanzen. Bestehende Bestände dürfen nicht stillschweigend als kg statt t gelesen werden; explizite und getestete Migration je Ressourcentyp erforderlich.

## Seelenberg-Schnittstelle
1. `processesFor('earth_open')` bzw. `earth_indoor` liefert zulässige Prozesse; kein eigener Seelenberg-Rezeptkatalog.
2. Echte Straßen und Fahrzeugbedingungen erzeugen eine Fahrzeit. Der Core leitet daraus Liefertermin/Lieferzeit ab und bucht Fracht exakt einmal.
3. Lieferverzug/Sperrung wirkt auf `ChainConfig.leadDays` / `Disruption` im isolierten Modell; im Spiel nur über Core-Transportjobs.
4. Eingangs-Gating der Produktion vor Aktivierung der simulierten Betriebsproduktion.
5. 554 Personen sind eine dokumentierte Testannahme, kein behaupteter live exakter Einwohnerstand.
6. Hospitality kann Lebensmittel zukünftig verbrauchen, jedoch erst mit ausdrücklich versioniertem Domänenvertrag; keine verdeckte Kopplung.

## Abnahme
- `pnpm test:food-chain` und Pilot-Tests grün
- keine Doppelbuchung zwischen Experiment und Core
- Tests für Rundung, Chargen mit Salz/Hefe, Teilmengen, Verderb und kg/t-Migration
- bestehende Hospitality-Endpoints und -Tests unverändert funktionsfähig
- Realgeodaten vorhanden, lizenziert und mit Provenienz erfasst
- Merge erst nach geprüftem Diff und durchgeführten Regressionstests
