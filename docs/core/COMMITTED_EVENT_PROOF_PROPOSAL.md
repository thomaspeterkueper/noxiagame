# Proposed Core committed-event ordering and verification contract (v0, review required)

Status: **proposal only**, scoped to PR #539; not a claim that the runtime, schema, or reader already implements this contract. Must be reconciled with [CORE_CONTRACT](./CORE_CONTRACT.md) and [TIME_TICK_EVENT_REPLAY_MAP](./TIME_TICK_EVENT_REPLAY_MAP.md) before adoption.

## Existing boundary

`adaptCommittedWorldEvents` consumes `CommittedWorldReceipt` with `eventId`, `settlementId`, `worldYear`, `sequence`, `domain`, `domainEventRef`, `actorRef`, `committed`, and `change`. It validates shape and domain ownership for establishment, but **does not authenticate** receipts. Existing tests legitimately reuse `sequence: 1` across events. Therefore uniqueness of the legacy `sequence` is **not established** and must not be enforced by the adapter.

Existing `tick_log.tick_number` is the shared simulation clock, `simulation_events` is the audit stream, and `entity_states.source_event` links historical projection to events. None of these fields may be silently repurposed as a newly invented global commit counter.

## Proposed additional Core proof, not a replacement for existing fields

For each successful authoritative mutation, a trusted server-side reader should be able to recover a durable proof record with:

- `commandId` or a domain-defined idempotent transition key; identical retries return the original result and conflicting payloads fail.
- `domainEventRef` and `eventId`, bound unambiguously to the persisted domain transition and its audit event.
- `settlementId`, `domain`, `actorRef`, and the authorization/decision reference appropriate to the action; server validates actor permissions and municipal decision finality against persisted state.
- A **persisted, unique, monotonic ordering key** within an explicitly declared scope (proposed `commitSequence`), allocated atomically with the mutation, or an existing equivalently proven transactional ordering source. This is **not** the legacy `sequence`, a timestamp, `worldYear`, or a tick.
- `occurredAt` and simulation context for display/query only; these do not determine commit precedence.
- A stable schema/version identifier for interpreting the proof and replay.

The ordering scope (whole world, settlement, or aggregate) and transaction boundary require an explicit design decision. A per-settlement counter cannot order cross-settlement transfers by itself. If an authoritative existing ledger already supplies an ordering key, prefer that over a new table/counter. No migration is authorized by this document.

## Required invariants

1. **Core-only writes:** only the owning domain command can mutate building, parcel, usage, owner, inventory, or transport state. The city chronicle and map are projections.
2. **Atomic evidence:** a successful mutation and its proof become visible together; failed or rolled-back commands cannot leave a valid proof.
3. **Fail closed:** a `committed: true` JSON flag, client-supplied receipt, NPC dialogue, proposal, or election result is not independent proof. Missing, mismatched, duplicated, or untrusted proof yields `unknown`/rejection, not a standing or demolished building.
4. **Stable identity:** building, parcel, use/occupancy, and owner are distinct identities. Remodel, repurpose, extension, demolition, rewilding, and reconstruction have explicit domain transitions and permission checks.
5. **Deterministic replay:** independently verified commits replay by the proven ordering key. Equal timestamps do not break ties; conflicting events without authoritative order remain ambiguous.
6. **Idempotency:** retrying a command cannot create a second world mutation or a second proof for the same transition.
7. **Civic provenance:** conversation → proposal → deliberation/vote → finalized decision → authorized command → proof → persistent projection; decisions alone never mutate world state.
8. **Import boundary:** OSM/ALKIS or other real-world maps initialize a baseline once. Later imports cannot overwrite the authoritative simulated world.
9. **Read isolation:** the reader must use a consistent snapshot/watermark so a partial page or partially observed transaction cannot be treated as complete history.
10. **Privacy:** public chronicle output contains only approved projection fields; private conversations, votes where secret, and actor records remain access-controlled.

## Compatibility and acceptance gates

- Keep legacy `CommittedWorldReceipt.sequence` and existing adapter behavior unchanged until ownership and ordering scope are decided.
- Verify actual database schema, command implementation, event trigger, and receipt provenance; document the exact authoritative table/column and permissions.
- Add integration tests for two commits with the same `worldYear` and `sequence`, out-of-order delivery, duplicate retries, concurrent commands, missing proof, failed commands, mismatched domain/actor, and cross-settlement operations.
- Add an end-to-end **nonproductive Seelenberg/Brombach fixture** covering a proposed reuse of a building, lawful municipal approval, Core execution, receipt verification, replay, and visible map change; include negative tests for unauthorized demolition and attempted map reimport.
- Only after these gates: wire a read-only verified receipt loader into PR #597, without granting the adapter authority to certify its own inputs.

## Open decisions for review

1. Does the existing Core already expose a transactionally ordered, durable event/commit key? If yes, identify it and avoid a parallel counter.
2. Is the required order global, per settlement, or per aggregate? How are cross-settlement transfers serialized?
3. Which exact persisted records prove command authorization, finalized civic decision, and domain ownership?
4. What is the recovery behavior when event audit writing succeeds but projection updating fails?

Until answered, no migration, merge, deployment, or world-state write is implied.

## Repository contract cross-check (2026-11-05)

Reviewed `docs/core/CORE_CONTRACT.md`, `docs/core/TIME_TICK_EVENT_REPLAY_MAP.md`, and `lib/game/evolution/committedEventAdapter.ts` on PR #539. These establish the following **documented** guarantees, not a live database audit:

| Existing mechanism | Guaranteed purpose | What it does **not** prove |
| --- | --- | --- |
| `tick_log.tick_number` / `claim_due_ticks()` | Unique, serialized due-tick claims | Total order of arbitrary building, civic, or market commits between ticks |
| `simulation_events.occurred_at` | Event occurrence time | Unique ordering of simultaneous commits or successful authorization |
| `simulation_events.tick` | Optional simulation-tick context | Transactional commit order for non-tick commands |
| `entity_states.source_event` | Link from temporal projection to source event | That a client-provided receipt was issued by an authorized command |
| Command UUID or locked domain transition | Domain-specific idempotency | Universal cross-domain event ordering |
| `CommittedWorldReceipt.sequence` | Legacy chronicle ordering input | Uniqueness or authenticated commit precedence |

**Decision gate A — evidence first:** inspect the actual schema constraints, event triggers, command transaction boundaries and permission policies before choosing an ordering mechanism. A PostgreSQL sequence value alone does not guarantee *commit order* under concurrent transactions (a transaction allocated first can commit last). Neither UUID ordering nor timestamp sorting solves this. If strict total order is needed, use a demonstrably serialized commit protocol or explicitly record causal dependencies and reject unresolved concurrency.

**Decision gate B — scope:** first specify whether the projection needs only per-building/parcel order, per-settlement order, or global order. For independent assets, a partial order with stable tie handling may suffice; for demolition/rebuild of the same parcel, causal order must be proven. Cross-settlement trades require their own domain transaction guarantees rather than pretending two settlement counters form a global order.

**Decision gate C — reader:** a trusted server reader must join the event to its authoritative domain transition, verify authorization and settlement/asset identity, and only then emit a canonical receipt. The current adapter remains an untrusted-shape validator; `committed: true` is not evidence. Missing verification must fail closed.

**Test gate:** before changing adapter sorting, add concurrency tests where transaction A obtains a candidate ordering value, B commits first, then A commits; plus same-timestamp contradictory building transitions, retry after rollback, and mismatched domain references. Until a concrete backend and transaction harness are available, these remain **specified but unexecuted** integration tests, not passed tests.
