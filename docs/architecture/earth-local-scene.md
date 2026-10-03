# Earth local scene architecture

Status: accepted and implementation started 2026-10-03.

## Goal

The Earth walkable view is not a map with player markers. It is a local,
immersive 2.5D simulation scene derived from the same persistent geography as
the strategic Earth map.

The physical place must remain identical across views.

## View layers

1. **World / regional map** — navigation, planning, geographic overview.
2. **Local scene** — walking, NPCs, vehicles, trains, buildings, streets,
   paths, water and local interaction.
3. **Interior** — building-specific interaction.

Changing view changes presentation and simulation detail, never location.

## Local scene chunks

Earth local scenes use metre-based chunks around the current WGS84 anchor.
The first implementation renders roughly a 520 m diameter area (260 m radius)
around the current place centre.

The scene is derived from persisted region features, not from live Overpass.

Derived scene primitives include:

- road paths and a road route graph;
- rail paths and a rail route graph;
- water and waterway geometry;
- forest, vegetation and farmland polygons;
- urban surface polygons;
- building instances;
- NPC spawn / activity positions;
- later: vehicle routes, transit stops and interaction nodes.

## Buildings and provenance

Observed building footprints may become canonical local-scene buildings.

Where a materialized region does not yet contain individual building
footprints, the renderer may create deterministic **derived urban massing**
from observed urban polygons. These masses are visual placeholders only:

- they are not persisted as real buildings;
- they are explicitly marked `provenance=derived`;
- they cannot overwrite player or canonical NOXIA buildings;
- they should be replaced incrementally when observed footprints are enriched.

## Mobility

Road and rail geometry is retained as route graphs from the first local-scene
version. Future cars, buses and trains should follow those graphs rather than
free-moving visual paths.

Pedestrians and NPC routines use the same local metre coordinate system.

## Renderer evolution

The local-scene model is renderer-independent. The current web implementation
uses a lightweight SVG 2.5D projection as an intermediate renderer.

A later Pixi/WebGL, Unity or Unreal renderer should consume the same scene
contract rather than redefining Earth geography.

## Invariant

> Map, local scene and future 3D engine are different views of the same
> persistent physical world.