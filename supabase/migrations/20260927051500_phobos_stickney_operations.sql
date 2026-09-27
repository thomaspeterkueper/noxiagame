-- Phobos Stickney operations: docking/tether semantics, cargo nodes and first
-- prospecting targets. Reuses the generic docking/logistics cores.

set search_path to public;

update docking_ports
set
  label = case id
    when 'phobos-a1' then 'A1 Stickney Shuttle Anchor'
    when 'phobos-a2' then 'A2 Stickney Service Anchor'
    when 'phobos-b1' then 'B1 Stickney Cargo Anchor'
    when 'phobos-b2' then 'B2 Stickney Cargo Anchor'
    when 'phobos-c1' then 'C1 Stickney Heavy Cargo Anchor'
    when 'phobos-s1' then 'S1 Stickney Service Tether'
    else label
  end,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'bodySlug','phobos','surfaceHub','stickney-alpha',
    'interface','microgravity-anchor-field','tetherRequired',true,
    'landingMode','dock-and-anchor'
  ),
  updated_at = now()
where station_slug = 'phobos';

insert into logistics_inventories (
  id, owner_profile_id, location_id, inventory_kind, storage_kind,
  subject_type, subject_id, label, capacity,
  public_deposit, public_withdraw, active, metadata
)
select
  gen_random_uuid(), null, te.location_id, 'surface_port', 'native',
  'tile_entity', te.id, 'Stickney Anchor Field · Cargo', 180,
  true, true, true,
  jsonb_build_object(
    'role','stickney_anchor_field','ownerClass','STATE',
    'buildingType','landing_pad_phobos','xM',te.x_m,'yM',te.y_m,
    'tetherRequired',true,'provisioning','phobos_ops_v1'
  )
from tile_entities te
where te.entity_id='landing_pad_phobos'
  and te.spatial_region_id='phobos-stickney-alpha'
  and not exists (
    select 1 from logistics_inventories li
    where li.storage_kind='native' and li.subject_type='tile_entity' and li.subject_id=te.id
  );

insert into logistics_inventories (
  id, owner_profile_id, location_id, inventory_kind, storage_kind,
  subject_type, subject_id, label, capacity,
  public_deposit, public_withdraw, active, metadata
)
select
  gen_random_uuid(), null, te.location_id, 'vehicle', 'native',
  'tile_entity', te.id, 'Tether Rover 01 · Staging', 40,
  true, true, true,
  jsonb_build_object(
    'role','surface_rover','ownerClass','STATE',
    'vehicleClass','phobos_tether_rover','xM',te.x_m,'yM',te.y_m,
    'nominalSpeedMps',1.2,'tetherCapable',true,'provisioning','phobos_ops_v1'
  )
from tile_entities te
where te.entity_id='rover_yard'
  and te.spatial_region_id='phobos-stickney-alpha'
  and not exists (
    select 1 from logistics_inventories li
    where li.storage_kind='native' and li.subject_type='tile_entity' and li.subject_id=te.id
  );

update logistics_inventories li
set metadata = coalesce(li.metadata,'{}'::jsonb) || jsonb_build_object(
      'role','stickney_depot','xM',te.x_m,'yM',te.y_m,'surfaceHub','stickney-alpha'
    ),
    updated_at = now()
from tile_entities te
where li.subject_type='tile_entity'
  and li.subject_id=te.id
  and te.entity_id='warehouse'
  and te.spatial_region_id='phobos-stickney-alpha';

with anchor_inventory as (
  select li.id
  from logistics_inventories li
  join tile_entities te on te.id=li.subject_id
  where li.subject_type='tile_entity'
    and te.entity_id='landing_pad_phobos'
    and te.spatial_region_id='phobos-stickney-alpha'
  order by li.created_at limit 1
)
insert into logistics_inventory_items (inventory_id,resource,amount)
select id,'components'::resource_type,24 from anchor_inventory
on conflict (inventory_id,resource) do update
set amount=greatest(logistics_inventory_items.amount,excluded.amount), updated_at=now();

with anchor_inventory as (
  select li.id
  from logistics_inventories li
  join tile_entities te on te.id=li.subject_id
  where li.subject_type='tile_entity'
    and te.entity_id='landing_pad_phobos'
    and te.spatial_region_id='phobos-stickney-alpha'
  order by li.created_at limit 1
)
insert into logistics_inventory_items (inventory_id,resource,amount)
select id,'water'::resource_type,12 from anchor_inventory
on conflict (inventory_id,resource) do update
set amount=greatest(logistics_inventory_items.amount,excluded.amount), updated_at=now();

insert into celestial_regions (body,slug,label,center_lat,center_lon,radius_km,bounds,source,imported_at)
select
  'phobos','phobos-stickney-alpha','Phobos · Stickney Alpha',24.235,-49.0,0.7,
  jsonb_build_object(
    'localFrame','PHOBOS_PLANETOCENTRIC',
    'originStatus','derived',
    'provenance','derived-gameplay-model'
  ),
  'manual',now()
where not exists (select 1 from celestial_regions where slug='phobos-stickney-alpha');

insert into region_resources (id,region_id,resource_type,lat,lon,x_m,y_m,abundance,properties)
select
  gen_random_uuid(),cr.id,v.resource_type,null,null,v.x_m,v.y_m,v.abundance,
  jsonb_build_object(
    'body','phobos','surface_hub','stickney-alpha','seed_key',v.seed_key,
    'tier',v.tier,'provenance','derived-gameplay-model',
    'confidence',v.confidence,'notes',v.notes
  )
from celestial_regions cr
cross join (values
  ('phobos-stickney-metal-a','metal'::text,180.0,90.0,0.44,'viable'::text,'low'::text,'Regolith metal-bearing prospect; not an observed ore body.'::text),
  ('phobos-stickney-metal-b','metal'::text,-145.0,165.0,0.26,'trace'::text,'low'::text,'Secondary regolith prospect; model-derived.'::text),
  ('phobos-stickney-water-a','water'::text,260.0,-110.0,0.12,'trace'::text,'very-low'::text,'Hydrated-material prospect only; not confirmed accessible water.'::text)
) as v(seed_key,resource_type,x_m,y_m,abundance,tier,confidence,notes)
where cr.slug='phobos-stickney-alpha'
  and not exists (
    select 1 from region_resources rr where rr.properties->>'seed_key'=v.seed_key
  );
