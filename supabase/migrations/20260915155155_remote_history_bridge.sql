-- 20260915155155_remote_history_bridge.sql
-- Supabase hosted migration-history bridge for the Tharsis E1 feeder FK index.
--
-- Production applied the repository migration
--   20260915180500_tharsis_power_grid_e1_feeder_fk_index.sql
-- through the hosted migration service. Supabase registered that rollout as
-- version 20260915155155 with migration name
-- tharsis_power_grid_e1_feeder_fk_index.
--
-- The index effect remains defined exclusively by the repository migration
-- above. This file intentionally performs no schema or data mutation; it gives
-- the already-applied hosted version a repository counterpart.

select 1;
