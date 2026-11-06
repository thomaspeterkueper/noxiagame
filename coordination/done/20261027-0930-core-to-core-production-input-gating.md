---
title: "Produktion nur mit Eingängen: Tick prüft Verbrauch vor Erzeugung und speichert den Engpass"
source_area: core
target_area: core
status: done
priority: high
created: 2026-10-27
claimed_by: earth (Weltkarte, auf Thomas' Wunsch „mache selbst weiter“, 06.11.2026)
depends_on: []
touches: [location_resources, building_definitions, lib/game/tick.ts]
input_sha: 9ca6990a
write_scope:
  - lib/game/tick.ts
  - lib/game/production/ (neu)
  - supabase/migrations/ (neue Datei, falls Engpass gespeichert wird)
read_scope:
  - docs/decisions/NOXIA-FOOD-0002-lebensmittelkette-fachmodell.md
  - lib/game/food/chain.ts (runProcess als Referenzregel)
risk_class: runtime-data
max_commits: 10
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Migration in Produktion anwenden
---

# Auftrag

`runPopulationTick` rechnet heute Produktion und Verbrauch je Ressource getrennt: Ein Gebäude liefert seine volle Produktion, auch wenn seine Eingänge fehlen (der Bestand wird nur bei 0 gekappt). Damit entsteht Mehl ohne Getreide und Lebensmittel aus der Hydroponik ohne Wasser – Störungen haben keine Folgen.

Gewünscht: Je Gebäude zuerst prüfen, wie viele Durchgänge die Eingänge im Ortsbestand (bzw. Anlagenlager) erlauben, dann genau so viel verbrauchen und erzeugen. Den Engpass je Gebäude und Tick festhalten (z. B. `limited_by` am Gebäude oder in einem Ereignis), damit Karte, Gebäude und Personen ihn zeigen können.

## Abgrenzung

Keine Änderung an Preisen oder Bevölkerungsformeln. NPC-Firmen-Tick denselben Regeln unterwerfen, aber im selben Auftrag nur, wenn klein; sonst Folgeauftrag.

## Akzeptanzkriterien

- [x] Ein Gebäude ohne Eingang erzeugt nichts und meldet das fehlende Gut.
- [x] Reihenfolge bei mehreren Verbrauchern eines Guts am Ort ist deterministisch und dokumentiert.
- [ ] Forschungslauf vorher/nachher verglichen (Wasser, Energie, Metall dürfen sich nur dort ändern, wo vorher aus dem Nichts produziert wurde).
- [x] Regel identisch zu `runProcess` in `lib/game/food/chain.ts` (eine Regel, zwei Aufrufer) oder dorthin vereinheitlicht.

## Ergebnis (06.11.2026)

- `lib/game/production/inputGate.ts` (`gateProduction`), getestet in `inputGate.test.ts`, u. a. Vergleich mit `runProcess` der Lebensmittelkette: Ein Gebäude läuft je Tick nur, wenn alle Eingänge im Ortsbestand liegen; dann verbraucht es sie und erzeugt seine Ausgänge. Sonst weder Verbrauch noch Erzeugung, das fehlende Gut wird gemeldet.
- Reihenfolge: Gebäudekennung aufsteigend; Gebäude vor den Bewohnern; Ausgänge stehen erst im nächsten Tick zur Verfügung.
- `lib/game/tick.ts` (`runPopulationTick`): gilt für Ortsbestand (`location_resources`) und Anlagenlager-Gutschrift (`noxia_credit_facility_output`). Firmenanlagen (`actor_id`) unverändert (Erzeugung im Firmen-Tick, Verbrauch wie bisher) – Folgeauftrag, falls sie dieselbe Regel brauchen.
- Engpass: im Tick-Ergebnis je Ort `limitedBy: [{ id, resource }]` und im Log. **Nicht gespeichert** (keine Migration, siehe `excluded_actions`); eine Spalte/Ereignis für Karte und Gebäudetafel ist ein kleiner Folgeschritt.
- Forschungslauf vorher/nachher: Heute hat nur `hydroponics` einen Verbrauch (Wasser, Energie), und davon steht kein aktives Gebäude (Abfrage 06.11.2026). Wasser, Energie und Metall ändern sich durch die Regel daher derzeit nirgends; sie greift, sobald Gebäude mit Eingängen (NOXIA-MAT-0001, NOXIA-FOOD-0002) entstehen.
