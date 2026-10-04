create table if not exists public.role_wage_rates (
  role_code text primary key,
  daily_credits integer not null check (daily_credits between 1 and 10000),
  updated_at timestamptz not null default now()
);

alter table public.role_wage_rates enable row level security;
revoke all on public.role_wage_rates from anon, authenticated;
grant select, insert, update, delete on public.role_wage_rates to service_role;

drop policy if exists role_wage_rates_service on public.role_wage_rates;
create policy role_wage_rates_service
on public.role_wage_rates
for all to service_role
using (true)
with check (true);

insert into public.role_wage_rates(role_code,daily_credits) values
  ('resident',45),('service',55),('logistics',65),('operator',70),
  ('administrator',70),('trader',70),('technician',75),
  ('systems_technician',80),('data_analyst',80),('educator',70),
  ('researcher',80),('author_researcher',80),('geologist',80),
  ('scientist',85),('sensor_operator',75),('engineer',90),
  ('helioscorp_liaison',90),('operations_lead',100),
  ('rover_operations_lead',100),('infrastructure_coordinator',100),
  ('fabrication_center_lead',105),('geology_lab_lead',105),
  ('water_life_support_lead',110),('medical_center_lead',110)
on conflict (role_code) do update
set daily_credits=excluded.daily_credits, updated_at=now();

create or replace function public.run_npc_payroll(p_tick bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_result jsonb;
  v_paid integer := 0;
  v_duplicates integer := 0;
  v_insufficient integer := 0;
  v_total integer := 0;
begin
  if p_tick is null or p_tick < 0 then
    raise exception 'NOXIA_PAYROLL_TICK_INVALID';
  end if;

  if mod(p_tick, 24) <> 0 then
    return jsonb_build_object('ok',true,'due',false,'paid',0,'duplicates',0,'insufficient',0,'total_credits',0);
  end if;

  for v_row in
    select pa.id assignment_id, pa.person_id, pa.employer_actor_id, wr.daily_credits
    from public.person_assignments pa
    join public.role_wage_rates wr on wr.role_code=pa.role_code
    where pa.assignment_type='work'
      and pa.is_active=true
      and pa.employer_actor_id is not null
      and (pa.starts_tick is null or pa.starts_tick<=p_tick)
      and (pa.ends_tick is null or pa.ends_tick>p_tick)
    order by pa.employer_actor_id, pa.id
  loop
    begin
      v_result := public.pay_npc_wage(v_row.employer_actor_id,v_row.person_id,v_row.assignment_id,v_row.daily_credits,p_tick);
      if coalesce((v_result->>'duplicate')::boolean,false) then
        v_duplicates := v_duplicates+1;
      elsif coalesce((v_result->>'amount')::integer,0)>0 then
        v_paid := v_paid+1;
        v_total := v_total+coalesce((v_result->>'amount')::integer,0);
      end if;
    exception
      when others then
        if sqlerrm like '%NOXIA_EMPLOYER_CREDITS_INSUFFICIENT%' then
          v_insufficient := v_insufficient+1;
        else
          raise;
        end if;
    end;
  end loop;

  return jsonb_build_object('ok',true,'due',true,'paid',v_paid,'duplicates',v_duplicates,'insufficient',v_insufficient,'total_credits',v_total);
end;
$$;

revoke all on function public.run_npc_payroll(bigint) from public;
revoke all on function public.run_npc_payroll(bigint) from anon;
revoke all on function public.run_npc_payroll(bigint) from authenticated;
grant execute on function public.run_npc_payroll(bigint) to service_role;
