-- Non-textual causal evidence per NPC conversation turn.
create table if not exists public.npc_conversation_causal_traces(
 id bigint generated always as identity primary key,
 correlation_id uuid not null,
 conversation_log_id bigint references public.npc_conversation_log(id) on delete cascade,
 player_profile_id uuid not null references auth.users(id) on delete cascade,
 npc_person_id uuid,
 stage text not null check(stage in ('classified','model_response','memory_write','name_knowledge_write','identity_knowledge_write','age_knowledge_write','testimony_write','wish_scheduled','action_proposed','conversation_logged','error')),
 status text not null check(status in ('observed','proposed','succeeded','failed','not_confirmed')),
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists npc_causal_log_idx on public.npc_conversation_causal_traces(conversation_log_id,created_at);
create index if not exists npc_causal_correlation_idx on public.npc_conversation_causal_traces(correlation_id,created_at);
alter table public.npc_conversation_causal_traces enable row level security;
revoke all on public.npc_conversation_causal_traces from public,anon,authenticated;
grant select,insert on public.npc_conversation_causal_traces to service_role;
-- Correlation ID belongs to the conversation row and cannot be used as a user-controlled lookup.
alter table public.npc_conversation_log add column if not exists correlation_id uuid;
create index if not exists npc_conversation_log_correlation_idx on public.npc_conversation_log(correlation_id);
