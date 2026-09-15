-- Remote migration-history bridge.
--
-- The docking + multi-leg logistics Core was rolled out to hosted NOXIA as
-- migration 20260915122935 (`docking_and_multileg_logistics_core_manual_rollout`).
-- The canonical schema remains defined by
-- 20260911070500_docking_and_multileg_logistics_core.sql. This no-op file keeps
-- fresh/local migration history aligned with the hosted rollout ID.

select 1;
