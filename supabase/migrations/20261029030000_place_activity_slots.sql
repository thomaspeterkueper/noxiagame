-- Wandernde Termine (Thomas, 29.10.2026): Probe-Gottesdienste zweimal täglich,
-- zuerst 11 und 17 Uhr (deutsche Zeit, lib/game/gameClock.ts). Kommt zu einem
-- Termin niemand, rückt er beim nächsten Mal eine Stunde weiter (7–22 Uhr),
-- gut besuchte Zeiten bleiben (lib/game/population/realPlaceActivity.ts, adaptSlots).

create table if not exists public.place_activity_slots (
  id uuid primary key default gen_random_uuid(),
  person_key text not null,
  kind text not null check (kind in ('open_community','service','resonance_round','friday_prayer','shabbat','aarti','dharma_service')),
  label text not null,
  hour smallint not null check (hour between 0 and 23),
  duration smallint not null default 2 check (duration between 1 and 6),
  earliest_hour smallint not null default 7,
  latest_end_hour smallint not null default 22,
  since_tick bigint not null,
  evaluated_start bigint,
  last_attendance integer,
  empty_streak integer not null default 0,
  history jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.place_activity_slots enable row level security;
grant select, insert, update, delete on public.place_activity_slots to service_role;
-- Nur der Server (Service-Rolle) liest und schreibt; keine öffentlichen Policies.

create index if not exists place_activity_slots_person_idx on public.place_activity_slots (person_key) where active;

-- Probe-Gottesdienste in St. Johannes, Sundern (Pfarrer Elias Hartmann).
insert into public.place_activity_slots (person_key, kind, label, hour, duration, since_tick)
select 'earth-sundern-st-johannes-priest-001', 'service', 'Probe-Gottesdienst', h, 2,
       (select coalesce(max(tick_number), 0) from public.tick_log)
from (values (11), (17)) as hours(h)
where not exists (select 1 from public.place_activity_slots where person_key = 'earth-sundern-st-johannes-priest-001' and label = 'Probe-Gottesdienst');

-- Der Sondertermin vom 28.10.2026 (20–22 Uhr) fand nicht statt: Im Spiel war 6 Uhr früh.
update public.population_events
set payload = payload || jsonb_build_object('cancelled', true, 'note', 'ersetzt durch Probe-Gottesdienste 11 und 17 Uhr (place_activity_slots)')
where event_type = 'place_activity_scheduled' and payload->>'label' = 'Probe-Gottesdienst' and (payload->>'startsTick')::bigint = 2598;
