create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  equipment_key text not null,
  serial_number text not null unique,
  owner_profile_id uuid null references public.profiles(id) on delete set null,
  location_id uuid null references public.locations(id) on delete set null,
  inventory_id uuid null references public.logistics_inventories(id) on delete set null,
  installed_vehicle_id uuid null references public.vehicle_instances(id) on delete set null,
  status text not null default 'stored' check (status in ('stored','installed','maintenance','reserved','retired')),
  condition smallint not null default 100 check (condition between 0 and 100),
  wear smallint not null default 0 check (wear between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_items_single_placement check (
    (inventory_id is not null and installed_vehicle_id is null)
    or (inventory_id is null and installed_vehicle_id is not null)
    or (status = 'retired' and inventory_id is null and installed_vehicle_id is null)
  )
);

create index if not exists equipment_items_inventory_key_idx
  on public.equipment_items(inventory_id, equipment_key, status);
create index if not exists equipment_items_vehicle_idx
  on public.equipment_items(installed_vehicle_id, equipment_key);
create index if not exists equipment_items_owner_idx
  on public.equipment_items(owner_profile_id, location_id);

alter table public.equipment_items enable row level security;

comment on table public.equipment_items is
  'Serialized physical equipment and replaceable modules. An item is either stored in a logistics inventory or installed on a vehicle.';

insert into public.logistics_inventories (
  location_id, inventory_kind, storage_kind, subject_type, subject_id, label,
  capacity, public_deposit, public_withdraw, active, metadata
)
select
  te.location_id,
  'facility',
  'native',
  'tile_entity',
  te.id,
  'Surface Workshop · Modullager',
  64,
  false,
  false,
  true,
  jsonb_build_object(
    'role','equipment_workshop',
    'ownerClass','STATE',
    'surfaceHub','stickney-alpha',
    'buildingType','surface_workshop',
    'equipmentClasses',jsonb_build_array('robot_module')
  )
from public.tile_entities te
join public.locations l on l.id = te.location_id
where l.slug = 'phobos'
  and te.entity_id = 'surface_workshop'
  and te.spatial_region_id = 'phobos-stickney-alpha'
on conflict (storage_kind, subject_type, subject_id) do update
set label = excluded.label,
    capacity = greatest(coalesce(public.logistics_inventories.capacity,0), excluded.capacity),
    active = true,
    metadata = public.logistics_inventories.metadata || excluded.metadata,
    updated_at = now();

with workshop as (
  select li.id as inventory_id, li.location_id
  from public.logistics_inventories li
  join public.tile_entities te on te.id = li.subject_id
  join public.locations l on l.id = li.location_id
  where l.slug = 'phobos'
    and te.entity_id = 'surface_workshop'
    and li.metadata->>'role' = 'equipment_workshop'
  limit 1
), starter(equipment_key, serial_number) as (
  values
    ('spectrometer-pack','STK-SP-SPECTROMETER-001'),
    ('ground-imaging-radar','STK-SP-GPR-001'),
    ('regolith-bucket','STK-SP-BUCKET-001'),
    ('reaction-canceling-auger','STK-SP-AUGER-001'),
    ('sealed-sample-hopper','STK-SP-HOPPER-001'),
    ('mass-balance-cell','STK-SP-MASSCELL-001'),
    ('tool-changer','STK-SP-TOOLCHANGER-001'),
    ('inspection-camera','STK-SP-INSPECTION-001'),
    ('spares-rack','STK-SP-SPARESRACK-001')
)
insert into public.equipment_items (
  equipment_key, serial_number, location_id, inventory_id, status, condition, wear, metadata
)
select
  s.equipment_key,
  s.serial_number,
  w.location_id,
  w.inventory_id,
  'stored',
  100,
  0,
  jsonb_build_object(
    'equipmentClass','robot_module',
    'replaceable',true,
    'ownerClass','STATE',
    'provenance','stickney-workshop-starter-spares-v1'
  )
from starter s cross join workshop w
on conflict (serial_number) do nothing;

