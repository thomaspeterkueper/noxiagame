---
title: "Rohstoffe aus dem Land: Holzeinschlag, Feldbau, Weide, Steinbruch auf eigenen Flurstücken"
source_area: earth
target_area: core
status: open
priority: normal
created: 2026-10-28
claimed_by: null
depends_on: [20261028-0040-core-to-core-construction-materials, 20261027-0930-core-to-core-production-input-gating]
touches: [earth_parcels, earth_parcel_owners, logistics_inventories, lib/game/tick.ts]
input_sha: 9ca6990a
write_scope:
  - supabase/migrations/ (neue Dateien)
  - lib/game/production/
read_scope:
  - docs/decisions/NOXIA-MAT-0001-baustoffe-und-rohstoffgewinnung.md
  - docs/workstreams/world-map.md (Flurstücke)
  - lib/worldlab/alkis.ts (Nutzungen aus dem Kataster)
risk_class: runtime-data
max_commits: 15
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Migration in Produktion anwenden
---

# Auftrag

Die Weltkarte kennt die reale Nutzung jedes Flurstücks (`earth_parcels.usage` aus dem Kataster: Wald, Ackerland, Grünland, …) und vorhandene Steinbrüche (OSM `landuse=quarry`). Der Core soll daraus Produktionsquellen machen, die einem Eigentümer gehören:

- Wald: nachhaltiger Holzeinschlag (≈ Zuwachs je ha und Jahr) oder Kahlschlag (Vorrat einmalig, danach Pflicht zur Aufforstung, Fläche trägt lange nichts). Der Holzvorrat des Flurstücks ist ein Zustand, der wächst und abnimmt.
- Ackerland: Feldbau nach NOXIA-FOOD-0002 (Saison, Saatgut, Ernte ins Lager).
- Grünland: Weide mit begrenzter Tierzahl je ha (Tierhaltung als eigener späterer Schritt).
- Steinbruch: Gesteinsabbau nur mit Abbaurecht (vorhandene Steinbrüche); neue nur über Genehmigung.

Die Weltkarte (Workstream world-map) baut danach die Bedienung: Tafel des Flurstücks mit „Holz schlagen“, „Säen“, Bestand, Ertrag, Lager, und zeigt den Zustand auf der Karte (Lichtung, Feld, Weide).

## Akzeptanzkriterien

- [ ] Ein Verfahren läuft nur auf einem Flurstück mit passender Nutzung und nur für den Eigentümer.
- [ ] Erträge landen im Lager des Eigentümers am Ort (eine Buchung), Holzvorrat/Bodenzustand wird fortgeschrieben.
- [ ] Nutzungsänderung (Wald → Acker) ist ein Antrag mit Zeit und Gebühr, kein Knopfdruck.
