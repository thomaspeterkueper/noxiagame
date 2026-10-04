alter table public.npc_player_conversation_memory
  add column if not exists recent_encounter_score numeric not null default 0 check (recent_encounter_score between 0 and 1),
  add column if not exists last_encounter_at timestamptz;