create or replace function public.noxia_retrofit_robot_equipment(
  p_profile_id uuid,
  p_vehicle_id uuid,
  p_workshop_inventory_id uuid,
  p_target_role text,
  p_current_equipment_keys text[],
  p_target_equipment_keys text[],
  p_vehicle_modules jsonb,
  p_vehicle_energy jsonb,
  p_cargo_capacity_t integer,
  p_modifications jsonb,
  p_emergent_state jsonb,
  p_energy_cost integer,
  p_component_cost integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.vehicle_instances%rowtype;
  v_workshop public.logistics_inventories%rowtype;
  v_energy_id uuid;
  v_energy_stock integer;
  v_component_id uuid;
  v_component_stock integer;
  v_key text;
  v_item_id uuid;
  v_now timestamptz := now();
  v_removed jsonb := '[]'::jsonb;
  v_installed jsonb := '[]'::jsonb;
begin
  select * into v_vehicle
  from public.vehicle_instances
  where id = p_vehicle_id and owner_profile_id = p_profile_id
  for update;
  if not found then raise exception 'vehicle_not_found'; end if;
  if v_vehicle.status <> 'ready' then raise exception 'vehicle_not_ready'; end if;

  select * into v_workshop
  from public.logistics_inventories
  where id = p_workshop_inventory_id and active = true
  for update;
  if not found or v_workshop.location_id is distinct from v_vehicle.location_id
     or v_workshop.metadata->>'role' <> 'equipment_workshop' then
    raise exception 'workshop_not_available';
  end if;

  select id, stock into v_energy_id, v_energy_stock
  from public.resources
  where location_id = v_vehicle.location_id and resource = 'energy'
  for update;
  select id, stock into v_component_id, v_component_stock
  from public.resources
  where location_id = v_vehicle.location_id and resource = 'components'
  for update;
  if v_energy_id is null or v_component_id is null then raise exception 'resource_rows_missing'; end if;
  if v_energy_stock < p_energy_cost or v_component_stock < p_component_cost then raise exception 'insufficient_resources'; end if;

  foreach v_key in array coalesce(p_current_equipment_keys, array[]::text[]) loop
    if not exists (
      select 1 from public.equipment_items
      where installed_vehicle_id = p_vehicle_id and equipment_key = v_key and status = 'installed'
    ) then
      insert into public.equipment_items (
        equipment_key, serial_number, owner_profile_id, location_id, installed_vehicle_id,
        status, condition, wear, metadata
      ) values (
        v_key,
        'AUTO-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),
        p_profile_id,
        v_vehicle.location_id,
        p_vehicle_id,
        'installed',
        greatest(35, v_vehicle.condition),
        least(100, v_vehicle.wear),
        jsonb_build_object('equipmentClass','robot_module','replaceable',true,'provenance','vehicle-module-identity-backfill-v1')
      );
    end if;
  end loop;

  for v_item_id, v_key in
    select id, equipment_key
    from public.equipment_items
    where installed_vehicle_id = p_vehicle_id
      and status = 'installed'
      and not (equipment_key = any(coalesce(p_target_equipment_keys,array[]::text[])))
    for update
  loop
    update public.equipment_items
    set installed_vehicle_id = null,
        inventory_id = p_workshop_inventory_id,
        owner_profile_id = null,
        status = 'stored',
        updated_at = v_now,
        metadata = metadata || jsonb_build_object('lastRemovedFromVehicleId',p_vehicle_id,'lastRemovedAt',v_now)
    where id = v_item_id;
    v_removed := v_removed || jsonb_build_array(jsonb_build_object('id',v_item_id,'equipmentKey',v_key));
  end loop;

  foreach v_key in array coalesce(p_target_equipment_keys,array[]::text[]) loop
    if exists (
      select 1 from public.equipment_items
      where installed_vehicle_id = p_vehicle_id and equipment_key = v_key and status = 'installed'
    ) then continue; end if;

    v_item_id := null;
    select id into v_item_id
    from public.equipment_items
    where inventory_id = p_workshop_inventory_id
      and equipment_key = v_key
      and status = 'stored'
      and condition >= 35
      and wear <= 80
    order by condition desc, wear asc, created_at asc
    for update skip locked
    limit 1;
    if v_item_id is null then raise exception 'module_unavailable:%', v_key; end if;

    update public.equipment_items
    set inventory_id = null,
        installed_vehicle_id = p_vehicle_id,
        owner_profile_id = p_profile_id,
        status = 'installed',
        updated_at = v_now,
        metadata = metadata || jsonb_build_object('lastInstalledVehicleId',p_vehicle_id,'lastInstalledAt',v_now)
    where id = v_item_id;
    v_installed := v_installed || jsonb_build_array(jsonb_build_object('id',v_item_id,'equipmentKey',v_key));
  end loop;

  update public.resources set stock = stock - p_energy_cost, updated_at = v_now where id = v_energy_id;
  update public.resources set stock = stock - p_component_cost, updated_at = v_now where id = v_component_id;

  update public.vehicle_instances
  set modules = p_vehicle_modules,
      energy = p_vehicle_energy,
      cargo_capacity_t = p_cargo_capacity_t,
      modifications = p_modifications,
      emergent_state = p_emergent_state,
      updated_at = v_now
  where id = p_vehicle_id;

  return jsonb_build_object(
    'ok',true,
    'vehicleId',p_vehicle_id,
    'targetRole',p_target_role,
    'removed',v_removed,
    'installed',v_installed,
    'energyCost',p_energy_cost,
    'componentCost',p_component_cost
  );
end;
$$;

revoke all on function public.noxia_retrofit_robot_equipment(uuid,uuid,uuid,text,text[],text[],jsonb,jsonb,integer,jsonb,jsonb,integer,integer) from public;
grant execute on function public.noxia_retrofit_robot_equipment(uuid,uuid,uuid,text,text[],text[],jsonb,jsonb,integer,jsonb,jsonb,integer,integer) to service_role;
