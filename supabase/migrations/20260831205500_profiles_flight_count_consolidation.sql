-- Restores the schema effect of archived migration 202606231700_add_flight_count.sql
-- for fresh replays without rewriting the historical consolidated baseline.

set search_path to public;

alter table public.profiles
  add column if not exists flight_count integer not null default 0;
