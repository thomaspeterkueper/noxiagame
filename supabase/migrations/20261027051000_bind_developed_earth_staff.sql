-- Bind already-developed Earth residents to concrete workplaces.
-- No new people, no job changes, no person_key changes: only resolve the
-- previously coarse work assignment to an existing operational building.

do $$
declare
  v_earth uuid;
  v_amara uuid;
  v_victor uuid;
  v_hana uuid;
  v_school uuid := 'b5d9e5f1-11f4-4159-a3ad-b06f039c74ae';
  v_admin uuid := '84a1512b-139e-4314-ba40-5f31e3ca32bb';
  v_warehouse uuid := 'cede911c-f92b-44a8-8a37-2af88aca18e0';
begin
  select id into v_earth from public.locations where slug='earth';
  select id into v_amara from public.people where display_name='Amara Ndlovu' and current_location_id=v_earth limit 1;
  select id into v_victor from public.people where display_name='Victor Chen' and current_location_id=v_earth limit 1;
  select id into v_hana from public.people where display_name='Hana Moreau' and current_location_id=v_earth limit 1;

  if v_amara is null or v_victor is null or v_hana is null then
    raise exception 'NOXIA_PERSON_DEPTH_EARTH_STAFF_MISSING';
  end if;

  if not exists(select 1 from public.tile_entities where id=v_school and location_id=v_earth and entity_id='school' and status='active') then
    raise exception 'NOXIA_PERSON_DEPTH_EARTH_SCHOOL_MISSING';
  end if;
  if not exists(select 1 from public.tile_entities where id=v_admin and location_id=v_earth and entity_id='admin' and status='active') then
    raise exception 'NOXIA_PERSON_DEPTH_EARTH_ADMIN_MISSING';
  end if;
  if not exists(select 1 from public.tile_entities where id=v_warehouse and location_id=v_earth and entity_id='warehouse' and status='active') then
    raise exception 'NOXIA_PERSON_DEPTH_EARTH_WAREHOUSE_MISSING';
  end if;

  update public.person_assignments
  set tile_entity_id=v_school, updated_at=now()
  where person_id=v_amara and assignment_type='work' and is_active=true
    and role_code='educator' and tile_entity_id is null;

  update public.person_assignments
  set tile_entity_id=v_admin, updated_at=now()
  where person_id=v_victor and assignment_type='work' and is_active=true
    and role_code='administrator' and tile_entity_id is null;

  update public.person_assignments
  set tile_entity_id=v_warehouse, updated_at=now()
  where person_id=v_hana and assignment_type='work' and is_active=true
    and role_code='logistics' and tile_entity_id is null;
end $$;
