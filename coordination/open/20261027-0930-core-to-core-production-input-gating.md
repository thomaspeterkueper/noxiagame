---
title: "Produktion nur mit Eingängen: Tick prüft Verbrauch vor Erzeugung und speichert den Engpass"
source_area: core
target_area: core
status: open
priority: high
created: 2026-10-27
claimed_by: null
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

- [ ] Ein Gebäude ohne Eingang erzeugt nichts und meldet das fehlende Gut.
- [ ] Reihenfolge bei mehreren Verbrauchern eines Guts am Ort ist deterministisch und dokumentiert.
- [ ] Forschungslauf vorher/nachher verglichen (Wasser, Energie, Metall dürfen sich nur dort ändern, wo vorher aus dem Nichts produziert wurde).
- [ ] Regel identisch zu `runProcess` in `lib/game/food/chain.ts` (eine Regel, zwei Aufrufer) oder dorthin vereinheitlicht.
