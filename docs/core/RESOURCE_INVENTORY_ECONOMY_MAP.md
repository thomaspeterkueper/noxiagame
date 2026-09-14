# NOXIA Core — Resource, Inventory and Economy Map

Status: Core contract

This document records the shared resource/economy semantics that already exist in the repository. It does not introduce a new economy model.

## Canonical rule

**reservation != stock != custody != production != settlement**

A reservation is a claim against future availability. It is not a second stock pool. A custody inventory represents who owns/controls stored goods at a physical host. Production is an explicit stock source. Settlement is an explicit transfer of stock and/or credits.

The Core must preserve local conservation across transfer commands while still allowing explicit modeled sources and sinks such as production, loans, taxes, fees and consumption.

## 1. Resource representations

NOXIA currently has more than one storage backing and they are intentionally bridged through `logistics_inventories`:

| Backing | Canonical use | Stock source |
| --- | --- | --- |
| `native` | Addressable facilities, depots, vehicles, stations and custody accounts | `logistics_inventory_items.amount` |
| `location_resources` | Legacy aggregate location stock | `location_resources.stock` |
| `ship_cargo` | Legacy ship cargo | `ship_cargo.amount` |

`noxia_inventory_amount()`, `noxia_inventory_total_amount()` and `noxia_inventory_capacity()` are the shared read boundary across these storage kinds.

The legacy aggregate and ship backing remain compatibility adapters. They must not be silently replaced or duplicated by native stock without an explicit convergence migration.

## 2. Physical stock invariant

Physical quantities must never be negative.

`logistics_inventory_items.amount >= 0` is enforced by schema. `noxia_adjust_inventory_amount()` locks the inventory row, reads the current authoritative amount and rejects a resulting negative quantity before changing any backing store.

For bounded inventories, capacity is enforced by the command that is creating the inbound movement or production credit. This matters because capacity includes both current stock and, where relevant, already reserved inbound quantities.

The low-level adjustment function is deliberately not a permission, reservation or capacity policy engine. It is the authoritative atomic stock mutation primitive.

## 3. Availability and reservations

Available outbound quantity is:

`physical stock - active outbound reservations`

Reservations do not decrement stock. They prevent the same stock from being promised more than once.

Inbound reservations reserve destination capacity before physical arrival. For bounded destinations, transport creation checks:

`current total + active inbound reservations + requested amount <= capacity`

A transport job creates paired reservations:

- outbound at the source;
- inbound at the destination.

The outbound reservation is consumed when cargo is physically loaded into the vehicle. The inbound reservation remains active during transit and is consumed when the cargo is unloaded into the destination.

Cancelling a job before departure/loading completion releases its still-active reservations without changing physical stock.

## 4. Cargo transfer invariant

A direct cargo transfer is one PostgreSQL transaction.

For a successful transfer of quantity `Q`:

- source decreases by exactly `Q`;
- target increases by exactly `Q`;
- the command result is persisted under one `command_id`;
- retrying the same command returns the stored result rather than applying the movement again;
- reusing a `command_id` with different payload is an error.

Source and target inventory rows are locked in stable ID order before availability/capacity checks. Concurrent transfers therefore cannot both spend the same unreserved quantity.

## 5. Transport invariant

Transport separates reservation, physical loading, travel and unloading.

### Reserved

Stock remains at the source. Source stock and target capacity are reserved.

### Loading / departure

Starting transport moves exactly `amount` from source inventory to vehicle inventory and consumes the outbound reservation. The cargo is now physically in the vehicle.

### In transit / arrived

Cargo remains in the vehicle. The destination inbound reservation remains the capacity claim.

### Unloading / completed

Completion moves exactly `amount` from vehicle inventory to destination inventory and consumes the inbound reservation.

The job row is locked before state transitions and terminal/repeated transitions are idempotent. A retry must not load or unload cargo a second time.

## 6. Custody and marketplace invariant

A public depot/station/surface port is the physical host. Private player goods at that host are represented by a `storage_account` with its own native inventory.

Host ownership and stock ownership are therefore independent.

A market offer reserves goods in the seller's custody inventory. It does not copy them into a marketplace inventory.

For an open offer:

