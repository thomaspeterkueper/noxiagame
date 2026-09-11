# Vehicle Domain v1

Status: additive foundation; no persistence migration.

## Purpose

NOXIA needs one shared vehicle vocabulary for surface rovers, trucks, trains, aircraft, transfer shuttles and spacecraft without forcing them into one movement solver.

The shared domain owns engineering-facing vehicle semantics. World domains own traversal policy. Game Core owns authoritative mutable state and transport jobs.

## Source-of-truth boundary

### Shared vehicle / engineering domain

Owns:

- vehicle frame/type identity;
- operating domains and mobility modes;
- dry mass;
- cargo and crew capacities;
- energy-store specifications;
- environment compatibility;
- engineering mobility envelopes such as safe longitudinal slope;
- common living-instance vocabulary for condition, wear, energy, cargo, crew and modules.

### Earth / Moon / Mars / Orbit domains

Own:

- route geometry and route discovery;
- road/rail/terrain/orbit interpretation;
- local passability;
- relative traversal penalties;
- map/UI representation.

A world domain may consume engineering limits, but it must not redefine them as world-local vehicle physics.

### Game Core

Owns authoritative persistence and atomic mutation for:

- vehicle ownership and availability;
- inventory/cargo reservation;
- vehicle reservation;
- loading/unloading;
- transport-job lifecycle;
- scheduler/tick execution.

`lib/game/vehicles` does not introduce new tables or APIs.

## Why movement is not one solver

Shared operational semantics do not imply shared movement equations. Expected adapters/solvers include:

- wheeled/tracked surface movement;
- rail movement;
- atmospheric flight;
- surface↔orbit transfer;
- orbital manoeuvre;
- intersolar transfer.

They can all use the same vehicle identity, cargo, crew, energy, condition and maintenance vocabulary.

## Compatibility with current code

The current systems remain valid and are not refactored by v1:

- `explorationAssets.ts` keeps rover/drone provenance and instance state;
- `ships.ts` keeps modular spacecraft frames/loadouts/live module instances;
- `transportDomains.ts` keeps shuttle-vs-intersolar semantics;
- `logisticsNodes.ts` keeps physical surface/orbit handoff semantics;
- Earth surface logistics keeps OSM/terrain routing policy.

`vehicles/adapters.ts` exposes narrow read-only projections so these systems can migrate incrementally.

## Immediate consumer contract

Earth currently needs a safe slope envelope for `cargo-rover` / `heavy-hauler`. The shared vehicle frame now provides it through `surfaceMobility.safeLongitudinalSlopeDeg`; the Earth adapter passes that value through unchanged. Earth continues to apply its own road/offroad policy and multipliers.

## Deliberately deferred

The following require coordinated Core work and are not part of this foundation:

- vehicle database schema;
- `TransportJob` persistence/state machine;
- inventory reservation;
- vehicle reservation;
- absolute energy consumption and range calculation;
- wear accumulation and maintenance scheduling;
- train/vehicle assemblies;
- migration of current spacecraft persistence;
- migration of exploration-asset persistence.

These should be implemented against one shared Core contract rather than as Earth-, Moon-, Mars- or Orbit-specific persistence.
