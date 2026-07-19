# ADR: Terrain vs. Entity — Bebaubarkeit und Sichtbarkeit

**Datum:** 19.07.2026
**Status:** Accepted

## Kontext

`tile_habitat` und `tile_industry` sind Terrain-Typen die aus `getFixedTerrain()`
kommen — sie sind procedurale Hintergrundgrafiken, keine DB-Entities.
Sie sehen visuell aus wie Gebäude, haben aber keine `tile_entities`-Zeile.

Das führte dazu dass:
1. `entityAt()` für diese Tiles `undefined` zurückgab
2. `isBuildable()` `true` zurückgab (waren fälschlicherweise bebaubar)
3. Das BuildPopup öffnete sich auf belegtem Terrain

## Entscheidung

### Terrain-Ebene (generateGrid)
- `tile_habitat`, `tile_industry` → **NICHT bebaubar** (aus `isBuildable` entfernt)
- Sie sind Hintergrundgrafiken die den Charakter einer Kolonie zeigen
- Terrain wird durch echte DB-Entities **überschrieben** (Zeile 196 in generateGrid)

### Entity-Ebene (tile_entities in DB)
- Echte Gebäude haben immer eine DB-Zeile mit `tile_row`, `tile_col`
- `owner_class`: PLAYER | STATE | CORPORATION | NPC
- STATE-Gebäude (admin, bank, shipyard etc.) überschreiben Terrain-Tiles

### Ressourcen-Tiles
- `tile_ice`, `tile_metal`, `tile_helium3`, `tile_titanium`, `tile_shaft` → bebaubar
- Spieler kann dort Minen/Bohrungen bauen
- Deposit-System (RESOURCE-0001) für detaillierte Ressourcendaten: ausstehend

### Sichtbarkeit von Tile-Ressourcen
- **Alpha:** Terrain-Typ in Sidebar sichtbar (z.B. "Eis-Vorkommen")
- **Mit Scanner-Gebäude:** Anomalie-Highlight (bereits implementiert)
- **Mit SENSOR:SPECTRAL Unlock:** Detaillierte Deposit-Daten (zukünftig, NOX-0001)

## Konsequenzen

- `tile_habitat` / `tile_industry` zeigen Charakter der Kolonie aber sind leer
- Spieler baut auf freien bebaubaren Tiles (surface, grass, ice etc.)
- Echte STATE-Gebäude aus DB überschreiben Terrain und blockieren Bebauung korrekt
- `generateGrid` prüft `owner_class` statt veraltetes `is_state_owned`

## Test-Prädikat

> Klick auf `tile_habitat` → kein BuildPopup, nur Terrain-Info in Sidebar
> Klick auf `building_admin` (STATE) → Info "Staatliches Gebäude — nicht bebaubar"
> Klick auf freie `tile_surface` → BuildPopup mit Bauoptionen
