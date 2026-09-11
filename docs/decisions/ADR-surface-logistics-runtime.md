# ADR — Surface Logistics Runtime Cutover

Status: proposed / implementation branch `core/logistics-runtime-v2`

## Decision

NOXIA uses one shared logistics core for surface, orbital and inter-node cargo movement.

The authoritative primitives are:

- addressable `logistics_inventories`,
- `logistics_reservations`,
- persistent `transport_jobs`,
- atomic/idempotent cargo-transfer commands,
- world-specific route snapshots supplied by Earth/Moon/Orbit policy modules.

World domains do not own parallel persistence or mutation APIs.

## Compatibility adapters

Existing stores remain valid while the game migrates:

- `location_resources` is exposed as a `location` inventory,
- `ship_cargo` is exposed as a `vehicle` inventory,
- new facility/depot/port inventories use native `logistics_inventory_items`.

The inventory record addresses the physical store; it does not duplicate its contents.

## Historical stock

Existing aggregate `location_resources.stock` is not retroactively assigned to a private mine or facility. It remains in the shared legacy location inventory until moved through an explicit later migration/gameplay action.

## Production cutover

Facility production migrates incrementally.

When a completed building has one matching active native `facility` inventory for its `tile_entities.id`, new output is credited to that inventory and is **not** also added to aggregate location stock.

Buildings without a matching native facility inventory continue using the legacy aggregate location flow. This keeps non-migrated worlds and building classes compatible.

`location_resources.production` may continue to report total local productive capacity for price/order/scarcity systems, while the stock delta only receives legacy/shared inflow. Therefore reported production and physical aggregate stock inflow are separate quantities during the migration period.

## Idempotency

Facility output credits must be unique per `(tick, tile_entity, resource)`. Retrying a partially completed tick may not duplicate physical output.

## First playable slice

Moon / Shackleton:

```text
Mine -> native mine buffer -> surface vehicle cargo -> warehouse/logistics hub
     -> shuttle-port storage -> transfer shuttle -> orbital interface
```

The initial cutover targets mine output. Earth/Mars/Orbit can consume the same core without changing its persistence model.

## Non-goals for this pass

- no full per-facility input/consumption model,
- no new routing engine in Core,
- no vehicle engineering constants,
- no replacement of server-authoritative inter-node Transit,
- no automatic reassignment of historical aggregate stock.
