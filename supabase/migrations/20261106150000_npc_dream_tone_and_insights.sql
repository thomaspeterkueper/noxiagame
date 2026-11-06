-- 06.11.2026 — NOXIA-LIVING-0016, Schritt 3: Traumton färbt die Stimmung, seltene Einsicht.
--
-- npc_dreams.tone: Grundton des Traums (−1..1), auch bei unterbewussten Träumen.
-- npc_insights: Vermutung einer Figur nach einem deutlich erinnerten Traum zu einem offenen
-- Problem (unerfülltes Bedürfnis). Nie Wahrheit (canonical = false); bestätigt oder verworfen
-- wird später nur durch die Welt (status).

alter table public.npc_dreams add column if not exists tone numeric(4,3) not null default 0 check (tone >= -1 and tone <= 1);

create table if not exists public.npc_insights (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  dream_id uuid references public.npc_dreams(id) on delete set null,
  problem_ref text not null,
  inspiration_refs text[] not null default '{}',
  hypothesis text not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  provenance text not null check (provenance in ('dream_recombination', 'meditation_recombination', 'knowledge_gateway')),
  status text not null default 'vermutet' check (status in ('vermutet', 'bestätigt', 'verworfen')),
  canonical boolean not null default false check (canonical = false),
  tick integer not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists npc_insights_person_created on public.npc_insights (person_id, created_at desc);
alter table public.npc_insights enable row level security;
grant select, insert, update, delete on public.npc_insights to service_role;
