-- Remote migration-history bridge for PR #513 Knowledge RPC reconciliation.
-- Hosted production applied the repository effect migration
--   20261023130500_knowledge_rpc_fresh_replay_reconciliation.sql
-- through Supabase apply_migration and registered the rollout as
--   20261023131822 knowledge_rpc_fresh_replay_reconciliation.
--
-- The schema effect remains defined by the repository migration above.
-- This file intentionally performs no mutation; it preserves hosted/repository
-- version parity for future migration-history reconciliation.

select 1;
