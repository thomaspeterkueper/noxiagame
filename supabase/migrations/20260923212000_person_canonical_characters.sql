-- NOXIA-LIVING — external canon identity bridge.
-- Canon remains authoritative outside the game; this table only binds identity.

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
  unique (universe_key, character_key),
  check (valid_until_tick is null or valid_from_tick is null or valid_until_tick >= valid_from_tick)
);

alter table public.person_canonical_characters enable row level security;

comment on table public.person_canonical_characters is
  'Identity bridge from Living Population to external Universe canon; emergent simulation state never rewrites canon.';
