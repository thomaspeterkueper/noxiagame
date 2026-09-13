# NOXIA Core — Ownership, Custody, Usage & Occupancy Map

Status: 2026-09-13

This document maps the relationships that already exist in the repository. It does **not** introduce a new generic ownership or occupancy model. The purpose is to keep distinct concepts distinct before further Core schema work.

## Core rule

NOXIA must not infer one of these relations from another:

- **ownership** — who legally/economically owns an asset;
- **custody** — whose goods are held in a physical host;
- **usage / operation** — who is currently using or operating an asset;
- **occupancy / assignment** — who lives, works or is temporarily assigned at a place;
- **location** — where an object/person is physically or logically situated.

`owner != custodian != operator != occupant` is a valid and expected state.

## Current authoritative relations

| Domain object | Ownership | Custody / contents | Usage / operator | Occupancy / assignment | Location |
| --- | --- | --- | --- | --- | --- |
| `tile_entities` building/facility | `owner_class` + `owner_id` (with `profile_id` compatibility for PLAYER ownership) | Native facility inventory via `logistics_inventories`; player goods may live in private custody inventories below a host | No generic operator relation yet | `person_assignments.tile_entity_id` for home/work/temporary assignments | `location_id`; metric placement fields / spatial model |
| `vehicle_instances` | `owner_profile_id` | Vehicle-native `logistics_inventories` inventory; ownership mirrored to native cargo inventory | `crew_ids` expresses current crew, but is not a complete generic operator contract | No generic occupant relation beyond crew semantics | `location_id` + `current_node_inventory_id`; transport state during movement |
| physical facility inventory | Derived at provisioning from owning `tile_entity`; PLAYER maps to `owner_profile_id`, non-player may remain NULL | Holds physical stock at the host | Access policy via public deposit/withdraw and server commands, not ownership | none | same `location_id` as host |
| `storage_accounts` | Not ownership of the host. Account belongs to `owner_profile_id` | Canonical private custody layer under `host_inventory_id`; linked private `inventory_id` holds that player's goods | Access through custody/market commands | none | inherited physical host location |
| `people` | Not an ownable asset | n/a | `activity_state` describes current activity, not asset operator authority | `person_assignments` is authoritative for home/work/temporary assignment | `current_location_id` is broad current location |
| `locations` | Legacy/founding `owner_id`; do not reinterpret as universal asset ownership | n/a | n/a | many people/assets may be located there | Location identity itself |
| `ships` | Legacy profile binding (`profile_id`) remains authoritative for player ships in current finance/trade paths | Legacy `ship_cargo` for spot-trade cargo | `profiles.active_ship_id` selects active player ship; this is selection/use, not ownership transfer | no generic occupant relation in the current Core contract | existing ship location/transit state; do not derive ownership from location |

## Buildings and facilities

The spatial build model preserves `player_builds` as the construction lifecycle and materialises completed buildings into `tile_entities`. Spatial placement (`x_m`, `y_m`, `z_m`, rotation, footprint, site) is independent of ownership.

For logistics-capable buildings, `noxia_ensure_facility_inventory` creates exactly one native physical inventory. PLAYER-owned facilities map building ownership to the inventory's `owner_profile_id`; STATE/NPC/CORPORATION facilities may have `owner_profile_id = NULL` and are governed through Core access policy.

This mirror is a convenience/invariant for the native inventory. It does not mean that all goods physically present at a facility belong to the facility owner. Private goods at a shared host belong in `storage_accounts` + their linked private custody inventories.

## Vehicles

`vehicle_instances.owner_profile_id` is the asset-ownership relation for the shared vehicle core.

`current_node_inventory_id` is a physical node binding, not a custody owner. `crew_ids` identifies crew membership/current presence and must not be treated as proof of ownership. Transport-state synchronisation may move the vehicle and its native cargo inventory together without changing the conceptual ownership relation.

Future leasing, charter, employer assignment or delegated operation therefore must not overwrite `owner_profile_id`.

## People and occupancy

`people.current_location_id` is broad current location. Durable semantic assignments are represented separately in `person_assignments`:

- `home` — residence;
- `work` — workplace, optionally with `employer_actor_id` and `role_code`;
- `temporary` — temporary assignment.

`person_assignments.tile_entity_id` can bind a person to a concrete building. This is the current authoritative building-occupancy/assignment mechanism. A resident or worker can therefore occupy/use a building owned by another profile, actor or state entity without changing building ownership.

Do not introduce a parallel `occupant_id` column on buildings unless a future use case cannot be represented by `person_assignments`.

## Custody and marketplace

The custody marketplace deliberately separates the physical host from the owner of stored goods:

1. a depot/facility inventory is the physical host;
2. `storage_accounts` binds one owner to that host;
3. the account's private inventory contains that owner's goods;
4. marketplace reservations operate against those goods;
5. settlement can transfer custody without creating a second physical stock pool.

Therefore inventory presence does not prove host ownership, and host ownership does not prove ownership of all stock at that host.

## Legacy boundaries that must remain explicit

### `locations.owner_id`

This field was introduced as the founder/owner of a colony/location. It is not the universal owner field for buildings, vehicles, inventories or occupants. Do not propagate it downward as an ownership default.

### `profile_id` compatibility fields

Several older paths bind player-owned state directly through `profile_id`. New shared Core domains increasingly use explicit ownership fields such as `owner_profile_id` or `owner_class`/`owner_id`. Compatibility fields must be migrated only when a concrete invariant and replay path exist; they should not be mass-renamed or repurposed.

### Ships and legacy cargo

Current spot-trade commands still use `ships.profile_id` and `ship_cargo`. The shared logistics/vehicle model must not silently reinterpret these rows before a deliberate ship/logistics convergence plan exists.

## Missing relations — intentionally not invented yet

The repository does **not** currently have a single generic contract for:

- leased assets;
- delegated operators;
- passengers distinct from crew;
- tenancy/rental rights;
- corporation-owned assets with delegated individual control;
- time-bounded asset-use rights;
- generic building access/occupancy beyond the existing population assignments and domain-specific access rules.

These are real future needs, but a universal `asset_relations` table should only be introduced when at least two concrete domains need the same semantics and lifecycle.

## Required invariants for the next Core test pass

1. PLAYER-owned facility native inventories mirror the owning building profile; non-player facilities do not fabricate a player owner.
2. A `storage_account` private inventory may differ in owner from its physical host; this is valid, not corruption.
3. Moving a vehicle changes location/node/transit state but does not implicitly transfer ownership.
4. Crew membership does not mutate vehicle ownership.
5. Home/work/temporary assignments do not mutate building ownership.
6. `locations.owner_id` must never be used as an implicit owner for contained buildings, vehicles, inventories or people.
7. Exact position, broad location, node binding and transit state remain orthogonal to ownership/custody.
8. Legacy ship ownership/cargo remains isolated until an explicit convergence migration is designed.

## Recommended next implementation

Do **not** add new ownership columns yet. The next Core change should be a database/replay invariant test suite covering the eight rules above, followed by the location/node/transit invariants from `CORE_CONTRACT.md`. Only failures that cannot be expressed with the current model should trigger additive schema design.
