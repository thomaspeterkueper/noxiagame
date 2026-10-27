---
title: "Reale Schulen (amenity=school) werden öffentliche Spielgebäude mit Eintritt"
source_area: core
target_area: earth
status: open
priority: normal
created: 2026-10-27
claimed_by: null
depends_on: []
touches: [tile_entities, region_features]
input_sha: 840755e
write_scope:
  - lib/world/spatial/earthPlaceMaterializer.server.ts
  - app/earth/EarthWalkableSurface.tsx
  - app/earth/EarthBuildingAccessLayer.tsx
  - supabase/migrations/ (neue Datei)
read_scope:
  - docs/decisions/NOXIA-SCHOOL-0001-grundschule-als-lernort.md
  - lib/world/spatial/earthLocalEnrichment.server.ts
  - lib/worldlab/buildingOffer.ts
  - supabase/migrations/20260909171500_selmecke_reference_settlement.sql
risk_class: migration
max_commits: 8
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Eine reale Schule auf der Erdkarte (zuerst die Grundschule in Sundern) wird ein öffentliches Gebäude: ein `tile_entities`-Eintrag mit `entity_id='basic_school'`, `is_state_owned=true`, Eigentümer der öffentliche Akteur des Ortes (`location_public_actors`), `source_ref` auf das OSM-Objekt, `staff_capacity` nach Grundfläche. „Betreten“ auf dem Punkt öffnet die Einrichtung mit Art `school`.

## Kontext

Heute bleibt `amenity=school` ein POI ohne Raum (`namedPoiTargets` liefert keine Art), Betreten öffnet nichts. Siehe NOXIA-SCHOOL-0001.

## Abgrenzung

Kein Innenraum, kein Unterricht, keine Kompetenzen – das liefern Innenräume und Core. Bis die Schul-Einrichtung fertig ist, darf vorübergehend auf `academy` gezeigt werden. `kindergarten` nur vorbereiten, nicht öffnen.

## Akzeptanzkriterien

- [ ] `amenity=school` wird beim Materialisieren klassifiziert und erzeugt idempotent genau einen öffentlichen `tile_entities`-Eintrag.
- [ ] Die Schule bleibt nicht kaufbar (`notForSaleReason` unverändert).
- [ ] Betreten der Sunderner Grundschule öffnet einen Innenraum.
- [ ] Der Selmecke-Seed bleibt unberührt.
- [ ] Die Schule trägt ihren realen Namen aus OSM (Entscheidung Thomas 27.10.2026).
