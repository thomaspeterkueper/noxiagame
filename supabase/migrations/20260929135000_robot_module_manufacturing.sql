create table if not exists public.equipment_manufacturing_commands (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  workshop_inventory_id uuid not null references public.logistics_inventories(id) on delete cascade,
  equipment_key text not null,
  required_unlocks text[] not null default '{}',
  metal_cost integer not null check (metal_cost >= 0),
  component_cost integer not null check (component_cost >= 0),
  energy_cost integer not null check (energy_cost >= 0),
  status text not null default 'running' check (status in ('running','completed','failed')),
  requested_at timestamptz not null default now(),
  completes_at timestamptz not null,
  completed_at timestamptz,
  output_equipment_id uuid references public.equipment_items(id) on delete set null,
  recipe_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  error text
);

create index if not exists equipment_manufacturing_commands_profile_idx
  on public.equipment_manufacturing_commands(profile_id, status, requested_at desc);
create index if not exists equipment_manufacturing_commands_due_idx
  on public.equipment_manufacturing_commands(status, completes_at);

alter table public.equipment_manufacturing_commands enable row level security;

create or replace function public.noxia_start_equipment_manufacturing(
  p_profile_id uuid,
  p_location_id uuid,
  p_workshop_inventory_id uuid,
  p_equipment_key text,
  p_required_unlocks text[],
  p_metal_cost integer,
  p_component_cost integer,
  p_energy_cost integer,
  p_duration_seconds integer,
  p_recipe_version text,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.equipment_manufacturing_commands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command public.equipment_manufacturing_commands;
  v_missing text;
  v_metal integer;
  v_components integer;
  v_energy integer;
begin
  if p_duration_seconds < 1 then raise exception 'INVALID_DURATION'; end if;

  if not exists (
    select 1 from public.logistics_inventories li
    where li.id=p_workshop_inventory_id and li.location_id=p_location_id and li.active=true
      and li.inventory_kind='facility' and li.metadata->>'role'='equipment_workshop'
  ) then raise exception 'WORKSHOP_UNAVAILABLE'; end if;

  select req into v_missing
  from unnest(coalesce(p_required_unlocks,'{}'::text[])) req
  where not exists (
    select 1 from public.player_unlocks pu
    where pu.profile_id=p_profile_id and pu.unlock_id=req
      and (pu.expires_at is null or pu.expires_at > now())
  ) limit 1;
  if v_missing is not null then raise exception 'MISSING_UNLOCK:%', v_missing; end if;

  select stock into v_metal from public.location_resources where location_id=p_location_id and resource='metal' for update;
  select stock into v_components from public.location_resources where location_id=p_location_id and resource='components' for update;
  select stock into v_energy from public.location_resources where location_id=p_location_id and resource='energy' for update;
  if coalesce(v_metal,0) < p_metal_cost then raise exception 'INSUFFICIENT_METAL'; end if;
  if coalesce(v_components,0) < p_component_cost then raise exception 'INSUFFICIENT_COMPONENTS'; end if;
  if coalesce(v_energy,0) < p_energy_cost then raise exception 'INSUFFICIENT_ENERGY'; end if;

  update public.location_resources set stock=stock-p_metal_cost, updated_at=now() where location_id=p_location_id and resource='metal';
  update public.location_resources set stock=stock-p_component_cost, updated_at=now() where location_id=p_location_id and resource='components';
  update public.location_resources set stock=stock-p_energy_cost, updated_at=now() where location_id=p_location_id and resource='energy';

  insert into public.equipment_manufacturing_commands(
    idempotency_key,profile_id,location_id,workshop_inventory_id,equipment_key,required_unlocks,
    metal_cost,component_cost,energy_cost,completes_at,recipe_version,metadata
  ) values (
    p_idempotency_key,p_profile_id,p_location_id,p_workshop_inventory_id,p_equipment_key,coalesce(p_required_unlocks,'{}'::text[]),
    p_metal_cost,p_component_cost,p_energy_cost,now()+make_interval(secs=>p_duration_seconds),p_recipe_version,coalesce(p_metadata,'{}'::jsonb)
  ) returning * into v_command;
  return v_command;
exception when unique_violation then
  if p_idempotency_key is not null then
    select * into v_command from public.equipment_manufacturing_commands where idempotency_key=p_idempotency_key;
    return v_command;
  end if;
  raise;
end;
$$;

create or replace function public.noxia_finalize_equipment_manufacturing(p_profile_id uuid)
returns setof public.equipment_manufacturing_commands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.equipment_manufacturing_commands;
  v_item_id uuid;
  v_serial text;
begin
  for v_job in
    select * from public.equipment_manufacturing_commands
    where profile_id=p_profile_id and status='running' and completes_at<=now()
    order by completes_at
    for update skip locked
  loop
    v_serial := upper('MFG-' || replace(v_job.equipment_key,'-','') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,10));
    insert into public.equipment_items(
      equipment_key,serial_number,owner_profile_id,location_id,inventory_id,status,condition,wear,metadata
    ) values (
      v_job.equipment_key,v_serial,null,v_job.location_id,v_job.workshop_inventory_id,'stored',100,0,
      jsonb_build_object('provenance','manufactured','recipeVersion',v_job.recipe_version,'manufacturingCommandId',v_job.id,'manufacturedBy',p_profile_id)
    ) returning id into v_item_id;

    update public.equipment_manufacturing_commands
    set status='completed',completed_at=now(),output_equipment_id=v_item_id,
        metadata=metadata || jsonb_build_object('serialNumber',v_serial)
    where id=v_job.id
    returning * into v_job;
    return next v_job;
  end loop;
  return;
end;
$$;

revoke all on function public.noxia_start_equipment_manufacturing(uuid,uuid,uuid,text,text[],integer,integer,integer,integer,text,text,jsonb) from public;
revoke all on function public.noxia_finalize_equipment_manufacturing(uuid) from public;
grant execute on function public.noxia_start_equipment_manufacturing(uuid,uuid,uuid,text,text[],integer,integer,integer,integer,text,text,jsonb) to service_role;
grant execute on function public.noxia_finalize_equipment_manufacturing(uuid) to service_role;
