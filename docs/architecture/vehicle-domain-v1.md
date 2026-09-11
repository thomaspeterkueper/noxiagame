# Vehicle Domain v1

Status: shared vocabulary plus authoritative Core persistence implemented.

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

The shared vocabulary in `lib/game/vehicles` remains persistence-agnostic. Core binds that vocabulary to the authoritative runtime through `vehicle_instances`, the shared logistics inventory model and the transport-job state machine.

## Implemented Core persistence

`supabase/migrations/20260911063018_vehicle_instance_core.sql` adds the generic living vehicle instance. It deliberately does not create Moon-, Earth-, Mars- or Orbit-specific vehicle tables.

Each persisted vehicle can carry:

- stable frame identity and optional canonical key;
- owner and current game location;
- current logistics node while parked;
- operational status;
- condition and wear;
- cargo capacity;
- energy-store state;
- crew, modules, modifications and emergent state.

A vehicle receives a linked `logistics_inventories` cargo inventory. Transport-job triggers keep the vehicle state synchronized with the shared lifecycle:

```text
ready
→ reserved
→ loading / in_transit
→ unloading
→ ready
```

Cancellation returns the vehicle to the source node. Completion places it at the destination node. The active vehicle uniqueness constraint in the transport Core prevents incompatible double assignment.

Core access is exposed server-side through:

- `lib/game/core/vehicleInstances.ts`;
- `GET /api/game/vehicles` for player-owned living vehicle state;
- `GET /api/game/vehicles?vehicleId=…` for the vehicle plus cargo inventory and active transport job;
- `POST /api/game/logistics` for cargo handovers and transport-job commands;
- the existing minute transit scheduler, which also settles due transport jobs.

Vehicle creation remains a server-side command. There is intentionally no public free-spawn endpoint: purchase, construction, mission reward or other gameplay systems decide when a concrete vehicle instance may exist.

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

The current systems remain valid and are not force-migrated by v1:

- `explorationAssets.ts` keeps rover/drone provenance and current instance state;
- `ships.ts` keeps modular spacecraft frames/loadouts/live module instances;
- `transportDomains.ts` keeps shuttle-vs-intersolar semantics;
- `logisticsNodes.ts` keeps physical surface/orbit handoff semantics;
- Earth surface logistics keeps OSM/terrain routing policy.

`vehicles/adapters.ts` exposes narrow read-only projections so these systems can migrate incrementally. Existing ships are already addressable through the shared logistics inventory adapter without requiring an immediate spacecraft-persistence rewrite.

## Immediate consumer contract

World routing supplies an assessed route; Core never derives world-specific terrain physics. For a surface transport the shared transport contract expects at least a passability result and, before start, a finite `routeSnapshot.etaSeconds`. Additional route facts such as distance, slope summary, energy multiplier, wear multiplier or route revision remain world-domain outputs and may be persisted in the snapshot.

Engineering supplies the absolute vehicle envelope. For `cargo-rover` and `heavy-hauler` this includes cargo capacity and mobility limits such as `surfaceMobility.safeLongitudinalSlopeDeg`. Moon/Earth/Mars may use those limits but must not silently replace them with local constants.

## Still deferred

The following are intentionally not invented by Core and require their owning domain or a later coordinated migration:

- canonical engineering data for concrete vehicle frames, including absolute energy/range models;
- wear accumulation and maintenance scheduling rules;
- train/vehicle assemblies;
- migration of current spacecraft persistence into `vehicle_instances`;
- migration of exploration-asset persistence into `vehicle_instances`;
- route-progress geometry used to draw a moving vehicle between nodes.

The persistence and atomic transport primitives are now shared. Remaining work should extend these primitives rather than introduce Earth-, Moon-, Mars- or Orbit-specific vehicle state stores.
