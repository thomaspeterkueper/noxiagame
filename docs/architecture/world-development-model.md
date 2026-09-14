# NOXIA World Development Model

Status: architecture foundation for the shared 2045–2125 macro-development layer.

This document implements `ADR-world-development-macro-system.md` and must be read together with `docs/core/CORE_CONTRACT.md` and `ADR-state-runtime-boundaries.md`.

## Architectural position

World Development is a **derived planning/projection domain** between authoritative runtime state and higher-level decisions.

```text
Authoritative Core/domain state
  |-- inventories / resources
  |-- production / buildings
  |-- market / finance
  |-- transport / docking / routes
  |-- population / assignments
  |-- knowledge / research
  |-- time / events
  |-- terrain / hazards
  v
explicit macro observations
  v
World Development projection
  |-- capacities
  |-- pressures
  |-- bottlenecks
  |-- strengths
  v
player / NPC / planner decisions
  v
existing authoritative Core/domain commands
  v
new authoritative runtime state
```

The projection is not allowed to close this loop by mutating the database directly.

## Domain model

The six stable macro domains are:

| Domain | Examples |
| --- | --- |
| Knowledge & Technology | AI, compute, research, biotechnology |
| Energy & Industry | grids, firm energy, fusion, industrial depth, maintenance, circularity, critical materials |
| Economy & Logistics | surface logistics, orbital logistics, ISRU, closed-loop life support |
| Population & Society | skills, demographics, social cohesion, food security |
| Climate & Biosphere | water security, climate stress |
| Governance & Institutions | institutional capacity, cyber resilience, information trust, resource law |

The initial typed registry lives in `lib/game/worldDevelopment.ts`.

## Signal semantics

A `WorldDevelopmentSignal` is an observation, not an entitlement.

```ts
interface WorldDevelopmentSignal {
  driverId: WorldDevelopmentDriverId
  value: number
  sourceRef: string
}
```

Rules:

1. `value` is normalized to 0..1 by the projection layer.
2. `sourceRef` is mandatory and identifies the input authority or scenario source.
3. duplicate driver inputs fail closed.
4. a capacity value near 1 means strong available capacity.
5. a pressure value near 1 means strong adverse pressure.
6. classification is deterministic and presentation/planning oriented.
7. classification by itself never grants an unlock or changes a runtime object.

## Why capacity and pressure are separate

A single generic `developmentLevel` would erase causality.

For example, low water security and high climate stress are not interchangeable with low research capability. They can all create a bottleneck, but they require different physical responses.

The projection therefore preserves the original driver and domain so later planners can decide between materially different actions.

## Phase semantics

`NOXIA_BASELINE_PHASES` currently defines four historical/scenario envelopes:

- 2045–2059: Electrification & autonomy
- 2060–2079: Off-world industrial bootstrap
- 2080–2099: Earth–Moon industrial system
- 2100–2125: Solar-system logistics

These phases are **labels for scenario context**, not automatic unlock dates.

A 2065 player may have weak lunar ISRU. A 2095 world may still suffer severe grid bottlenecks. The year cannot manufacture capability.

## Source adapters

Future source adapters should be small, read-only functions that translate existing state into explicit signals.

Examples:

### Grid capacity

Potential source inputs:

- available generation;
- dispatchable/firm capacity;
- storage;
- transmission bottlenecks;
- local load and curtailment.

The adapter may derive `grid_capacity`, but it must not create energy inventory or alter production.

### Water security

Potential source inputs:

- water inventories;
- extraction/production;
- recycling;
- consumption;
- local environmental availability;
- transport dependency.

The adapter may derive `water_security`, but water itself remains authoritative in the existing resource/inventory model.

### Orbital logistics

Potential source inputs:

- operational launch sites;
- docking capacity;
- depots;
- ship/vehicle availability;
- transfer throughput;
- route reachability;
- maintenance/yard capability.

