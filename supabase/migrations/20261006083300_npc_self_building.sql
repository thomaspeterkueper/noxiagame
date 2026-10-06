-- NPC self-building: service-only actor construction queue.
-- Runtime uses existing building_definitions and tile_entities; no parallel ownership model.

create table if not exists public.npc_builds (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  actor_id uuid not null references public.actors(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  buildable_id text not null,
  cost_credits integer not null check (cost_credits >= 0),
  tile_level smallint not null default 0 check (tile_level between -3 and 0),
  tile_row smallint not null,
  tile_col smallint not null,
  status text not null default 'building' check (status in ('building','completed','cancelled')),
  started_tick bigint not null,
  completes_tick bigint not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(location_id,tile_level,tile_row,tile_col,status)
);
create index if not exists npc_builds_due_idx on public.npc_builds(status,completes_tick) where status='building';
create index if not exists npc_builds_actor_idx on public.npc_builds(actor_id,status);
alter table public.npc_builds enable row level security;
revoke all on public.npc_builds from anon, authenticated;
grant all on public.npc_builds to service_role;

create or replace function public.run_npc_self_build(p_tick bigint)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_person record; v_def record; v_balance numeric; v_daily_wage integer; v_reserve integer;
  v_row integer; v_col integer; v_build_id uuid;
  v_started integer:=0; v_no_money integer:=0; v_no_site integer:=0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_NPC_BUILD_TICK_INVALID'; end if;
  if mod(p_tick,72) <> 0 then return jsonb_build_object('ok',true,'due',false,'started',0,'no_money',0,'no_site',0); end if;
  select key,cost_credits,build_time_ticks,allowed_locations into v_def
  from public.building_definitions where key='habitat' and is_active=true and cost_credits>0 limit 1;
  if not found then return jsonb_build_object('ok',false,'due',true,'reason','habitat_definition_missing','started',0); end if;

  for v_person in
    select distinct on (p.id) p.id person_id,p.current_location_id,pea.actor_id,pa.role_code,l.slug location_slug
    from public.people p
    join public.person_economic_actors pea on pea.person_id=p.id
    join public.person_assignments pa on pa.person_id=p.id and pa.assignment_type='work' and pa.is_active=true
    join public.locations l on l.id=p.current_location_id
    left join public.person_life_state pls on pls.person_id=p.id
    where coalesce(pls.life_stage,'adult')='adult' and p.current_location_id is not null
      and (v_def.allowed_locations is null or l.slug=any(v_def.allowed_locations))
      and not exists (select 1 from public.tile_entities te where te.actor_id=pea.actor_id and te.owner_class='NPC'
        and te.entity_type='building' and te.entity_id in ('habitat','residential_block','habitat_cluster'))
      and not exists (select 1 from public.npc_builds nb where nb.actor_id=pea.actor_id and nb.status='building')
      and not exists (
        select 1 from public.tile_entities te
        where te.location_id=p.current_location_id and te.entity_type='building'
          and te.entity_id in ('habitat','residential_block','habitat_cluster')
          and te.status='active' and te.asking_price is not null and te.asking_price>0
          and te.asking_price <= (select coalesce(sum(nl.credit_delta),0) from public.npc_ledger nl where nl.actor_id=pea.actor_id)
             - coalesce((select rr.daily_credits*7 from public.role_wage_rates rr where rr.role_code=pa.role_code),0)
      )
    order by p.id,pa.created_at
  loop
    select daily_credits into v_daily_wage from public.role_wage_rates where role_code=v_person.role_code;
    if v_daily_wage is null then continue; end if;
    v_reserve:=v_daily_wage*7;
    select coalesce(sum(credit_delta),0) into v_balance from public.npc_ledger where actor_id=v_person.actor_id;
    if v_balance < v_def.cost_credits+v_reserve then v_no_money:=v_no_money+1; continue; end if;

    v_row:=null; v_col:=null;
    select s.r,s.c into v_row,v_col
    from (select r,c from generate_series(0,23) r cross join generate_series(0,31) c
          order by md5(v_person.person_id::text||':'||r::text||':'||c::text)) s
    where not exists (select 1 from public.tile_entities te where te.location_id=v_person.current_location_id
      and te.tile_level=0 and te.tile_row=s.r and te.tile_col=s.c and te.entity_type='building')
      and not exists (select 1 from public.player_builds pb where pb.location_id=v_person.current_location_id
        and pb.tile_level=0 and pb.tile_row=s.r and pb.tile_col=s.c and pb.status in ('building','selling'))
      and not exists (select 1 from public.npc_builds nb where nb.location_id=v_person.current_location_id
        and nb.tile_level=0 and nb.tile_row=s.r and nb.tile_col=s.c and nb.status='building')
    limit 1;
    if v_row is null then v_no_site:=v_no_site+1; continue; end if;

    insert into public.npc_builds(person_id,actor_id,location_id,buildable_id,cost_credits,tile_level,tile_row,tile_col,status,started_tick,completes_tick)
    values(v_person.person_id,v_person.actor_id,v_person.current_location_id,v_def.key,v_def.cost_credits,0,v_row,v_col,'building',p_tick,p_tick+greatest(1,v_def.build_time_ticks))
    on conflict do nothing returning id into v_build_id;
    if v_build_id is null then continue; end if;
    insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
    values(v_person.actor_id,p_tick,'property_purchase',0,-v_def.cost_credits,v_person.current_location_id,
           'npc_build:'||v_build_id::text,'Baukosten: '||v_def.key)
    on conflict do nothing;
    v_started:=v_started+1;
  end loop;
  return jsonb_build_object('ok',true,'due',true,'started',v_started,'no_money',v_no_money,'no_site',v_no_site);
end $$;

create or replace function public.complete_due_npc_builds(p_tick bigint)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_build record; v_entity_id uuid; v_completed integer:=0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_NPC_BUILD_TICK_INVALID'; end if;
  for v_build in select * from public.npc_builds where status='building' and completes_tick<=p_tick
    order by completes_tick,id for update skip locked
  loop
    insert into public.tile_entities(profile_id,location_id,tile_level,tile_row,tile_col,entity_type,entity_id,
      condition,status,is_state_owned,actor_id,owner_class,owner_id,placement_mode,terrain_status)
    values(null,v_build.location_id,v_build.tile_level,v_build.tile_row,v_build.tile_col,'building',v_build.buildable_id,
      100,'active',false,v_build.actor_id,'NPC',v_build.actor_id,'legacy_tile','origin_pending')
    returning id into v_entity_id;
    update public.npc_builds set status='completed',completed_at=now() where id=v_build.id and status='building';
    v_completed:=v_completed+1;
  end loop;
  return jsonb_build_object('ok',true,'completed',v_completed);
end $$;

revoke all on function public.run_npc_self_build(bigint) from public,anon,authenticated;
grant execute on function public.run_npc_self_build(bigint) to service_role;
revoke all on function public.complete_due_npc_builds(bigint) from public,anon,authenticated;
grant execute on function public.complete_due_npc_builds(bigint) to service_role;
