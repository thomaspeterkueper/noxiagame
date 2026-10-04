-- Persistent bounded memory for NPC × player conversations.
-- Server/service-role only: browser clients must not read or mutate this table.

create table if not exists public.npc_player_conversation_memory (
  id uuid primary key default gen_random_uuid(),
  npc_person_id uuid not null references public.people(id) on delete cascade,
  player_profile_id uuid not null references public.profiles(id) on delete cascade,
  encounter_count integer not null default 0 check (encounter_count >= 0),
  recent_exchanges jsonb not null default '[]'::jsonb,
  last_location text,
  first_interaction_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (npc_person_id, player_profile_id),
  check (jsonb_typeof(recent_exchanges) = 'array')
);

create index if not exists npc_player_conversation_memory_player_idx
  on public.npc_player_conversation_memory(player_profile_id, last_interaction_at desc);

create index if not exists npc_player_conversation_memory_npc_idx
  on public.npc_player_conversation_memory(npc_person_id, last_interaction_at desc);

alter table public.npc_player_conversation_memory enable row level security;

revoke all on public.npc_player_conversation_memory from anon, authenticated;
grant select, insert, update, delete on public.npc_player_conversation_memory to service_role;
