-- NOXIA Core: canonical native inventory provisioning for physical facilities
-- 2026-09-11
--
-- A physical logistics-capable tile_entity receives exactly one native inventory.
-- The policy is body-agnostic so Earth, Moon and Mars share the same mechanism.
-- Capacity stays NULL until an Engineering/balancing source defines a canonical value.

set search_path to public;

create table if not exists public.facility_inventory_policies (
  buildable_id text primary key,
  inventory_kind text not null,
  capacity integer,
  public_deposit boolean not null default false,
  public_withdraw boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facility_inventory_policy_kind_check check (
    inventory_kind = any (array['facility','depot','surface_port']::text[])
  ),
  constraint facility_inventory_policy_capacity_check check (capacity is null or capacity > 0)
);

alter table public.facility_inventory_policies enable row level security;
revoke all on table public.facility_inventory_policies from public, anon, authenticated;
grant select, insert, update, delete on table public.facility_inventory_policies to service_role;

-- Physical production / processing facilities. Energy-only producers are
-- intentionally absent: electricity is not modelled as loose cargo stock.
insert into public.facility_inventory_policies (
  buildable_id, inventory_kind, capacity, public_deposit, public_withdraw, metadata
) values
  ('mine',                   'facility',     null, false, false, '{"role":"extraction"}'::jsonb),
  ('factory',                'facility',     null, false, false, '{"role":"processing"}'::jsonb),
  ('ice_drill',              'facility',     null, false, false, '{"role":"extraction"}'::jsonb),
  ('water_recycler',         'facility',     null, false, false, '{"role":"processing"}'::jsonb),
  ('smelter',                'facility',     null, false, false, '{"role":"processing"}'::jsonb),
  ('water_isru',             'facility',     null, false, false, '{"role":"extraction"}'::jsonb),
  ('plant_module',           'facility',     null, false, false, '{"role":"production"}'::jsonb),
  ('workshop_clean',         'facility',     null, false, false, '{"role":"production"}'::jsonb),
  ('workshop_heavy',         'facility',     null, false, false, '{"role":"production"}'::jsonb),
  ('material_complex',       'facility',     null, false, false, '{"role":"processing"}'::jsonb),
  ('shipyard',               'facility',     null, false, false, '{"role":"production"}'::jsonb),

  -- Storage / consolidation nodes. Public flags are only applied to non-player
  -- ownership; player-owned inventories remain private by default.
  ('warehouse',              'depot',        null, true,  true,  '{"role":"storage"}'::jsonb),
  ('warehouse_storage',      'depot',        null, true,  true,  '{"role":"storage"}'::jsonb),
  ('reserve_depot',          'depot',        null, true,  true,  '{"role":"storage"}'::jsonb),
  ('logistics_hub',          'depot',        null, true,  true,  '{"role":"logistics"}'::jsonb),
  ('spaceport_storage',      'depot',        null, true,  true,  '{"role":"spaceport_storage"}'::jsonb),

  -- Planetary shuttle endpoints. These are surface interfaces, never implicit
  -- intersolar-ship destinations.
  ('landing_pad',            'surface_port', null, true,  true,  '{"role":"shuttle_port"}'::jsonb),
  ('spaceport_pad_mini',     'surface_port', null, true,  true,  '{"role":"shuttle_port"}'::jsonb),
  ('spaceport_pad_standard', 'surface_port', null, true,  true,  '{"role":"shuttle_port"}'::jsonb)
on conflict (buildable_id) do nothing;

