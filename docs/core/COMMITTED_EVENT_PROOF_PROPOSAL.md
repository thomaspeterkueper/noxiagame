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

## Read-only schema audit procedure (2026-11-05)

**Scope:** staging or a read-only database connection only. This is an audit plan, **not** evidence that the queries were executed. No DDL/DML or commit-order inference from IDs/timestamps.

```sql
-- Actual event/projection columns, types, nullability and defaults.
SELECT table_schema, table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('simulation_events', 'entity_states', 'tick_log')
ORDER BY table_schema, table_name, ordinal_position;

-- Actual primary/unique/foreign-key constraints.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       con.conname AS constraint_name, con.contype,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('simulation_events', 'entity_states', 'tick_log')
ORDER BY n.nspname, c.relname, con.conname;

-- Trigger definitions and row-level-security posture.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       t.tgname AS trigger_name, pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_trigger t ON t.tgrelid = c.oid AND NOT t.tgisinternal
WHERE c.relname IN ('simulation_events', 'entity_states', 'tick_log')
ORDER BY n.nspname, c.relname, t.tgname;

-- Reader access and policy review.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('simulation_events', 'entity_states', 'tick_log')
ORDER BY schemaname, tablename, policyname;
```

**Review outputs:** map each authoritative command to its owning table/function, lock discipline, actor authorization, audit trigger, idempotency key and independently verifiable event link. Store potentially sensitive schema details in restricted engineering review, not public NPC/player history. A successful join or read permission alone does not prove authorization.

**Stop conditions:** without a persisted proof binding an event to a successful authorized domain transition, or without proven causal order for contradictory same-asset changes, the projection stays unverified. Never substitute `occurred_at`, legacy `sequence`, `tick`, or lexicographic IDs as proof.

## Read-only permission and ordering evidence supplement (2026-11-05)

The schema audit above is insufficient by itself: an enabled RLS flag does not establish the **effective** privileges of the application role, and trigger definitions do not establish the transaction boundaries of the caller. Run the following **read-only** checks in the same staging environment and with the same DB role used by the proposed server reader; do not log secrets or personal data.

```sql
-- Effective execution identity and table-level access for the actual reader role.
SELECT current_user AS execution_role, session_user AS login_role,
       current_setting('row_security') AS row_security_setting;
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
       has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p') AND c.relname IN
  ('simulation_events', 'entity_states', 'tick_log')
ORDER BY n.nspname, c.relname;

-- Identify trigger functions, but inspect their definitions and callers separately.
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       t.tgname AS trigger_name, p.oid::regprocedure AS function_identity,
       p.prosecdef AS security_definer
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND c.relname IN ('simulation_events', 'entity_states', 'tick_log')
ORDER BY n.nspname, c.relname, t.tgname;
```

**Review caveats:** `current_user` can differ from the application identity under `SET ROLE` or `SECURITY DEFINER`; table privileges alone do not prove row visibility or command authorization. Check function bodies, ownership, search paths, and call sites before trusting a proof. For a privileged service role, explicitly verify that the reader does not expose unrestricted event rows to clients.

**Ordering decision test (staging only, separate transactions):** A locks and modifies an asset, B attempts a conflicting modification and must block or fail; A commits; B resumes and must revalidate state/permissions before its own commit. Repeat with A rolling back, with equal world year and legacy sequence, and with requests delivered to the projector in reverse order. Record which *existing* row lock, constraint, or transaction protocol establishes the causal order. Until verified, do not introduce a new commit counter or assert that the legacy sequence provides commit order.

**Outcome of this documentation change:** the audit plan is more precise; no live database privilege, concurrency, or integration test has been executed by this change.


## Static migration evidence: event schema and provenance gaps (2026-11-05)

**Inspected repository SQL (not a live/staging DB):**
- `supabase/migrations/20260831160000_noxia_events_entity_states.sql`
- `supabase/migrations/20260901123000_runtime_simulation_events_forward_compat.sql`

