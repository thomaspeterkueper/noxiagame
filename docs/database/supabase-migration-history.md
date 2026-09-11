# Supabase migration history

## Purpose

NOXIA keeps two related but distinct facts:

1. **Production rollout history is immutable.** A migration version that Supabase recorded in Production is historical evidence and is never renamed, deleted, or rewritten merely to make repository timestamps look cleaner.
2. **Repository migrations are the canonical rebuild path.** A fresh database must be able to reach the intended current schema by applying the migrations committed under `supabase/migrations` in lexical/version order.

When an emergency/manual Production rollout used a different timestamp or name from the canonical repository migration, the repository carries a small `*_remote_history_bridge.sql` migration at the Production version. These bridges are deliberately no-op. They make the historical version visible to Supabase/Git without executing the domain change twice.

## Rules

- Never repair Production migration history by deleting or renaming applied versions merely to satisfy a hosted check.
- Never replace a historical Production rollout with a second semantic migration at the same version.
- A `remote_history_bridge` contains comments only and must remain idempotent/no-op.
- The canonical migration contains the actual schema/function change used for fresh rebuilds.
- Before merging migration-history changes, prove a clean Supabase development/preview rebuild from Git.
- Production deployment is a separate explicit operation and is not part of migration-history reconciliation.
- Never call reset/rebase/delete on a Supabase branch record whose `is_default` flag is true or whose project reference equals the Production project reference. Such a record is not a disposable preview database even if its branch-status metadata is stale or failed.
- New NOXIA migrations must use the canonical 14-digit UTC format `YYYYMMDDHHmmss_name.sql`. Legacy shorter versions remain historical compatibility records only.

## Active Core rollout aliases, 2026-09-10 to 2026-09-11

| Production-applied version | Production name | Canonical repository migration | Repository history marker |
| --- | --- | --- | --- |
| `20260910081500` | `atomic_game_commands` | `20260910081500_atomic_game_commands.sql` | canonical version already matches |
| `20260910083000` | `atomic_trade_commands` | `20260910083000_atomic_trade_commands.sql` | canonical version already matches |
| `20260910195406` | `atomic_finance_asset_commands_manual_core_rollout` | `20260910090000_atomic_finance_asset_commands.sql` | `20260910195406_remote_history_bridge.sql` |
| `20260911044326` | `atomic_transit_commands_manual_core_rollout` | `20260910093000_atomic_transit_commands.sql` | `20260911044326_remote_history_bridge.sql` |
| `20260911044337` | `transit_mutation_guards_manual_core_rollout` | `20260910094500_transit_mutation_guards.sql` | `20260911044337_remote_history_bridge.sql` |
| `20260911044400` | `core_security_hardening_manual_core_rollout_v2` | `20260910095000_core_security_hardening.sql` | `20260911044400_remote_history_bridge.sql` |
| `20260911045723` | `runtime_event_stream_repair_20260911` | `20260911050000_runtime_event_stream_repair.sql` | `20260911045723_remote_history_bridge.sql` |
| `20260911060537` | `logistics_core_inventories_and_transport_jobs` | `20260911060537_logistics_core_inventories_and_transport_jobs.sql` | canonical version already matches |
| `20260911063018` | `vehicle_instance_core` | `20260911063018_vehicle_instance_core.sql` | canonical version already matches |
| `20260911063840` | `transport_loading_unloading_states` | `20260911065436_transport_loading_unloading_phases.sql` | `20260911063840_remote_history_bridge.sql` |
| `20260911071050` | `facility_output_production_manual_core_rollout` | `20260911064000_facility_output_production.sql` | `20260911071050_remote_history_bridge.sql` |
| `20260911071536` | `surface_vehicle_operating_costs` | `20260911070000_surface_vehicle_operating_costs.sql` | `20260911071536_remote_history_bridge.sql` |
| `20260911101048` | `facility_inventory_provisioning_manual_core_rollout` | `20260911100200_facility_inventory_provisioning.sql` | `20260911101048_remote_history_bridge.sql` |

The mapping above describes historical identity, not execution ordering. In particular, a bridge may sort before or after its canonical migration because it preserves the timestamp that Production actually recorded. Since bridges contain no executable SQL, this does not alter fresh-rebuild semantics.

## Hosted default-branch check: diagnosed false positive

