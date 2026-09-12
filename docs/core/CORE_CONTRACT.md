# NOXIA Core Contract

Status: authoritative architecture contract for shared runtime systems.

This document records contracts already present in the repository. It is intentionally conservative: world-specific domains may specialize terrain, routing, geodesy and presentation, but must not create competing authoritative implementations for shared runtime state.

## Source-of-truth matrix

| Concern | Authoritative runtime source | World-domain responsibility |
| --- | --- | --- |
| Resource stock | `logistics_inventories` + backing storage + inventory commands | provide production/extraction context |
| Reservations | `logistics_reservations` | none |
| Cargo movement | `transport_jobs`, itinerary/docking commands | provide route/traversal assessment |
| Vehicle living state | `vehicle_instances` | provide frame-specific behavior and traversal rules |
| Vehicle cargo | shared logistics inventory bound to `vehicle_instance` | none |
| Market custody | `storage_accounts` and custody inventories | provide eligible physical depot/station hosts |
| Market offers/settlement | `market_offers`, `market_settlements`, atomic market commands | none |
| Build runtime | world build records + authoritative build commands/costs/events | provide buildability/site assessment |
| Runtime events | NOXIA runtime event stream/entity states | world modules may emit domain events through Core contracts |
| Canon identity | runtime/canon projection boundary and canonical IDs | consume canonical entities; do not redefine shared canon |
| Position | shared locations/global world positions plus domain-specific reference data | Earth/Moon/Mars/Orbit own their geodetic/orbital adapters |

## Required invariants

1. **Core owns shared mutations.** Clients and world modules must use the authoritative command/RPC layer for shared stock, reservations, trade, finance/assets and transit rather than independently mutating equivalent state.
2. **Inventory is the physical stock abstraction.** A resource quantity has one authoritative stock location. Market listing reserves stock; it does not create another stock pool.
3. **Vehicle state and vehicle cargo are separate concerns.** `vehicle_instances` owns condition, wear, status, position/node and frame state. Cargo remains in the shared logistics inventory associated with that vehicle instance.
4. **Transit has one active vehicle assignment.** A vehicle inventory may participate in at most one active transport job across reserved/loading/in-transit/arrived/unloading states.
5. **Transit position is explicit.** A vehicle at a node may have `current_node_inventory_id`; a vehicle in transit must not pretend to be physically stored at a node.
6. **Custody is not a second stock model.** Custody inventories are native inventories under an eligible physical host and retain their own owner identity.
7. **Owner, custodian/operator and occupant are different concepts.** Existing ownership/custody fields must not be reinterpreted as occupancy. A generic occupancy/usage relation may be added later only where domain requirements prove it necessary.
8. **World specialization stays outside the shared lifecycle.** Earth, Moon, Mars and Orbit can use different terrain, coordinate and route adapters while sharing build, inventory, ownership, transport and time contracts.
9. **Historical migrations are immutable.** Applied migration history is not rewritten to tidy architecture. New migrations are additive; cleanup is performed through explicit reconciliation/baseline strategy and replay validation.
10. **Cross-repository canon changes are external tasks.** NOXIA may consume shared canonical entities and identifiers but must not silently become the source of truth for another repository's domain.

## Ownership / custody / usage terminology

The current Core reliably models ownership and custody in several runtime areas. Until an explicit generic usage/occupancy model is introduced, use these meanings consistently:

- **owner**: legal/economic owner of an asset or inventory.
- **custody**: physically held stock belonging to another owner under a host inventory/depot/station.
- **operator / user**: actor currently authorized to operate an asset; domain-specific until generalized.
- **occupant**: actor or organization occupying/using a facility or property; not equivalent to owner or custody.

Do not overload `owner_profile_id` to represent operator or occupant.

## Location contract

Shared movable runtime objects should resolve to one physical state at a time:

- **at node/location**: represented by the object's current node/location relation;
- **inside another carrier/container**: represented by the relevant inventory/container relationship;
- **docked/assigned**: represented by docking/assignment state;
- **in transit**: represented by an active transport/transit record, with node membership cleared where applicable.

Domain adapters may calculate coordinates, routes and traversal costs, but the resulting transition must pass through the shared transit/transport contract.

## Change rule

Before adding a new shared table or subsystem, verify that the requirement cannot be expressed by the existing Core abstraction. New abstractions are justified only when they remove duplication across at least two domains or close a concrete simulation integrity gap.
