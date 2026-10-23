-- Reconcile canonical knowledge state/RPCs for fresh database replays.
-- 2026-10-23
--
-- Hosted production historically received these definitions outside the active
-- repository baseline. Recreate the current production contract explicitly so a
-- fresh Supabase branch reaches the same schema instead of depending on remote
-- migration history.

set search_path to public;

alter table public.profiles
  add column if not exists knowledge_points integer not null default 0;

create or replace function public.get_knowledge_level(p_points integer)
returns public.knowledge_levels
language sql
stable
set search_path = public, pg_temp
as $function$
  select * from public.knowledge_levels
  where min_points <= p_points
    and (max_points is null or max_points >= p_points)
  limit 1;
$function$;

create or replace function public.award_knowledge(
  p_profile_id uuid,
  p_amount integer,
  p_reason text,
  p_task_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_new_total integer;
begin
  insert into public.knowledge_transactions (profile_id, amount, reason, task_id)
  values (p_profile_id, p_amount, p_reason, p_task_id);

  update public.profiles
  set knowledge_points = greatest(0, knowledge_points + p_amount)
  where id = p_profile_id
  returning knowledge_points into v_new_total;

  return v_new_total;
end;
$function$;

revoke all on function public.award_knowledge(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.award_knowledge(uuid, integer, text, text)
  to service_role;

-- Read helper only; preserve PostgreSQL default execution semantics while pinning
-- search_path. It does not mutate authoritative state.
alter function public.get_knowledge_level(integer)
  set search_path = public, pg_temp;

comment on function public.award_knowledge(uuid, integer, text, text) is
  'Server-authoritative knowledge award RPC reconciled from the canonical production contract for fresh database replays.';
