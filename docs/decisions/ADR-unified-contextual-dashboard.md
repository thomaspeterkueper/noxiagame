# ADR: Unified contextual dashboard and capability-driven UI

Status: accepted  
Date: 2026-10-01

## Decision

noχ¹ᐃ has **one interaction language and one dashboard shell** across worlds, colonies, vehicles and spacecraft.

Earth, Moon, Mars, Phobos, Deimos, stations, later planets and other locations must not receive independent dashboard look-and-feel variants merely because their physical environment differs. The same rule applies to rover, vehicle and spacecraft dashboards.

Differences belong to the simulated object and environment, not to a separately invented UI shell.

## Core rule

> Different world, same interface. Different capabilities, different visible modules.

A context reports which capabilities are currently available. The shared UI renders the corresponding standard modules and omits unavailable modules completely.

Examples of capabilities include:

- navigation
- construction
- science
- robotics
- surface logistics
- mining / prospecting
- warehouse / cargo
- market / trade
- maintenance
- shipyard
- crew / inhabitants
- vehicle control
- flight / orbital operations

Robotik is therefore not a Phobos UI. Science is not a Moon or Phobos UI. A capability may exist in many places and on many machines; the content, assets, data and permitted actions vary by context while the interaction pattern remains shared.

## What stays identical

Where applicable, shared shell/components own:

- top bar and global identity
- bottom cockpit / primary navigation
- typography, spacing and interaction states
- map/surface controls and layer controls
- tooltips and inspectors
- ownership/status color semantics
- drawers, overlays and workflow shells
- loading/error/empty states
- responsive behavior
- keyboard/pointer interaction conventions
- capability-module visual language

A body-specific or vehicle-specific component may provide data, commands or a renderer adapter. It must not fork the surrounding UI language without an explicit new ADR.

## What may differ by context

The world/object itself supplies the differentiation:

- terrain, atmosphere, sky, light and environmental effects
- buildings and settlement geometry
- roads, pressure tubes, corridors, tether links, rails and other infrastructure
- vehicles, robots, spacecraft and local assets
- local scientific observations and resources
- local hazards and engineering constraints
- available capabilities and actions
- data density appropriate to the object

Thus Earth may show roads and forests, the Moon pressure corridors, Mars larger industrial clusters and Phobos tethered modules, all inside the same dashboard shell.

## Capability-driven visibility

Unavailable functionality is **not shown as a bespoke disabled panel** merely to preserve a location-specific layout.

Preferred rule:

```text
shared dashboard shell
        ↓
context capability set
        ↓
render only available shared modules
        ↓
module reads context-specific data/actions/assets
```

Examples:

```text
Phobos: robotics + science + logistics + navigation
Moon:   science + logistics + mining + robotics + navigation
Earth:  trade + logistics + robotics + construction + navigation
```

The exact sets are runtime/domain data, not hard-coded visual themes.

## Surface/world dashboards

`PlanetarySurfaceMap` and the dashboard host are shared infrastructure. Body-specific code should normally provide:

- terrain/body configuration
- world entities
- settlement layout
- infrastructure types
- local mobile/science objects
- capability availability

It should not recreate top bars, tooltips, inspectors, generic ownership frames, map controls or standard capability panels.

## Vehicles and spacecraft

The same principle is mandatory for vehicle and spacecraft dashboards.

A rover, train, aircraft, shuttle and interplanetary spacecraft may expose different systems, but they should compose them from the same NOXIA dashboard vocabulary.

Examples:

- a rover may expose navigation, energy, cargo, robotics and maintenance;
- a shuttle may add flight, docking and crew;
- a large spacecraft may add life support, orbital operations, engineering and science.

The dashboard adapts by capability composition, not by creating a new aesthetic for every vehicle class.

Vehicle type may affect instrument content, schematic/viewport imagery and available controls; it must not arbitrarily change global interaction conventions.

## Implementation consequences

1. Prefer shared semantic modules over `DashboardMoonX`, `DashboardPhobosX`, `MarsXPanel`, etc. when the underlying function is generic.
2. Existing body-specific components are migration bridges. Extract generic capability modules when they are touched or reused elsewhere.
3. Context-specific wrappers should become thin adapters/configuration layers.
4. Ownership colors, tooltips, selection behavior and common inspectors belong in shared renderers/components.
5. New functionality must first answer: **Is this truly unique physics/domain behavior, or merely a capability that can exist elsewhere?** If the latter, implement it generically.
6. A missing capability hides the module; it does not justify another dashboard shell.
7. Visual differentiation should come from world/object content and simulation state before adding UI theming.

## Exceptions

A specialized interface is allowed only when the interaction model itself is fundamentally different, for example a dedicated scientific instrument that cannot sensibly use an existing generic module. Even then it opens inside the common NOXIA shell/overlay conventions unless another ADR explicitly changes that rule.

## Related documents

- `docs/architecture/map-first-dashboard.md`
- `docs/architecture/vehicle-domain-v1.md`
- `docs/NOXIA-VISUAL-BIBLE.md`
- `docs/decisions/ADR-single-world-surface.md`
