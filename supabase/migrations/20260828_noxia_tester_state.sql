-- NOXIA_TESTER_INTELLIGENT_01 v0.1 persistent state
create table if not exists public.noxia_tester_state (
  tester_id text primary key,
  world_id text not null check (world_id like 'tester-%'),
  player_id uuid,
  cycle integer not null default 0 check (cycle >= 0),
  goals jsonb not null default '[]'::jsonb,
  recent_observations jsonb not null default '[]'::jsonb,
  recent_results jsonb not null default '[]'::jsonb,
  emitted_fingerprints jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.noxia_tester_state enable row level security;
revoke all on public.noxia_tester_state from anon, authenticated;
grant select, insert, update, delete on public.noxia_tester_state to service_role;

comment on table public.noxia_tester_state is
  'Bounded persistent state for NOXIA_TESTER_INTELLIGENT_01. Disposable tester-* worlds only; service role only.';
