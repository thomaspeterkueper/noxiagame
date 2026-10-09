-- NOXIA-LIVING-0010, Stufe 4: Schattenbetrieb des Wohnungsmarkts.
-- Protokoll der Entscheidungen, die Personen treffen würden. Nichts hiervon wird
-- ausgeführt; die Tabelle wird nur geschrieben, wenn NOXIA_HOUSING_SHADOW=true.

create table if not exists public.housing_shadow_decisions (
  id bigserial primary key,
  tick bigint not null,
  person_id uuid not null references public.people(id) on delete cascade,
  outcome text not null check (outcome in ('stay','no_offer','granted','refused')),
  reason text not null,
  target_tile_entity_id uuid references public.tile_entities(id) on delete set null,
  gatekeeper_id text,
  tenure text not null,
  must_move boolean not null,
  wants_to_move boolean not null,
  affordable_places integer not null,
  accessible_places integer not null,
  executable boolean not null default false,
  daily_wage numeric not null default 0,
  wealth numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (person_id, tick)
);

create index if not exists housing_shadow_decisions_tick on public.housing_shadow_decisions (tick desc);

alter table public.housing_shadow_decisions enable row level security;
revoke all on public.housing_shadow_decisions from anon, authenticated;
grant select, insert on public.housing_shadow_decisions to service_role;
grant usage, select on sequence public.housing_shadow_decisions_id_seq to service_role;

drop policy if exists housing_shadow_decisions_service on public.housing_shadow_decisions;
create policy housing_shadow_decisions_service on public.housing_shadow_decisions
  for all to service_role using (true) with check (true);
