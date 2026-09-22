-- NOXIA-LIVING — bridge simulated people to canonical Universe characters without
-- copying narrative canon into the game database.

create table if not exists public.person_canonical_characters (
  person_id uuid primary key references public.people(id) on delete cascade,
  universe_key text not null,
  character_key text not null,
  canon_source_ref text,
  canon_revision text,
  integration_mode text not null default 'canon_anchor'
    check (integration_mode in ('canon_anchor', 'historical_trace', 'simulation_only')),
  valid_from_tick bigint,
  valid_until_tick bigint,
  created_at timestamptz not null default now(),
  unique (universe_key, character_key)
);

alter table public.person_canonical_characters enable row level security;

comment on table public.person_canonical_characters is
  'Identity bridge from a NOXIA simulated person to an external canonical character. Canon remains external; emergent simulation state must not rewrite it.';
