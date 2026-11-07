-- Remote migration-history bridge for PR #513 Moon starter Engineering r1.
-- Hosted production applied the repository effect migration
--   20261023130000_moon_starter_engineering_r1.sql
-- through Supabase apply_migration and registered the rollout as
--   20261023131820 moon_starter_engineering_r1.
--
-- The schema/data effect remains defined by the repository migration above.
-- This file intentionally performs no mutation; it preserves hosted/repository
-- version parity for future migration-history reconciliation.

select 1;
