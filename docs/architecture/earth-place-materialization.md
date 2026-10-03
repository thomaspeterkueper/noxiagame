# Earth place materialization

Status: accepted architecture, implementation started 2026-10-03.

## Principle

Earth places in NOXIA are persistent, simplified representations of real places.
They are not procedurally invented replacement cities.

A searched place is anchored by its real WGS84 centre. Real roads, rail, water,
land use, terrain and selected landmarks are imported from observed sources,
then generalized for gameplay and rendering. Future NOXIA content and narrative
content are separate enrichment layers.

## Runtime rule

**The renderer must never depend on a live Overpass request.**

When a player selects a previously unknown place:

1. Geocoding resolves the real place and centre.
2. NOXIA assigns a stable `earth-place-*` identity.
3. The map can render immediately from the real centre and bounds, even with no
   enriched features yet.
4. An authenticated materialization request imports and normalizes real
   geography once.
5. The result is stored in `celestial_regions` and `region_features`.
6. Later visits read the persistent NOXIA representation.

A failed external source therefore degrades detail; it must not make the place
unusable or trap the player.

## Normalization is not invention

Normalization may:

- simplify polygon/line geometry;
- omit low-value detail at a given LOD;
- aggregate dense ordinary buildings into urban morphology;
- retain only roads appropriate to the current LOD;
- attach deterministic rendering metadata.

Normalization must not silently:

- move rivers, railways or roads to fictional positions;
- invent terrain;
- replace a real city layout with a generic generated city;
- mix fictional book canon into observed geography.

## Initial import profile

The first implementation intentionally excludes blanket `[building]` imports
for dense cities. It preserves the real large-scale morphology through:

- motorway, trunk, primary, secondary and tertiary roads;
- rail/light rail/tram;
- rivers, canals and water polygons;
- forest/wood;
- farmland, meadow, orchard, grass;
- residential/commercial/retail areas;
- industrial areas;
- settlement/suburb reference points.

Individual significant real buildings and POIs are a later landmark enrichment
layer rather than part of the dense base import.

## Provenance

Imported `region_features.properties` retain observed OSM tags and add:

- `noxia_source`
- `noxia_source_id`
- `noxia_provenance`
- `visual_seed`
- `visual_class`

Observed geography, derived NOXIA data and narrative/book canon remain distinct.

## Visual LOD

Rendering is shared across Earth places:

- `city_overview`: generalized fills and major transport;
- `district`: deterministic land-use patterns become visible;
- `surface_local`: richer patterns and local operational detail.

Forest, meadow, farmland and orchard graphics are renderer concerns. Geometry
and semantic class remain source data; deterministic visual seeds allow styles
to evolve without re-importing geography.

A tree becomes a persistent world object only when gameplay requires that
specific tree. A forest normally remains a land-use polygon.

## Narrative enrichment

Book and story locations are a separate overlay linked to the geographic place.
A narrative landmark records at least:

- work/book identity;
- optional chapter/scene reference;
- canon status;
- mapping precision: `real_location`, `approximate`, or `fictionalized`.

Narrative landmarks may override presentation for a curated location, but do
not rewrite the observed geography beneath them.

## Dynamic Earth anchors

Static bootstrap anchors such as Sauerland and Erongo remain useful, but they do
not define the extent of Earth. Materialized places become dynamic local metric
anchors while canonical persisted positions remain WGS84 latitude/longitude.
