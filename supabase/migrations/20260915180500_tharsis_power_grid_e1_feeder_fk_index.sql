-- 20260915180500_tharsis_power_grid_e1_feeder_fk_index.sql
-- Tharsis E1 follow-up: cover the location_utility_feeders.entity_id foreign key.
--
-- The E1 topology migration already has (location_id, entity_id), which serves
-- location-scoped queries but does not cover the entity_id foreign key by
-- itself. Supabase's performance advisor therefore correctly reports the FK as
-- unindexed. This additive index changes no grid state or gameplay semantics.

set search_path to public;

create index if not exists idx_location_utility_feeders_entity_id
  on location_utility_feeders (entity_id);