The adapter may derive `orbital_logistics`, while ships, cargo and transit remain authoritative in their current systems.

### Climate stress

Potential source inputs:

- explicit Earth hazard layers;
- heat/drought/flood/fire exposure;
- local infrastructure adaptation;
- water and land-use stress.

The adapter may derive `climate_stress`, while terrain/buildability/land-value consumers own their own authoritative decisions.

## Consumer contract

A consumer may use World Development in one of three ways.

### 1. Read-only UI

Show why a location, economy or settlement is constrained.

Safe immediately.

### 2. Decision support

NPC or player planning may rank actions using bottlenecks/strengths.

Example:

```text
grid_capacity constrained
+ industrial_depth strong
+ critical_material_security strong
-> planner favors grid/storage construction
```

The resulting build still uses the normal build path and pays real costs.

### 3. Explicit domain prerequisite

A domain may later require a macro condition for a specific action, but only when the requirement is physically justified and enforced at the existing authoritative command boundary.

Example:

- a large orbital yard may require a minimum servicing/logistics capability;
- a high-throughput ISRU plant may require specific firm-energy and maintenance capacity.

The World Development projection does not itself authorize either action.

## No universal multiplier rule

World Development must not become a generic modifier engine.

Rejected pattern:

```text
ai_automation = 0.8
=> all production * 1.20
```

Preferred pattern:

```text
high automation
+ enough compute
+ enough firm energy
+ enough maintenance
+ suitable facility capability
=> specific production domain may safely operate with lower staffing / higher throughput
```

Any throughput effect belongs in the production consumer and must state its causal inputs.

## Space-economy progression

NOXIA's long-term space economy should emerge from physical logistics:

```text
Earth surface
  -> launch infrastructure
  -> LEO/orbital nodes
  -> cislunar nodes
  -> Moon extraction/processing
  -> depots/servicing
  -> Mars/Phobos/Deimos
  -> near-Earth asteroids
  -> Lagrange logistics
  -> main-belt specialization
```

This progression reuses shared Core abstractions for inventory, custody, transport, ownership, building and time. World-specific domains continue to own geodesy, terrain and route assessment.

## Population integration

World Development does not reduce population to a labor scalar.

Longer term, the population system should be able to expose inputs such as:

- available skills and redundancy;
- dependency burden;
- household/crew stability;
- food and health security;
- migration pressure;
- settlement attractiveness.

Those remain population truths. World Development only creates higher-level planning signals from them.

## Climate integration

Earth climate is a dynamic world condition, not a single canonical 2100 number.

A future Earth scenario may expose trajectories, but the runtime effect should resolve locally through concrete layers such as:

- heat exposure;
- water stress;
- flood/fire/drought hazard;
- agricultural productivity;
- infrastructure adaptation cost;
- insurance/finance constraints where modeled.

The same global trajectory can therefore produce different local outcomes.

## Persistence rule

Do **not** create a `world_development_state` table merely because the projection exists.

Persistence is justified only when:

1. a concrete gameplay consumer requires a state that cannot be reproduced from existing truth plus explicit scenario inputs; or
2. historical evolution itself becomes gameplay-relevant and must survive replay/audit.

If persistence becomes necessary, it must integrate with the Core time/event/replay model rather than introducing its own clock.

## Initial implementation

The first slice intentionally contains only:

- the six macro-domain definitions;
- a typed driver registry;
- scenario phase labels for 2045–2125;
- deterministic signal classification;
- explicit provenance requirements;
- tests for phase boundaries, normalization, bottlenecks and fail-closed behavior.

It contains no DB migration and no runtime mutation.

## Next implementation slices

The next safe consumers are:

1. read-only Earth/colony bottleneck presentation;
2. read-only adapters for grid/energy, water and orbital-logistics signals;
3. NPC decision support using the same projections;
4. only then selected command-level prerequisites/effects where a physical causal chain is demonstrated.

This order keeps the model inspectable before it gains authority.