The red `Supabase Preview` check on `main` is not caused by a missing Production migration file. It matches Supabase CLI issue `supabase/cli#6036`, fixed upstream by PR `#6038`: legacy migration versions that are a numeric prefix of a newer timestamp can be compared in different orders locally and remotely.

NOXIA contains the exact collision pattern:

- historical Production/local version `20260828` in `20260828_noxia_tester_state.sql`;
- later canonical versions on the same date, beginning with `20260828122500_living_population_seed_guard.sql` and followed by further `20260828HHMMSS_*` migrations.

A legacy comparator orders the remote `version` column by the extracted version, so `20260828` precedes `20260828122500`. The local side can instead be ordered by full file name, where `20260828122500_...` sorts before `20260828_noxia_tester_state.sql` because a digit sorts before the underscore. The merge walk then incorrectly reports `20260828` as a remote migration missing locally even though the file exists.

This also explains why:

- the current Production migration ledger contains `20260828`;
- the repository contains `20260828_noxia_tester_state.sql`;
- a clean disposable preview rebuild succeeds;
- the GitHub `main` check still reports only `Remote migration versions not found in local migrations directory.`

The hosted Supabase GitHub integration is therefore behaving like the affected comparator path even though the ordering bug has already been fixed upstream. **Do not mutate Production history to work around this false positive.** In particular, do not rename `20260828` in Production and do not delete/repair the historical row just to make the hosted check green.

Until the hosted integration has the upstream ordering fix, migration changes are allowed only with the following gate: use canonical 14-digit versions, validate on a disposable Supabase preview, compare Production-applied versions against repository files/history bridges, and treat the default-branch `Supabase Preview` result as non-authoritative when its sole failure is this known ordering message.

## Older history

The same bridge convention already exists for earlier manually applied/renamed migrations, including the ship/docking, spatial, terrain and world-position rollouts. Those existing bridge files are retained as immutable compatibility markers rather than collapsed or renamed.

## Verification gate

A migration-history reconciliation is complete only when all of the following are true:

1. the repository contains every Production-applied migration version, either as the canonical migration or as a no-op history bridge;
2. a fresh Supabase development/preview database can rebuild from the Git migration directory without manual SQL intervention;
3. the rebuilt database exposes the expected Core schema/functions;
4. no Production migration record or Production data was modified during reconciliation.

### Verified rebuild — 2026-09-11

PR #118 created a new Git-linked Supabase preview (`kouflduesxpkqumzbkra`) from this migration set. The branch reached `MIGRATIONS_PASSED`/`FUNCTIONS_DEPLOYED` and `ACTIVE_HEALTHY`, and the Supabase Preview check for the disposable branch completed successfully during the clean rebuild.

The rebuilt migration ledger contains the three newly added historical markers (`20260911063840`, `20260911071050`, `20260911071536`) together with their canonical migrations. A read-only Core smoke check confirmed the expected current objects, including `transport_jobs`, `vehicle_instances`, `facility_production_commands`, `ship_docking_assignments`, `noxia_start_transit`, `noxia_complete_transit`, `noxia_start_transport_job`, and `noxia_credit_facility_output`.

Production migration history was re-read after the preview verification and was unchanged. No Production SQL or migration-history mutation was performed during this reconciliation.

### Facility inventory provisioning rollout — 2026-09-11

`20260911100200_facility_inventory_provisioning.sql` was validated on disposable Supabase preview `byuatsqjcixcdldzvriy` (PR #123), which reached `MIGRATIONS_PASSED` and `ACTIVE_HEALTHY`. The preview had 13/13 policy-eligible tile entities provisioned, zero missing native inventories and zero inventory-kind mismatches. Repeated `noxia_ensure_facility_inventory()` calls returned the same inventory ID, proving idempotency. ACL verification showed execution disabled for `anon`/`authenticated` and enabled for `service_role` only.

A read-only Production dry-run immediately before rollout found 29 eligible facilities across Earth, Mars, Moon and Phobos with zero kind conflicts. Production rollout was then applied explicitly as `20260911101048 facility_inventory_provisioning_manual_core_rollout`. Post-rollout verification found 29/29 eligible facilities provisioned, zero missing inventories, zero kind mismatches and zero player-owned native inventories with accidental public deposit/withdraw rights.