create or replace function public.noxia_ensure_facility_inventory(
  p_tile_entity_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity public.tile_entities%rowtype;
  v_policy public.facility_inventory_policies%rowtype;
  v_inventory public.logistics_inventories%rowtype;
  v_inventory_id uuid;
  v_owner_profile_id uuid;
  v_building_name text;
  v_label text;
  v_public_deposit boolean;
  v_public_withdraw boolean;
begin
  if p_tile_entity_id is null then
    return null;
  end if;

  select * into v_entity
  from public.tile_entities
  where id = p_tile_entity_id
    and entity_type = 'building';

  if not found then
    return null;
  end if;

  select * into v_policy
  from public.facility_inventory_policies
  where buildable_id = v_entity.entity_id
    and active;

  if not found then
    return null;
  end if;

  -- The logistics unique key makes (native, tile_entity, entity-id) the one
  -- canonical physical inventory binding. Never silently reinterpret an
  -- already-bound entity as a different node kind.
  select * into v_inventory
  from public.logistics_inventories
  where storage_kind = 'native'
    and subject_type = 'tile_entity'
    and subject_id = v_entity.id
  limit 1;

  if found then
    if v_inventory.inventory_kind is distinct from v_policy.inventory_kind then
      raise exception 'NOXIA_FACILITY_INVENTORY_KIND_CONFLICT:%:%:%',
        v_entity.id, v_inventory.inventory_kind, v_policy.inventory_kind
        using errcode = 'P0001';
    end if;
    return v_inventory.id;
  end if;

  -- Only PLAYER ownership maps to profiles. STATE/NPC/CORPORATION inventories
  -- remain owner_profile_id NULL and are governed by Core access policy.
  v_owner_profile_id := case
    when v_entity.owner_class = 'PLAYER' then coalesce(v_entity.owner_id, v_entity.profile_id)
    else null
  end;

  -- Player-owned inventories stay private even when the node class is normally
  -- public (e.g. a depot or shuttle pad). State/shared infrastructure may use
  -- the policy's public access flags.
  v_public_deposit := case
    when v_entity.owner_class = 'PLAYER' then false
    else v_policy.public_deposit
  end;
  v_public_withdraw := case
    when v_entity.owner_class = 'PLAYER' then false
    else v_policy.public_withdraw
  end;

  select bd.name into v_building_name
  from public.building_definitions bd
  where bd.key = v_entity.entity_id
  limit 1;

  v_label := coalesce(v_building_name, initcap(replace(v_entity.entity_id, '_', ' ')))
    || case v_policy.inventory_kind
         when 'depot' then ' · Depot'
         when 'surface_port' then ' · Shuttle-Port'
         else ' · Facility'
       end;

  insert into public.logistics_inventories (
    owner_profile_id,
    location_id,
    inventory_kind,
    storage_kind,
    subject_type,
    subject_id,
    label,
    capacity,
    public_deposit,
    public_withdraw,
    active,
    metadata
  ) values (
    v_owner_profile_id,
    v_entity.location_id,
    v_policy.inventory_kind,
    'native',
    'tile_entity',
    v_entity.id,
    v_label,
    v_policy.capacity,
    v_public_deposit,
    v_public_withdraw,
    true,
    coalesce(v_policy.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'ownerClass', v_entity.owner_class,
        'buildingType', v_entity.entity_id,
        'provisioning', 'core_policy'
      )
  )
  on conflict (storage_kind, subject_type, subject_id) do nothing
  returning id into v_inventory_id;

  if v_inventory_id is null then
    select * into v_inventory
    from public.logistics_inventories
    where storage_kind = 'native'
      and subject_type = 'tile_entity'
      and subject_id = v_entity.id
    limit 1;

    if not found then
      raise exception 'NOXIA_FACILITY_INVENTORY_PROVISION_FAILED:%', v_entity.id
        using errcode = 'P0001';
    end if;
    if v_inventory.inventory_kind is distinct from v_policy.inventory_kind then
      raise exception 'NOXIA_FACILITY_INVENTORY_KIND_CONFLICT:%:%:%',
        v_entity.id, v_inventory.inventory_kind, v_policy.inventory_kind
        using errcode = 'P0001';
    end if;
    return v_inventory.id;
  end if;

  return v_inventory_id;
end;
$$;

-- Keep inventory provisioning in the same transaction as world-entity
-- materialisation, regardless of whether the entity came from noxia_complete_build
-- or another server-authoritative creation path.
create or replace function public.noxia_provision_facility_inventory_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entity_type = 'building' then
    perform public.noxia_ensure_facility_inventory(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_noxia_provision_facility_inventory on public.tile_entities;
create trigger trg_noxia_provision_facility_inventory
after insert on public.tile_entities
for each row execute function public.noxia_provision_facility_inventory_after_insert();

revoke all on function public.noxia_ensure_facility_inventory(uuid)
  from public, anon, authenticated;
grant execute on function public.noxia_ensure_facility_inventory(uuid)
  to service_role;

revoke all on function public.noxia_provision_facility_inventory_after_insert()
  from public, anon, authenticated;
grant execute on function public.noxia_provision_facility_inventory_after_insert()
  to service_role;

-- Idempotent backfill. Existing Shackleton bindings are preserved; suitable
-- Earth/Moon/Mars facilities without a native inventory receive one now.
do $$
declare
  v_entity record;
begin
  for v_entity in
    select te.id
    from public.tile_entities te
    join public.facility_inventory_policies p
      on p.buildable_id = te.entity_id
     and p.active
    where te.entity_type = 'building'
    order by te.id
  loop
    perform public.noxia_ensure_facility_inventory(v_entity.id);
  end loop;
end;
$$;

comment on table public.facility_inventory_policies is
  'Body-agnostic Core policy declaring which physical buildables receive native tile_entity inventories.';
comment on function public.noxia_ensure_facility_inventory(uuid) is
  'Idempotently provisions the canonical native inventory for one policy-eligible physical tile_entity.';
comment on function public.noxia_provision_facility_inventory_after_insert() is
  'AFTER INSERT hook keeping facility inventory provisioning atomic with tile_entity materialisation.';