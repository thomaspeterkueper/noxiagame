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

create or replace function public.pay_npc_wage(
  p_employer_actor_id uuid,
  p_person_id uuid,
  p_assignment_id uuid,
  p_amount integer,
  p_tick bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $
declare
  v_employee_actor_id uuid;
  v_person_name text;
  v_location_id uuid;
  v_employer_credits numeric;
  v_employee_credits numeric;
  v_ref text;
begin
  if p_amount is null or p_amount < 1 or p_amount > 10000 then
    raise exception 'NOXIA_WAGE_AMOUNT_INVALID';
  end if;

  perform 1 from public.actors where id = p_employer_actor_id for update;
  if not found then raise exception 'NOXIA_EMPLOYER_NOT_FOUND'; end if;

  select p.display_name, pa.location_id
    into v_person_name, v_location_id
  from public.people p
  join public.person_assignments pa on pa.person_id = p.id
  where p.id = p_person_id
    and pa.id = p_assignment_id
    and pa.assignment_type = 'work'
    and pa.is_active = true
    and pa.employer_actor_id = p_employer_actor_id
  for update of p, pa;

  if not found then raise exception 'NOXIA_WORK_ASSIGNMENT_INVALID'; end if;

  select coalesce(sum(credit_delta),0)
    into v_employer_credits
  from public.npc_ledger
  where actor_id = p_employer_actor_id;

  if v_employer_credits < p_amount then
    raise exception 'NOXIA_EMPLOYER_CREDITS_INSUFFICIENT';
  end if;

  select actor_id into v_employee_actor_id
  from public.person_economic_actors
  where person_id = p_person_id;

  if v_employee_actor_id is null then
    insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
    values (
      'npc_person',
      v_person_name,
      'Persönlicher Wirtschaftsakteur der Living Population.',
      '{}'::jsonb,
      '{}'::jsonb
    )
    returning id into v_employee_actor_id;

    insert into public.person_economic_actors(person_id, actor_id)
    values (p_person_id, v_employee_actor_id);
  end if;

  v_ref := 'assignment:' || p_assignment_id::text;

  insert into public.npc_ledger(
    actor_id, tick, kind, resource, goods_delta, credit_delta,
    location_id, ref, note
  ) values (
    p_employer_actor_id, p_tick, 'wage', null, 0, -p_amount,
    v_location_id, v_ref, 'Lohnzahlung an ' || v_person_name
  )
  on conflict do nothing;

  if not found then
    select coalesce(sum(credit_delta),0) into v_employee_credits
    from public.npc_ledger where actor_id = v_employee_actor_id;
    return jsonb_build_object(
      'ok', true, 'duplicate', true, 'amount', 0,
      'employee_actor_id', v_employee_actor_id,
      'employee_credits', v_employee_credits,
      'employer_credits', v_employer_credits
    );
  end if;

  insert into public.npc_ledger(
    actor_id, tick, kind, resource, goods_delta, credit_delta,
    location_id, ref, note
  ) values (
    v_employee_actor_id, p_tick, 'wage', null, 0, p_amount,
    v_location_id, v_ref, 'Lohn für Arbeitszuweisung'
  )
  on conflict do nothing;

  select coalesce(sum(credit_delta),0) into v_employee_credits
  from public.npc_ledger where actor_id = v_employee_actor_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'amount', p_amount,
    'employee_actor_id', v_employee_actor_id,
    'employee_credits', v_employee_credits,
    'employer_credits', v_employer_credits - p_amount
  );
end;
$;

revoke all on function public.pay_npc_wage(uuid,uuid,uuid,integer,bigint) from public;
revoke all on function public.pay_npc_wage(uuid,uuid,uuid,integer,bigint) from anon;
revoke all on function public.pay_npc_wage(uuid,uuid,uuid,integer,bigint) from authenticated;
grant execute on function public.pay_npc_wage(uuid,uuid,uuid,integer,bigint) to service_role;

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
