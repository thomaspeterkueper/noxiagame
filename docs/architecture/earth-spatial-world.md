# Earth Spatial World Architecture

Status: foundation / canonical direction

## Decision

NOXIA Earth is no longer modeled as a fixed 32×24 board. The fixed grid is legacy UI/prototype state only and must not define world extent, canonical geography, settlement growth or multiplayer capacity.

The canonical Earth model is geospatial, chunk-streamed and temporal. Real Earth geography is the reference. The first playable region may cover only a small real area, but its coordinates belong to the same global Earth frame and can expand without changing identifiers or rebasing player property.

## Goals

1. Practically unbounded multiplayer surface.
2. Real geography as the baseline: elevation, water, coastlines, land cover, settlements and transport corridors are spatial layers, not decorative tiles.
3. One world geometry for 2D map, isometric/walkable scenes, scanner and simulation.
4. Expandable building complexes can occupy multiple parcels and cross old grid boundaries.
5. Temporal validity is first-class so the same Earth infrastructure can later represent 2045, 2098, antiquity or another historical epoch.
6. Rendering is not Source of Truth. No UI-specific tile array is canonical.

## Coordinate hierarchy

Canonical position uses latitude/longitude (WGS84-like geodetic coordinates) plus optional elevation. Simulation regions define a local metric projection around a geographic anchor. Local metre coordinates are then divided into streamable chunks.

Initial defaults:

- chunk edge: 1,000 m
- simulation cell: 10 m
- 100×100 cells per loaded chunk

Cells are an implementation detail for placement/collision. A building or road may use arbitrary geometry and is not required to fit a single cell.

Negative chunk coordinates are valid. There is no outer world boundary.

## Spatial layers

Earth must distinguish at least:

- physical: elevation, slope, water, rivers, coastlines
- ecological: land cover, forest, wetland, agricultural land
- human geography: settlement footprints, roads, rail, bridges, ports, utilities
- parcels/rights: ownership, lease, public land, easements
- simulation entities: buildings, facilities, vehicles, agents
- derived gameplay layers: land value, access, utility coverage, scanner interpretations

The game may simplify source data for performance, but simplification creates derived geometry; it must not replace canonical provenance.

## Temporal model

Every mutable spatial feature can have `valid_from` and `valid_to`. This allows the same coordinate to have different roads, settlements, vegetation, shorelines and structures at different epochs.

A future NOXIA Earth and a historical Earth therefore share the spatial substrate while selecting different temporal layers.

Examples:

- a modern motorway may not exist in 1700;
- a Roman road may exist as an archaeological/historical layer but not as a modern transport link;
- city footprints can grow through time;
- coastlines and river courses can change;
- a player-built 2098 complex is simply another time-bounded spatial feature.

## Real-world source strategy

The architecture must permit ingestion of external datasets such as open street/transport data, public elevation models and land-cover/hydrography datasets. Providers and licenses are recorded per imported feature/layer. Dataset choice is intentionally separate from the world model so sources can be replaced without changing game identifiers.

No imported source may silently become gameplay truth without a normalization/import step.

## Initial playable region

Do not create a fictional rectangular Earth colony map. Define one real geographic anchor region and stream the required chunks around it. Public NOXIA start infrastructure is added as simulation entities on top of the real base geography.

The initial region should be large enough for several settlements and expansion corridors, while only nearby chunks need to be loaded. Expansion means loading/claiming adjacent real-world space, not increasing an array size.

## Buildings and complexes

Buildings use spatial footprints. Complexes are relations between building instances and shared infrastructure; they can grow by adding modules, parcels and connections. A complex may span multiple chunks.

Therefore:

- no `row < 24` / `col < 32` invariant may exist in new domain code;
- no building ID is tied to a tile coordinate;
- roads are linear spatial entities, not terrain paint;
- public infrastructure and player-owned construction remain separate entities;
- ownership/occupation is independent of geometry.

## Rendering contract

2D is the default management view. Isometric/walkable views are optional projections of the same loaded spatial state.

A renderer requests a viewport/bounding area and receives visible spatial entities/layers. It must not request the entire Earth.

Zoom levels may aggregate geometry:

- regional: settlements/corridors
- local: parcels/roads/buildings
- close: building modules/agents

## Migration from legacy grid

`lib/grid/locationMaps.ts` and the 32×24 Earth layout are legacy compatibility assets. They may remain temporarily for locations that have not migrated, but Earth vNext must not read them as canonical geography.

Migration order:

1. Introduce geodetic/chunk domain model.
2. Add spatial persistence.
3. Define first real Earth region anchor and importer/seed.
4. Reset old Earth simulation entities as approved.
5. Render the new 2D spatial viewport.
6. Adapt building placement and expandable complexes.
7. Adapt scanner and walkable/isometric projections.
8. Remove Earth dependency on fixed `LOCATION_MAPS`.

## Source of Truth

NOXIA owns gameplay spatial state, player property, simulation entities and temporal gameplay changes. External geography datasets provide evidence/input and remain identified by provenance. Other repositories must not become hidden authorities for NOXIA runtime world state.