`active offer reservation amount == offer.amount_remaining`

A partial settlement:

- debits buyer credits by `amount * unit_price`;
- credits seller credits by the same amount;
- decrements seller custody stock by the purchased quantity;
- increments buyer custody stock at the same host by the same quantity;
- reduces both `offer.amount_remaining` and its active reservation to the same remaining quantity.

A full settlement consumes the reservation and closes the offer. Cancellation releases the active reservation without moving stock.

Market `command_id` is both unique and concurrency-serialized. Replays cannot duplicate either money or goods.

## 7. Production invariant

Facility output is an explicit stock source, not a transfer.

`noxia_credit_facility_output()` credits an addressable native facility inventory and records the source under the unique tuple:

`(tick_number, tile_entity_id, resource)`

The command claims that tuple before changing inventory, making concurrent retries idempotent. Capacity is checked before stock is credited.

This is the correct place for legitimately new physical goods to enter addressable logistics inventory.

## 8. Build-resource consumption invariant

Building material costs are authoritative server-side configuration in `building_resource_costs`.

The `BEFORE INSERT` trigger on `player_builds` locks each required `location_resources` row, verifies stock, and subtracts the cost in the same transaction as the build start.

If the build insert fails, the material deduction rolls back. Two concurrent build starts cannot both pass the same stock check.

Stock-only deductions do not trigger an economy tick; the tick resource-flow trigger is limited to updates that include production/consumption columns.

## 9. Credits and finance

NOXIA must not enforce global credit conservation because the simulation contains explicit monetary sources and sinks.

Examples include:

- loans;
- taxes and fees;
- rewards/payouts;
- production/economic policy systems.

What Core does require is transactional local accounting. Commands that move existing credits between two players must debit and credit in one transaction and under deterministic row locking. Bank commands must atomically mutate wallet/account state and write their ledger entry.

Marketplace settlement is the principal shared goods-for-credits invariant currently protected here.

## 10. Material → Deposit → Handelsgut → Produkt

The long-term NOXIA economic model remains:

**Material → Deposit → Handelsgut → Produkt**

The current executable schema does not yet encode every conceptual stage as one universal pipeline. For example, the consolidated components chain currently models a factory consuming `metal` and producing `components`, while deposits and later product semantics live in other domain structures.

Core must therefore protect the semantics that exist rather than inventing a premature universal production graph. A later generalized recipe/product model should be additive and should preserve these inventory/reservation invariants.

## 11. Legacy boundaries

The following remain explicit compatibility boundaries:

- aggregate `location_resources`;
- legacy `ship_cargo`;
- legacy spot trading through `ships`/`ship_cargo`;
- addressable native logistics inventories.

Adapters may expose legacy stores through the common inventory read/mutation boundary. They must not duplicate the same physical goods into multiple backing stores.

## 12. Executable invariants

The Core CI guard must continue to verify at least these properties:

1. Native inventory amounts cannot be negative.
2. Inventory adjustment row-locks the inventory and rejects negative results.
3. Active reservations, not a second stock pool, determine unavailable outbound stock.
4. Direct cargo transfers check unreserved source stock and reserved destination capacity.
5. Direct transfer debits and credits the same quantity in one command transaction.
6. Transport creation creates paired source-outbound and destination-inbound reservations.
7. Departure moves source → vehicle exactly once and consumes only the outbound reservation.
8. Completion moves vehicle → destination exactly once and consumes the inbound reservation.
9. Cancellation releases reservations without moving physical stock.
10. Marketplace offers reserve seller custody stock rather than duplicating it.
11. Market settlement performs equal-and-opposite buyer/seller credit movement and seller/buyer stock movement.
12. Partial market fills keep reservation amount equal to offer remaining amount; full fills consume it.
13. Facility output is unique per tick/facility/resource and capacity-checked before credit.
14. Build resource costs are locked and consumed atomically with build start.
15. Stock-only build/resource mutations do not accidentally execute a simulation resource tick.
16. Legacy storage adapters remain explicit; no implicit native-stock duplication is introduced.
17. Current components production remains a concrete `metal -> components` chain rather than being misrepresented as a complete universal product model.

Any intentional architecture change that violates one of these rules must update this contract and its executable guard together.