-- Authoritative, replay-safe observation intake for NPC habits.
-- A caller must provide an event id only after the owning action adapter confirms execution.
create table if not exists public.person_habit_outcomes (
  source_event_id uuid primary key references public.population_events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  context_key text not null check (length(context_key) between 1 and 160),
  action text not null,
  successful boolean not null,
  tick bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists person_habit_outcomes_person_tick_idx on public.person_habit_outcomes(person_id,tick);
alter table public.person_habit_outcomes enable row level security;
revoke all on public.person_habit_outcomes from anon,authenticated;

-- The primary key rejects duplicate event intake. All aggregation happens in the same transaction.
create or replace function public.record_person_habit_outcome(
 p_event_id uuid,p_person_id uuid,p_context_key text,p_action text,p_successful boolean,p_tick bigint
) returns boolean language plpgsql security invoker set search_path=public as $$
declare n integer; r public.person_habits%rowtype; v_repetitions integer; v_successes integer;
begin
 if p_context_key is null or length(p_context_key) not between 1 and 160 then raise exception 'invalid context'; end if;
 -- Serialized by person/context/action, including first observation.
 perform pg_advisory_xact_lock(hashtextextended(p_person_id::text||':'||p_context_key||':'||p_action,0));
 insert into public.person_habit_outcomes(source_event_id,person_id,context_key,action,successful,tick)
 select p_event_id,p_person_id,p_context_key,p_action,p_successful,p_tick
 where exists (select 1 from public.population_events e where e.id=p_event_id and e.actor_person_id=p_person_id and e.tick=p_tick)
 on conflict (source_event_id) do nothing;
 get diagnostics n=row_count;
 if n=0 then return false; end if;
 select * into r from public.person_habits where person_id=p_person_id and context_key=p_context_key and action=p_action;
 v_repetitions=coalesce(r.repetitions,0)+1;
 v_successes=coalesce(r.successes,0)+case when p_successful then 1 else 0 end;
 insert into public.person_habits(person_id,context_key,action,repetitions,successes,strength,success_expectation,last_tick,updated_at)
 values(p_person_id,p_context_key,p_action,v_repetitions,v_successes,round((1-exp(-v_repetitions::numeric/8))::numeric,6),round((v_successes::numeric/v_repetitions),6),p_tick,now())
 on conflict(person_id,context_key,action) do update set repetitions=excluded.repetitions,successes=excluded.successes,strength=excluded.strength,success_expectation=excluded.success_expectation,last_tick=greatest(public.person_habits.last_tick,excluded.last_tick),updated_at=now();
 return true;
end $$;
revoke all on function public.record_person_habit_outcome(uuid,uuid,text,text,boolean,bigint) from public,anon,authenticated;
grant execute on function public.record_person_habit_outcome(uuid,uuid,text,text,boolean,bigint) to service_role;
