-- 202606231700_add_flight_count.sql
-- Alpha 0.1: Pilot-Kompetenz serverseitig zählen.
-- Erfolgreiche Reisen erhöhen profiles.flight_count; das Dashboard liest nur den fertigen Wert.

alter table public.profiles
  add column if not exists flight_count integer not null default 0;

update public.profiles
set flight_count = 0
where flight_count is null;
