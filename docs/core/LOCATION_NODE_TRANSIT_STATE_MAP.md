# NOXIA Core — Location, Position, Node & Transit State Map

Status: 2026-09-14

This document records the location semantics already present in the repository. It does not introduce a new position model.

## Core rule

NOXIA must keep these dimensions distinct:

- **broad location** — the world/colony/station context an object belongs to or most recently occupied;
- **exact position** — geodetic/orbital/body-fixed coordinates where that domain has authoritative data;
- **node binding** — concrete physical attachment to a depot, pad, station inventory or other logistics node;
- **docking/assignment** — concrete occupancy of a docking/landing resource;
- **transit state** — an active movement lifecycle between source and destination.

`broad location != exact position != node binding != docking occupancy != transit state`.

A broad location is not proof that an object is physically attached to a node at that location. A destination reservation is not docking occupancy. A cached local coordinate is not canonical geodetic position.

## Shared vehicle Core

`vehicle_instances` currently stores two separate coarse physical dimensions:

- `location_id` — broad location context;
- `current_node_inventory_id` — concrete current logistics-node binding.

The transport replay in `noxia_sync_vehicle_transport_state` uses the following lifecycle:

| Transport status | Vehicle status | Node binding | Broad location |
| --- | --- | --- | --- |
| `reserved` | `reserved` | source node if needed | source/current location |
| `loading` | `loading` | remains source node | unchanged |
| `in_transit` | `in_transit` | **cleared** | retained as coarse context until arrival |
| `arrived` / `unloading` | `unloading` | destination node | destination location when resolvable |
| `completed` | `ready` | destination node | destination location when resolvable |
| `cancelled` | `ready` | source node | source location when resolvable |

The important invariant is therefore not “`location_id` must be NULL in transit”. The invariant is: **an in-transit vehicle must not claim current physical node membership**. `location_id` is deliberately coarser than node occupancy.

The vehicle-native logistics inventory follows the vehicle's broad location during replay, but that inventory location is not an independent exact-position source.

## Legacy ship transit

The current `ships` transit path has a deliberately different compatibility representation:

- on departure, `ships.location` remains the departure location;
- `dest_location` identifies the destination;
- `status = transit`, `transit_started_at` and `arrives_at` identify the active flight;
- actual origin docking occupancy is released immediately;
- a destination pad may be represented by `ship_transit_pad_reservations`, which is a reservation only;
- on arrival completion, `ships.location` moves to the destination and transit fields are cleared;
- only then may a reservation materialize into `ship_docking_assignments` occupancy.

Therefore `ships.location` during transit is compatibility context, not an exact current physical position.

## Exact planetary position

For planetary world objects that have resolved coordinates, canonical position is body-fixed geodetic data:

- `latitude_deg`;
- `longitude_deg`;
- `altitude_m` where available.

Earth uses WGS84 latitude/longitude. Local `x_m` / `y_m` values are derived metre-scale caches used for rendering, collision and construction. `spatial_region_id` is a cache/view affinity and must never become canonical position.

World-specific adapters may specialize the coordinate system for Moon, Mars and Orbit, but the shared runtime lifecycle must not infer exact coordinates merely from a broad `location_id` or node binding.

## Docking and reservation

A destination pad reservation and actual occupancy are separate states:

- `ship_transit_pad_reservations` means capacity has been reserved for a ship that is still in flight;
- `ship_docking_assignments` means the ship actually occupies the pad;
- departure deletes origin occupancy before entering transit;
- arrival may convert a still-valid reservation into occupancy;
- a failed/invalid reservation must not leave the ship permanently stuck in transit.

This distinction prevents a travelling ship from simultaneously appearing physically docked at its destination.

## Required invariants

1. `vehicle_instances.location_id` and `current_node_inventory_id` remain separate fields.
2. Entering `in_transit` clears vehicle node membership.
3. Entering transit does not require clearing broad `location_id`; broad location is not exact position.
4. Arrival/completion binds the vehicle to the destination node and updates broad location from the destination node where resolvable.
5. Cancellation returns the vehicle to the source node/location where resolvable.
6. Legacy ship departure releases actual docking occupancy before flight.
7. Legacy ship departure creates at most a destination reservation, never destination docking occupancy.
8. Legacy ship start-transit does not teleport `ships.location`; destination remains separate until completion.
9. Legacy ship completion moves `ships.location` to the destination and clears `dest_location`, `arrives_at` and `transit_started_at`.
10. Canonical geodetic coordinates remain distinct from local render/cache coordinates and `spatial_region_id`.
11. No Core path may infer exact planetary coordinates solely from `location_id`, node binding or ownership.

## Next implementation boundary

Do not add a generic `position` table merely to unify incompatible domains. Additive position state is justified only when a concrete movable-object use case needs authoritative continuous coordinates across at least two domains. Until then, Earth/Moon/Mars/Orbit adapters own their exact coordinate representations while Core owns lifecycle consistency between node/location/transit states.
