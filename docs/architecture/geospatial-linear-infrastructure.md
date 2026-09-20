# Geospatial Linear Infrastructure

Status: architecture baseline, 2026-09-20

## Decision

NOXIA uses two different spatial construction models on purpose.

1. **Discrete colony grids** keep tile adjacency. A legacy road tile is valid there because a tile is simultaneously area, construction object and connection.
2. **Geospatial planetary surfaces** use metric world coordinates. Buildings occupy footprints; infrastructure connects nodes and ports through line geometry.

The grid road must therefore not be reused as a rectangular footprint building on Earth, Moon or Mars geospatial maps.

## Core rule

> Areas are placed. Connections are routed.

A building is a footprint/polygon. A road, railway, pipeline, cable or conveyor is an edge in a network graph. The connection between both is an explicit port/node.

## Shared model

The implementation contract lives in `lib/game/infrastructure/network.ts`.

- `InfrastructurePort`: attach point owned by a facility or other world entity.
- `InfrastructureNode`: graph vertex (junction, facility port, tie-in, terminal, waypoint).
- `InfrastructureEdge`: persistent polyline between two nodes.
- `InfrastructureNetworkType`: road, rail, pipeline, power, water, data, conveyor.

Edges carry source and status so imported/observed infrastructure and player-built infrastructure can coexist without conflation.

## Earth authority

Earth already derives a routable graph from observed OSM roads in `lib/game/earthSurfaceRouting.ts`. That observed graph remains authoritative for real-world streets; it is not copied into a second persisted road database merely for routing.

The future combined route graph is:

```text
observed OSM network
       +
NOXIA player-built persistent edges
       ↓
combined routable graph
       ↓
vehicles / cargo / people
```

A new player-built access road normally begins at a facility `InfrastructurePort` and terminates at a `network-tie-in` node snapped to an observed road, or at another player-built node.

## Building interaction

Geospatial construction must expose two distinct operations:

```text
BUILDING
choose site -> choose building -> rotate footprint -> validate footprint -> build

INFRASTRUCTURE
choose network type -> choose/start port -> route alignment -> choose/end port or tie-in
-> validate line/corridor -> quote length/earthworks/structures -> build
```

`road` remains in the legacy `BUILDINGS` catalog for colony-grid compatibility, but geospatial building pickers must treat it as a legacy linear buildable, not as a footprint building. `isLegacyGridLinearBuildable()` is the compatibility guard for that transition.

## Validation of a route

A route is validated along the corridor, not at one tile/site. The validator may progressively add:

- slope / grade along the alignment,
- terrain and soil suitability,
- water crossings,
- collisions with buildings,
- protected or excluded land,
- road/rail crossings,
- cut/fill earthworks,
- bridge demand,
- tunnel demand,
- minimum curve radius,
- network-class specific width and clearance.

The result should be a route quote, for example:

```text
274 m access road
218 m normal construction
 41 m cutting
 15 m bridge

technical status: feasible
cost: 8,720 Cr
build time: 7 ticks
```

Costs and build time are properties of the complete edge/corridor, not a fixed cost per visual tile.

## Planet reuse

The same core model is reused by all planetary surfaces:

- Earth starts with observed real-world networks and adds NOXIA edges.
- Moon starts mostly empty and grows from landing sites, habitats, mines and power systems.
- Mars starts from seeded/constructed colony infrastructure and later larger regional networks.

Only world-specific terrain validators and network classes differ. The graph, ports, persistence and route semantics remain shared.

## Migration order

1. Keep legacy grid behavior unchanged.
2. Filter legacy linear buildables (initially `road`) from geospatial footprint pickers.
3. Add an `Infrastructure / Strecke bauen` surface mode.
4. Add facility ports and OSM/player-built tie-ins.
5. Persist player-built nodes and edges.
6. Merge those edges with observed Earth routing.
7. Move cargo/vehicle traversal to the combined graph.
8. Extend the same core to rail, pipelines, power, water, data and conveyors.

This sequence preserves the currently playable Earth/building path while removing the architectural assumption that a road is a rectangular building.
