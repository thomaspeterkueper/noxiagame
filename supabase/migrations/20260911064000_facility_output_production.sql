-- NOXIA facility-output production boundary
-- 2026-09-11
--
-- Moves newly produced goods into addressable native facility inventories without
-- retroactively reassigning legacy aggregate location stock. Credits are idempotent
-- per simulation tick, physical facility and resource.

set search_path to public;

create table if not exists public.facility_production_commands (
  id uuid primary key default gen_random_uuid(),
  tick_number bigint not null,
  tile_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  inventory_id uuid not null references public.logistics_inventories(id) on delete cascade,
  resource public.resource_type not null,
  amount integer not null,
  amount_after integer not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint facility_production_amount_check check (amount > 0),
  constraint facility_production_tick_check check (tick_number >= 0),
  constraint facility_production_commands_tick_entity_resource_key
    unique (tick_number, tile_entity_id, resource)
);

create index if not exists facility_production_inventory_tick_idx
  on public.facility_production_commands(inventory_id, tick_number desc);
create index if not exists facility_production_tile_entity_tick_idx
  on public.facility_production_commands(tile_entity_id, tick_number desc);

alter table public.facility_production_commands enable row level security;
revoke all on table public.facility_production_commands from public, anon, authenticated;
grant select, insert, update, delete on table public.facility_production_commands to service_role;

create or replace function public.noxia_credit_facility_output(
  p_tick_number bigint,
  p_tile_entity_id uuid,
  p_resource public.resource_type,
  p_amount integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_entity public.tile_entities%rowtype;
  v_inventory public.logistics_inventories%rowtype;
  v_command public.facility_production_commands%rowtype;
  v_command_id uuid;
  v_capacity integer;
  v_total integer;
  v_after integer;
  v_result jsonb;
begin
  if p_tick_number is null or p_tick_number < 0
     or p_tile_entity_id is null
     or p_resource is null
     or p_amount is null or p_amount <= 0 then
    raise exception 'NOXIA_FACILITY_PRODUCTION_INVALID_ARGUMENT' using errcode = 'P0001';
  end if;

  -- Fast idempotency path for ordinary retries.
  select * into v_command
  from public.facility_production_commands
  where tick_number = p_tick_number
    and tile_entity_id = p_tile_entity_id
    and resource = p_resource;
  if found then
    return v_command.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_entity
  from public.tile_entities
  where id = p_tile_entity_id
    and entity_type = 'building'
  for update;
  if not found then
    raise exception 'NOXIA_FACILITY_NOT_FOUND:%', p_tile_entity_id using errcode = 'P0001';
  end if;

  select * into v_inventory
  from public.logistics_inventories
  where active
    and inventory_kind = 'facility'
    and storage_kind = 'native'
    and subject_type = 'tile_entity'
    and subject_id = p_tile_entity_id
  for update;
  if not found then
    raise exception 'NOXIA_FACILITY_OUTPUT_INVENTORY_NOT_FOUND:%', p_tile_entity_id using errcode = 'P0001';
  end if;

  -- Claim this exact physical output credit before mutating stock. ON CONFLICT
  -- serializes concurrent retries; the whole row is rolled back if a later check fails.
  v_command_id := gen_random_uuid();
  insert into public.facility_production_commands(
    id, tick_number, tile_entity_id, inventory_id, resource, amount, amount_after, result
  ) values (
    v_command_id, p_tick_number, p_tile_entity_id, v_inventory.id, p_resource, p_amount, 0, '{}'::jsonb
  )
  on conflict (tick_number, tile_entity_id, resource) do nothing
  returning id into v_command_id;

  if v_command_id is null then
    select * into v_command
    from public.facility_production_commands
    where tick_number = p_tick_number
      and tile_entity_id = p_tile_entity_id
      and resource = p_resource;
    return v_command.result || jsonb_build_object('idempotent', true);
  end if;

  v_capacity := public.noxia_inventory_capacity(v_inventory.id);
  if v_capacity is not null then
    v_total := public.noxia_inventory_total_amount(v_inventory.id);
    if v_total + p_amount > v_capacity then
      raise exception 'NOXIA_FACILITY_OUTPUT_CAPACITY_INSUFFICIENT:%:%', v_capacity, v_total
        using errcode = 'P0001';
    end if;
  end if;

  v_after := public.noxia_adjust_inventory_amount(v_inventory.id, p_resource, p_amount);
  v_result := jsonb_build_object(
    'tickNumber', p_tick_number,
    'tileEntityId', p_tile_entity_id,
    'inventoryId', v_inventory.id,
    'locationId', v_entity.location_id,
    'resource', p_resource,
    'amount', p_amount,
    'amountAfter', v_after,
    'idempotent', false
  );

  update public.facility_production_commands
  set amount_after = v_after, result = v_result
  where id = v_command_id;

  insert into public.simulation_events(
    event_type, subject_type, subject_id, actor_id, location_id, tick, effects, metadata, occurred_at
  ) values (
    'facility.production_credited',
    'tile_entity',
    v_entity.id,
    coalesce(v_entity.profile_id, v_entity.actor_id),
    v_entity.location_id,
    p_tick_number,
    jsonb_build_array(jsonb_build_object(
      'type', 'inventory_credit',
      'inventoryId', v_inventory.id,
      'resource', p_resource,
      'amount', p_amount,
      'amountAfter', v_after
    )),
    jsonb_build_object('source', 'facility_output_tick'),
    now()
  );

  return v_result;
end;
$$;

revoke all on function public.noxia_credit_facility_output(bigint, uuid, public.resource_type, integer)
  from public, anon, authenticated;
grant execute on function public.noxia_credit_facility_output(bigint, uuid, public.resource_type, integer)
  to service_role;

comment on table public.facility_production_commands is
  'Idempotency ledger for physical facility output credits. One credit per tick, facility and resource.';
comment on function public.noxia_credit_facility_output(bigint, uuid, public.resource_type, integer) is
  'Credits new production to the native facility inventory exactly once per tick/resource.';
