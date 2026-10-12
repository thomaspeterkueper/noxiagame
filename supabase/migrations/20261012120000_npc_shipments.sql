-- 20261012120000_npc_shipments.sql
-- Erstellt: 12.10.2026
-- Version:  1.0.0
--
-- Sendungen von Handelsfirmen. Eine Zeile je Sendung, nur anfügend.
-- Der Zustand wird aus Zeile + Zeit abgeleitet: angekommen ist eine Sendung,
-- sobald arrive_tick erreicht ist. Es gibt keine Statusspalte und kein Update.

create table if not exists public.npc_shipments (
  id               uuid primary key default gen_random_uuid(),
  actor_id         uuid not null references public.actors(id) on delete cascade,
  resource         text not null,
  amount           numeric not null check (amount > 0),
  from_location_id uuid not null references public.locations(id),
  to_location_id   uuid not null references public.locations(id),
  depart_tick      bigint not null,
  arrive_tick      bigint not null,
  unit_cost        numeric not null check (unit_cost >= 0),   -- (Kauf + Fracht) je t
  freight_cost     numeric not null check (freight_cost >= 0),
  created_at       timestamptz not null default now(),
  constraint npc_shipments_route check (from_location_id <> to_location_id),
  constraint npc_shipments_time  check (arrive_tick > depart_tick),
  constraint npc_shipments_once  unique (actor_id, depart_tick, resource)
);

create index if not exists npc_shipments_to_idx on public.npc_shipments (to_location_id, arrive_tick);

-- Nur der Server (service role) schreibt und liest; keine Policies für Clients.
alter table public.npc_shipments enable row level security;
