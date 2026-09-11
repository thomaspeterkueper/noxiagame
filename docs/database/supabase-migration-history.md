# Supabase migration history

## Purpose

NOXIA keeps two related but distinct facts:

1. **Production rollout history is immutable.** A migration version that Supabase recorded in Production is historical evidence and is never renamed, deleted, or rewritten merely to make repository timestamps look cleaner.
2. **Repository migrations are the canonical rebuild path.** A fresh database must be able to reach the intended current schema by applying the migrations committed under `supabase/migrations` in lexical/version order.

When an emergency/manual Production rollout used a different timestamp or name from the canonical repository migration, the repository carries a small `*_remote_history_bridge.sql` migration at the Production version. These bridges are deliberately no-op. They make the historical version visible to Supabase/Git without executing the domain change twice.

## Rules

- Never repair Production migration history by deleting or renaming applied versions.
- Never replace a historical Production rollout with a second semantic migration at the same version.
- A `remote_history_bridge` contains comments only and must remain idempotent/no-op.
- The canonical migration contains the actual schema/function change used for fresh rebuilds.
- Before merging migration-history changes, prove a clean Supabase development/preview rebuild from Git.
- Production deployment is a separate explicit operation and is not part of migration-history reconciliation.

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

The mapping above describes historical identity, not execution ordering. In particular, a bridge may sort before or after its canonical migration because it preserves the timestamp that Production actually recorded. Since bridges contain no executable SQL, this does not alter fresh-rebuild semantics.

## Older history

The same bridge convention already exists for earlier manually applied/renamed migrations, including the ship/docking, spatial, terrain and world-position rollouts. Those existing bridge files are retained as immutable compatibility markers rather than collapsed or renamed.

## Verification gate

A migration-history reconciliation is complete only when all of the following are true:

1. the repository contains every Production-applied migration version, either as the canonical migration or as a no-op history bridge;
2. a fresh Supabase development/preview database can rebuild from the Git migration directory without manual SQL intervention;
3. the rebuilt database exposes the expected Core schema/functions;
4. no Production migration record or Production data was modified during reconciliation.