**Observed in the checked-in schema:** `public.simulation_events.id` is a UUID primary key; `tick` is nullable; `occurred_at` and `created_at` are timestamps; `effect_group_id` is a UUID with a nonunique index. There is no declared `commitSequence` or uniqueness constraint for a per-asset commit order in these definitions. `canonical_event_id` has a nonunique index and is KG-owned, so it is not a substitute for Core commit identity. `entity_states.source_event` is a nullable FK to `simulation_events.id` with `ON DELETE SET NULL`, not a mandatory immutable evidence link. `entity_states_one_current_idx` enforces at most one current state per `(subject_type,subject_id)`, but does not itself prove history ordering or authorization.

**Observed trigger path:** the forward-compat migration defines `noxia_record_player_build_event()` as a `SECURITY DEFINER` trigger on `player_builds`, recording `build.*` events in `simulation_events`; its `actor_id` is derived from `new.profile_id`. This establishes a repository-level *intended* audit path for build status transitions, not that every status change was authorized or that the trigger function's effective permissions/search path are safe in the deployed database. The migration also rebinds tile-entity state triggers after a legacy table-shape repair.

**Implication:** a read-only reader cannot derive a trustworthy, transactionally ordered `CommittedWorldReceipt` for arbitrary demolition, reuse or municipal decisions from these columns alone. Do not map `simulation_events.id`, `effect_group_id`, `occurred_at` or `entity_states.source_event` directly to a proven commit-order key. The lack of a declared key in these two migrations is **not** proof that later migrations or deployed schema lack one.

**Next bounded engineering check:** search later migrations and owning command implementations for event-writing authorization and asset-row locks, then run the existing read-only catalog queries against staging. Until that evidence exists, keep the verified reader blocked and do not emit destructive city-history projections. This is a static source review only: no SQL executed, no concurrency test run.


## Static command and trigger boundary review (2026-11-05, follow-up)

**Reviewed at PR #539 head `4ca317c4` (repository source only):**
- `lib/game/core/commands.ts`: `startBuildCommand` and `completeBuildCommand` are server-only wrappers calling service-client RPCs `noxia_start_build` and `noxia_complete_build`. Their returned `AtomicBuildResult` includes build/entity IDs and idempotency status but **no canonical event ID, proven ordering key, or authorization/decision receipt**. The RPC bodies and caller authorization must be audited separately; using a service client is not itself an authorization proof.
- `supabase/migrations/20260831164500_wire_builds_entities_to_event_stream.sql`: `noxia_record_player_build_event()` is an AFTER trigger on `player_builds` and writes a `simulation_events` audit row; `noxia_record_tile_entity_state()` writes a `simulation_events` row and an `entity_states` version with its returned event ID. Both are `SECURITY DEFINER` with `search_path = public`. These writes are part of the triggering SQL transaction, but neither function as shown independently proves the initiating actor's permissions or a municipal decision. Trigger code does not provide a durable total commit order.
- `lib/worldlab/buildingChronicle.server.ts`: the existing read-only chronicle loader queries `simulation_events` ordered by `occurred_at`, and joins current `tile_entities` plus cleared-building tombstones. It is a separate building-chronicle read path, **not** a verified `CommittedWorldReceipt` producer. Do not infer authoritative causal ordering from its timestamp sort. PR #597 may modify this path; coordinate before changing it.

**Concrete gap:** the RPC return shape and trigger-generated event rows do not expose a verified, stable join from a municipal decision through an authorized command to a particular committed event and its causal predecessor. This is an interface gap in the reviewed source, not proof that no other schema or RPC provides such a link.

**Next bounded test gate:** locate the latest definition of `noxia_complete_build` and inspect its row locks, permission checks, idempotent retry and event creation in the same transaction; test with a nonproductive database fixture. Check PR #597's current reader against the same verified-proof boundary before adding any projection. No SQL was run in this review.
