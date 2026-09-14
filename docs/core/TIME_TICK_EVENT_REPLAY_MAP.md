# NOXIA Core — Time, Tick, Event & Replay Map

Status: 2026-09-14

This document records the time and retry semantics that already exist in the repository. It does **not** introduce a second clock, scheduler or event store.

## Core rule

NOXIA has several related but distinct temporal concepts:

- **simulation tick** — discrete shared simulation progress, claimed through the lazy tick engine;
- **operational / wall-clock time** — timestamps used for due times, TTLs, transit arrivals and audit chronology;
- **event time** — `occurred_at` / temporal state ranges describing when a recorded transition happened;
- **command identity** — explicit UUID/state-transition identity used to make retries safe.

These concepts must not be collapsed into one another.

`tick != timestamp != event identity != command identity`

## Authoritative simulation tick

The lazy simulation tick is owned by `tick_log` and `claim_due_ticks()`.

`tick_log.tick_number` is a primary key. `claim_due_ticks()` uses a transaction-scoped PostgreSQL advisory lock, computes how many slots are due, inserts those tick slots before returning them to the winning caller, and therefore serializes concurrent claimers. A later caller in the same interval observes that the slots have already been claimed.

Wall-clock time is allowed to decide **whether a tick is due**. It does not itself become the tick identity.

The historical `simulation_ticks` table is a population-run log/counter. It is not a second global simulation clock and must not become one.

## Resource-flow application

The resource tick path deliberately reuses the lazy tick engine rather than adding another scheduler or ledger. Resource deltas are applied inside PostgreSQL against the row value that wins the update lock.

The separation is intentional:

1. `claim_due_ticks()` owns tick-slot uniqueness;
2. the simulation runner executes each claimed tick sequentially;
3. `noxia_apply_resource_flow_delta()` owns atomic stock application for that execution;
4. ordinary stock transfers/build deductions do not accidentally trigger a resource tick.

A future world-specific Earth/Moon/Mars/Orbit scheduler must not create its own authoritative tick counter.

## Operational time

Wall-clock timestamps remain appropriate for real-duration mechanics, including:

- `completes_at` for delayed construction/sales;
- `transit_started_at` / `arrives_at` for transport;
- reservation expiry and TTLs;
- `created_at`, `updated_at`, `occurred_at` and temporal state ranges.

These timestamps answer **when** something is due or recorded. They are not deduplication keys and must not by themselves prove that a gameplay effect was applied exactly once.

## Scheduler versus authority

Cron/API schedulers only discover work that appears due. They must delegate mutations to authoritative Core commands.

The build cron follows this contract: it selects `player_builds` whose `completes_at` is due, then calls `completeBuildCommand`, which reaches the transactional `noxia_complete_build()` command. The cron does not directly mark a build complete or create the world entity.

The same pattern should be used for future recurring systems: **scheduler finds work; Core command owns the transition**.

## State-transition idempotency

Some commands do not need an external command UUID because the domain row itself provides a unique transition boundary.

### Build completion

`noxia_complete_build()` locks the build row `FOR UPDATE`. If the build is already complete, it returns the existing/materialized entity with `idempotent=true`. Materialization is additionally protected by unique `source_build_id` handling.

### Sale completion

`noxia_complete_sale()` similarly locks the delayed sale row and returns an idempotent result once the row is already `sold`, preventing duplicate payout.

### Legacy ship transit

`noxia_start_transit()` treats a repeated start toward the already-active destination as an idempotent retry and must not charge fee/energy again. `noxia_complete_transit()` treats a ship that is no longer in transit as already completed, so repeated arrival processing does not increment flight count twice.

## Command-ID idempotency

Commands that can be retried while their domain state remains otherwise valid use explicit `command_id` UUIDs.

For marketplace commands, a transaction-scoped advisory lock is derived from command type + command UUID before checking the stored command result. Reusing the same command ID with a different payload is a conflict, not a second command.

Shared logistics/docking/itinerary commands use the same transaction-scoped serialization wrapper before delegating to their persisted idempotent implementations.

Therefore timestamps such as `created_at`, `updated_at` or `occurred_at` must never replace `command_id` for retry-sensitive mutations.

## Runtime events and temporal projections

`simulation_events` is the shared runtime event/audit stream. It carries both optional `tick` context and an `occurred_at` timestamp because simulation order and wall-clock chronology are not identical concepts.

`entity_states` is a temporal projection/history derived from authoritative entity mutation and links back through `source_event`.

The event stream must not become a second independently mutable gameplay state. Gameplay commands mutate authoritative domain state transactionally; triggers/events record and project those transitions.

For player builds, the event trigger explicitly ignores updates where neither `status` nor `completes_at` changed. This prevents a generic row update from inventing a duplicate lifecycle event.

## Replay contract

A safe replay/retry path follows these rules:

1. determine identity from tick slot, command UUID or unique domain transition — never from timestamp alone;
2. serialize concurrent attempts where two writers could pass the same initial lookup;
3. lock authoritative domain rows before applying non-commutative effects;
4. return the stored/already-materialized result for an identical retry;
5. reject reuse of an identity with a different payload;
6. emit/project events from the successful authoritative state transition;
7. never apply gameplay effects merely because an event timestamp appears new.

## Required invariants

1. `tick_log.tick_number` remains unique and authoritative for lazy simulation ticks.
2. `claim_due_ticks()` remains serialized and claims slots before execution.
3. `simulation_ticks` remains a population execution log, not a competing global clock.
4. Resource ticks reuse the shared tick scheduler and apply stock deltas atomically.
5. Wall-clock timestamps may determine due-ness but never replace tick/command identity.
6. Schedulers/cron routes delegate final mutation to Core commands.
7. Build/sale completion remains row-locked and idempotent.
8. Transit start/completion remains retry-safe against duplicate charging/arrival effects.
9. Retry-sensitive marketplace/logistics commands remain command-ID based and concurrency-serialized.
10. Same command ID + different payload is rejected where the command stores a result.
11. `simulation_events.tick` and `occurred_at` remain distinct dimensions.
12. `entity_states` remains a projection linked to `source_event` rather than an independent mutation authority.
13. Event triggers do not manufacture lifecycle transitions from unchanged state.
14. No Earth/Moon/Mars/Orbit subsystem introduces a competing authoritative tick counter.

## Change rule

Do not add a new clock, scheduler, replay ledger or event authority merely because a world domain needs different real-time durations. First express the requirement through the existing shared tick, due-time, command-idempotency and event-projection contracts. Additive schema is justified only when a concrete simulation integrity gap cannot be represented by these existing boundaries.
