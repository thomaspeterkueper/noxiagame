# INTERNAL HANDOFF REQUEST — NOXIA Grid, Map & Terrain

**Status:** OPEN / handoff after PR #68
**Repository:** `thomaspeterkueper/noxiagame`
**Owner after handoff:** dedicated Grid/Map/Terrain workstream (separate ChatGPT tab)
**Created:** 2026-09-05

## Auftrag

Übernimm ab Abschluss von PR #68 die **vollständige weitere Entwicklung des NOXIA Grid-/Karten-/Terrain-Subsystems**. Dazu gehören Renderer, Karteninteraktion, reale Georeferenzierung, DEM-Integration, Terrain-Sampling, 3D-Darstellung und terrainbewusstes Bauen für Erde, Mond und Mars.

Dieser Workstream soll eigenständig arbeiten, aber die unten festgeschriebenen kanonischen Architekturentscheidungen respektieren.

## Aktueller kanonischer Stand

### Weltkoordinaten

- Das alte `32×24`-Raster ist **nur Legacy-/Kompatibilitätsschicht**, nicht mehr die physische Wahrheit der Welt.
- Kanonische freie Platzierung verwendet `LOCAL_ENU_METERS`:
  - `x = East`
  - `y = North`
  - `z = Up`
- Alte `tile_row/tile_col`-Werte dürfen **nicht** in erfundene Meterkoordinaten umgerechnet werden.
- `z_m = NULL` bedeutet: reale Gelände-/Fundamenthöhe noch nicht aufgelöst. Niemals stillschweigend `0` einsetzen.
- Der Client darf die physische `z`-Position eines Neubaus nicht autoritativ bestimmen.

### Planetare Referenzierung

PR #68 führt die 3D-Grundlage ein:

- Earth: WGS84-Geometrie für geodätische/ECEF-/ENU-Transformationen
- Moon: planetozentrische Mondreferenz
- Mars: planetozentrische Marsreferenz
- reversible Transformationen `planetary ↔ Cartesian ↔ LOCAL_ENU_METERS`

**Wichtig Erde:**

- Physische Terrain-/Gebäudehöhen werden in **DHHN2016 / NHN** geführt und im UI als `m ü. NHN` bzw. „Meter über Meereshöhe“ dargestellt.
- Die WGS84-Ellipsoidhöhe bleibt ausschließlich die mathematische Höhenreferenz für die geodätische Koordinatentransformation.
- NHN und WGS84-Ellipsoidhöhe dürfen nicht gleichgesetzt werden.

### Terrainquellen

Kanonischer Basiskatalog nach PR #68:

- **Earth / NRW:** GeoBasis NRW DGM1, 1-m-Geländemodell; Terrainhöhe DHHN2016/NHN
- **Moon:** globales LRO/LOLA LDEM ~118 m; deckt auch Shackleton/Südpol ab
- **Mars:** MGS/MOLA globales DEM ~463 m

GLD100 ist **nicht** die kanonische Mondbasis, weil es nur etwa 79°S bis 79°N abdeckt und damit Shackleton nicht erreicht.

### Terrain-/Build-Modell

Vorbereitet sind:

- `terrain_datasets`
- `terrain_tiles`
- Terrain-Provenienz und Auflösungsstatus an Builds/Entities
- Footprint-Sampling
- `min/max/mean` Terrainhöhe
- Relief
- maximale Neigung
- Fundamenthöhe
- serverautoritative Terrainauflösung

Gebäude dürfen nicht „dem Boden folgen“ oder sich verformen. Das Terrain ist eine 3D-Oberfläche; ein Gebäude bekommt eine definierte Fundament-/Planumsebene. Später können daraus Cut/Fill, Terrassierung, Fundamentkosten und Bauverbote abgeleitet werden.

### Gebäudehierarchie

Bestehende kanonische Erweiterungsstruktur beibehalten:

- `tile_entities.parent_id + slot`
- `player_builds.parent_id + slot`

Keine parallele zweite Parent-/Slot-Hierarchie (`parent_entity_id`, `slot_key` o. ä.) einführen.

## Bereits vorhandene relevante Dateien

- `app/dashboard/spatial-build-test/page.tsx`
- `app/api/game/build/spatial/route.ts`
- `app/api/game/spatial/coordinate/route.ts`
- `lib/game/spatial/types.ts`
- `lib/game/spatial/planetary.ts`
- `lib/game/spatial/terrain.ts`
- `lib/game/spatial/geometry.ts`
- `lib/game/spatial/footprints.ts`
- `supabase/migrations/20260905063200_spatial_build_model.sql`
- `supabase/migrations/20260905082000_planetary_terrain_phase1.sql`
- `supabase/migrations/20260905082500_earth_spatial_reconciliation.sql`
- `supabase/migrations/20260905084000_moon_lola_global_terrain_source.sql`
- `supabase/migrations/20260905121500_earth_nhn_height_reference.sql`

