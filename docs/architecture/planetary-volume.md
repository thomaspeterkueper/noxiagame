# Planetary volume architecture

Status: accepted architecture decision

## Decision

NOXIA treats a world map as a view onto a three-dimensional planetary body. The rendered surface is only the upper boundary of that body.

Earth, Moon, Mars and future bodies share one planetary spatial stack. Body-specific reference systems, terrain datasets, geology and gameplay rules are adapters/configuration, not separate map engines.

## Existing shared foundation

The existing `lib/game/spatial/planetary.ts` implementation remains the geodetic authority for:

- planetary reference bodies;
- planetographic/planetocentric coordinates;
- datum elevation;
- cartesian conversion;
- local ENU frames;
- local-world conversion.

No lunar-only global cartesian `z` convention may be introduced for depth.

## Vertical semantics

Two vertical quantities must never be conflated:

1. **datum elevation** — `PlanetaryCoordinate.elevationM`, measured against the configured planetary vertical datum;
2. **depth below local physical surface** — `SurfaceRelativePoint.depthBelowSurfaceM`, measured inward from the terrain surface at the same latitude/longitude.

Conversion is:

```text
datum elevation = surface datum elevation - depth below surface
```

The local vertical follows the planetary reference body. For long tunnels, mines or lava tubes, curvature is therefore represented by successive planetary positions instead of assuming one flat global z plane.

## Spatial layers

The common world model is conceptually divided into:

```text
PlanetaryWorld
├─ SurfaceModel
├─ SubsurfaceModel
├─ GeologyModel
└─ Infrastructure3D
```

The UI may present these as surface, shallow-subsurface and deep-subsurface views, but those are views of one spatial model rather than independent maps.

Default gameplay classification currently uses 500 m as the shallow/deep boundary. This is a presentation/gameplay default, not a geophysical constant, and can be configured per feature or body.

## Volumetric features

`GeologicalVolumeEstimate` is the minimum common contract for volumetric features such as:

- regolith units;
- water-ice lenses;
- ore/resource bodies;
- lava tubes and natural voids;
- excavations;
- tunnels and shafts;
- subsurface habitats;
- drilling targets.

Features carry a depth interval and an epistemic confidence state (`hypothesized`, `inferred`, `measured`, `confirmed`). Detailed footprint/mesh/voxel geometry is intentionally left open for later extension.

## Gameplay consequence

Subsurface knowledge is allowed to improve over time. Orbital remote sensing can create a hypothesis, radar/seismic surveys can infer geometry, and drilling can confirm material and depth. The world therefore distinguishes a resource body's existence from the player's knowledge of it.

## Moon

The Moon is the first demanding consumer of this architecture. LOLA/LRO terrain and Shackleton-region ingestion continue to use the existing planetary terrain pipeline. Future lunar geology, resource and base systems must attach to the shared volume model rather than create a second lunar spatial engine.

## Earth compatibility

This decision is additive. Existing Earth placement/buildability remains authoritative and must not regress. The same depth model can later support terrestrial mines, foundations, tunnels, geothermal infrastructure and underground transport.

## Source-of-truth boundary

NOXIA owns simulation/rendering/runtime spatial behavior. Cross-project canonical scientific entities, taxonomies or shared knowledge structures must not be invented here when they belong to the KUEPER Knowledge Graph; those changes require an external task in the responsible repository.
