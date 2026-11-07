# NOXIA-MOBILITY-0001 — Layered world and passenger mobility preflight

Status: proposal; no runtime or schema changes. Scope: Seelenberg/Brombach pilot.

## Existing ownership and boundaries
- Earth surface cargo transport already has authenticated readiness/start routes and atomic Core transport jobs. **Do not** reuse a cargo job as proof of passenger boarding.
- Passenger journeys and transit cron already exist. Reuse their canonical journey IDs, authorisation and lifecycle after checking their contracts.
- Physical world state is persisted by the authoritative Core; renderers and real-world map imports are not sources of truth after initial import.
- No automatic travel, vehicle ownership, fares or location changes in this decision.

## Proposed first vertical slice: a scheduled bus journey
1. Define two canonical, persistent stop IDs in the Seelenberg/Brombach pilot; confirm route connectivity and walking access from the existing world model.
2. Publish a read-only service timetable with version, service ID, ordered stops, departure/arrival time and vehicle capacity.
3. A player or NPC requests boarding with authenticated actor identity and a server-resolved stop, service and departure. Do not trust client-supplied position, fare or vehicle ownership.
4. The Core atomically validates actor location, departure window, capacity and eligibility, then records a unique boarding event with an idempotency key.
5. Only a persisted arrival event moves the actor to the destination. Renderer refreshes, cron retries and reconnects cannot duplicate the movement.
6. Test: invalid stop, unauthorised actor, full bus, double boarding, missed departure, retry, and arrival after restart. No live movement until these tests pass.

## Spatial layers (future-compatible)
A location is (world ID, stable place ID, layer ID, optional elevation/depth). Candidate layers: surface, interior, underground, elevated, orbital. A tunnel or cave is a persistent navigable space with explicit entrances and exit transitions, not a client-only visual overlay. Layer transitions must be Core-authorised and audited. No real-map reimport may overwrite a changed passage or demolished structure.

## Later increments
- Driving school and fictional NOXIA licences; educational real-world questions must be separately licensed and updated.
- Cars and bicycles: vehicle ownership, road graph, parking, energy, safety and NPC driving.
- Rail, ferries, aircraft: separate operating domains, terminals and eligibility.
- Caves/mines: terrain provenance, safe access and possible resource extraction under existing property rules.

## Explicit non-goals
No gambling, fitness-tracker processing, medical fitness gating, payment, production migration, automated merge or deployment in this preflight.

## Review gates
Core owner: journey and event persistence; transport owner: routes, vehicles, schedules; world owner: layers and entrances; governance owner: public-service rules and accessibility. Confirm overlap with open PRs before implementation. Preserve accessible alternatives to mandatory real-world fitness and driving.
