-- NOXIA-LIVING — player-relative person identity knowledge.
-- The person's canonical display_name remains backend truth.
-- Clients receive a perceived label derived from what the player actually knows.

set search_path to public;

alter table public.people
  add column if not exists observable_description text;

create table if not exists public.player_person_identity_knowledge (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  identity_state text not null default 'known'
    check (identity_state in ('inferred','known')),
  inferred_name text,
  known_name text,
  confidence numeric(5,4) not null default 1
    check (confidence >= 0 and confidence <= 1),
  source_kind text not null default 'introduction',
  source_ref text,
  learned_tick bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, person_id),
  check (
    (identity_state = 'known' and known_name is not null and char_length(trim(known_name)) > 0)
    or
    (identity_state = 'inferred' and inferred_name is not null and char_length(trim(inferred_name)) > 0)
  )
);

create index if not exists idx_player_person_identity_person
  on public.player_person_identity_knowledge(person_id, identity_state);

alter table public.player_person_identity_knowledge enable row level security;

drop policy if exists player_person_identity_service on public.player_person_identity_knowledge;
create policy player_person_identity_service on public.player_person_identity_knowledge
  for all to service_role using (true) with check (true);

revoke all on public.player_person_identity_knowledge from anon, authenticated;
grant all on public.player_person_identity_knowledge to service_role;

comment on column public.people.observable_description is
  'Visible, non-identifying description used when a player does not yet know this person, e.g. Mann, ca. 30.';

comment on table public.player_person_identity_knowledge is
  'Per-player identity knowledge. Absence of a row means identity unknown.';
