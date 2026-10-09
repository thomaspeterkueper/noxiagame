-- NOXIA-LIVING-0010 — atomarer Einzug in einen freien staatlichen Wohnplatz.
-- Nur für Personen ohne Wohnung, nur am eigenen Ort, ohne Miete und ohne Buchung.
-- Wird vom Tick nur aufgerufen, wenn NOXIA_HOUSING_PUBLIC_PLACEMENT=true gesetzt ist.

begin;

create or replace function public.move_person_to_public_housing(
  p_person_id uuid,
  p_tile_entity_id uuid,
  p_tick bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tile public.tile_entities%rowtype;
  v_person_location uuid;
  v_residents integer;
  v_new_assignment uuid;
  v_tenancy_id uuid;
begin
  if p_person_id is null or p_tile_entity_id is null then
    raise exception 'NOXIA_PUBLIC_HOUSING_REQUIRED_ARGUMENT_MISSING';
  end if;

  -- Sperrt das Zielobjekt: Kapazitätsprüfung und Einzug sind eine Transaktion.
  select * into v_tile
  from public.tile_entities
  where id=p_tile_entity_id
    and entity_type='building'
    and status='active'
  for update;

  if not found then raise exception 'NOXIA_PUBLIC_HOUSING_NOT_FOUND'; end if;
  if v_tile.owner_class <> 'STATE' then raise exception 'NOXIA_PUBLIC_HOUSING_NOT_PUBLIC'; end if;
  if v_tile.residential_capacity is null or v_tile.residential_capacity < 1 then
    raise exception 'NOXIA_PUBLIC_HOUSING_NOT_RESIDENTIAL';
  end if;

  select current_location_id into v_person_location
  from public.people where id=p_person_id for update;
  if not found then raise exception 'NOXIA_PUBLIC_HOUSING_PERSON_NOT_FOUND'; end if;
  -- Dieser Weg versetzt niemanden in eine andere Siedlung.
  if v_person_location is distinct from v_tile.location_id then
    raise exception 'NOXIA_PUBLIC_HOUSING_OTHER_LOCATION';
  end if;

  -- Nur für Personen ohne Wohnung: ein bestehendes Zuhause wird hier nie beendet.
  if exists (
    select 1 from public.person_assignments
    where person_id=p_person_id and assignment_type='home' and is_active=true
  ) then
    raise exception 'NOXIA_PUBLIC_HOUSING_ALREADY_HOUSED';
  end if;

  select count(*)::integer into v_residents
  from public.person_assignments
  where tile_entity_id=p_tile_entity_id
    and assignment_type='home'
    and is_active=true;

  if v_residents >= v_tile.residential_capacity then
    raise exception 'NOXIA_PUBLIC_HOUSING_FULL';
  end if;

  insert into public.person_assignments(
    person_id,assignment_type,location_id,tile_entity_id,is_active,starts_tick
  ) values (
    p_person_id,'home',v_tile.location_id,p_tile_entity_id,true,p_tick
  )
  returning id into v_new_assignment;

  -- origin='provided': eine Zuteilung, keine Marktentscheidung.
  insert into public.person_tenancies(
    assignment_id,person_id,location_id,tile_entity_id,landlord_actor_id,
    rent_per_billing,billing_interval_ticks,next_due_tick,status,origin,tenure
  ) values (
    v_new_assignment,p_person_id,v_tile.location_id,p_tile_entity_id,
    public.ensure_public_actor(v_tile.location_id),
    null,720,null,'provided','provided','provided'
  )
  returning id into v_tenancy_id;

  return jsonb_build_object(
    'ok',true,
    'person_id',p_person_id,
    'assignment_id',v_new_assignment,
    'tenancy_id',v_tenancy_id,
    'location_id',v_tile.location_id,
    'tile_entity_id',p_tile_entity_id
  );
end;
$$;

revoke all on function public.move_person_to_public_housing(uuid,uuid,bigint)
  from public,anon,authenticated;
grant execute on function public.move_person_to_public_housing(uuid,uuid,bigint)
  to service_role;

comment on function public.move_person_to_public_housing(uuid,uuid,bigint) is
  'Atomically places a person without a home into a free public dwelling at their own location. No rent, no ledger entry, origin=provided.';

commit;