## Bereits vorhandene Karteninteraktion

Der Spatial-Build-Tester besitzt bereits:

- Maus-Rad-Zoom auf Cursorposition
- Drag/Pan
- `+ / − / Reset`
- korrekte Rückrechnung Bildschirmposition → lokale Meterkoordinate
- Drag-vs-Klick-Trennung

Diese Interaktion soll nicht wieder durch normalen DOM-Scroll als primäre Kartenbewegung ersetzt werden.

## Nächste Arbeitsblöcke

### 1. Verifizierte Georeferenz für Testgebiete

- `Tharsis Hub Sauerland` erhält erst dann `origin_lat/lon/alt`, wenn ein realer, bewusst gewählter Standort feststeht.
- Keine Koordinaten erfinden.
- Earth-Origin muss sowohl NHN-Terrainhöhe als auch für ENU mathematisch nötige Ellipsoidbeziehung korrekt behandeln.
- Entsprechende Origins für Moon/Shackleton und Mars ebenfalls explizit/provenienzgesichert festlegen.

### 2. Echte Terrain-Ingestion

- DGM1-/LOLA-/MOLA-Raster herunterladen/normalisieren bzw. on-demand bereitstellen.
- Rasterbytes nicht als relationale Einzelhöhen speichern; `terrain_tiles` bleibt Metadaten-/Indexschicht.
- Tile-Cache/Storage und Checksums etablieren.
- NoData, Datumsbezug und Quellenprovenienz erhalten.

### 3. Terrain-Sampling-Service

Implementiere serverseitig bzw. serverautoritative Adapter für:

- `sampleTerrainHeight(x,y)`
- `sampleTerrainFootprint(...)`
- Geländeneigung
- Relief
- Fundament-/Planumshöhe
- optional Cut/Fill-Abschätzung

Bau-API darf erst bei aufgelöstem Terrain ein physisch belastbares `z_m` vergeben.

### 4. Kartenrenderer

Empfohlene Reihenfolge:

1. georeferenzierte 2D-Basiskarte
2. Hillshade/Höhenlinien
3. Gelände-Raster im aktuellen Pan-/Zoom-Viewport
4. optional neigbare/perspektivische Terrainansicht
5. echte 3D-Terrain-Meshes/LOD erst danach

Renderer muss unabhängig von Earth/Moon/Mars-Datenquelle bleiben.

### 5. Terrainbewusstes Gameplay

Später aus realem Relief ableiten:

- direkt bebaubar
- Fundament nötig
- Terrassierung nötig
- zu steil / nicht bebaubar
- Erdbewegungsmenge
- Fundament-/Baukosten
- Straßen-/Transportsteigungen

## Harte Invarianten / nicht wieder öffnen

1. Kein global autoritatives 32×24-Grid mehr.
2. Keine erfundenen Meterkoordinaten aus Legacy-Tiles.
3. Keine flache Weltannahme (`z=0`) als Fallback.
4. Kein clientautoritativer Terrain-Z-Wert.
5. NHN-Terrainhöhe auf Erde nicht mit WGS84-Ellipsoidhöhe verwechseln.
6. Keine zweite Gebäudeerweiterungs-Hierarchie neben `parent_id + slot`.
7. Reale Quellen und Provenienz vor Simulation/Fallback bevorzugen.
8. Moon/Shackleton muss poltaugliche Daten verwenden.

## Abnahmekriterien für den neuen Workstream

Der Workstream gilt als erfolgreich übernommen, wenn:

- ein neuer Tab dieses Request als Startkontext gelesen hat,
- die oben genannten Invarianten bestätigt sind,
- die erste echte DEM-Probe für ein verifiziertes Testgebiet reproduzierbar geladen und angezeigt wird,
- Earth-Höhen im UI in `m ü. NHN` erscheinen,
- Gebäude-Footprints echte Geländeunterschiede erkennen,
- Pan/Zoom/Platzierung nach Georeferenzierung weiterhin geometrisch korrekt funktionieren,
- Moon und Mars denselben Renderer-/Sampling-Vertrag benutzen können.

## Übergabepunkt

PR #68 (`feat(spatial): planetary 3D terrain foundation`) ist der technische Übergabepunkt. Neue Grid-/Map-/Terrain-Arbeit soll danach aus einem separaten Branch/PR-Workstream erfolgen, nicht als unstrukturierte Fortsetzung derselben Migration.
