-- 20260915154722_remote_history_bridge.sql
-- Supabase hosted migration-history bridge for Tharsis Electrical Grid E1.
--
-- Production applied the repository migration
--   20260915173000_tharsis_power_grid_topology_e1.sql
-- through the hosted migration service. Supabase registered that rollout as
-- version 20260915154722 with migration name tharsis_power_grid_topology_e1.
--
-- The schema/topology effects remain defined exclusively by the repository
-- migration above. This file intentionally performs no schema or data mutation;
-- it gives the already-applied hosted version a repository counterpart.

select 1;
