-- NOXIA-LIVING-0010 — atomarer Markteinzug in private Mietwohnung.
-- Vorbereitung für Schatten-/Live-Markt; KEIN Tick ruft diese Funktion automatisch auf.

begin;

create or replace function public.move_person_to_market_rental(
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
  v_location_id uuid;
  v_landlord_actor uuid;
  v_current_assignment uuid;
  v_new_assignment uuid;
  v_tenancy_id uuid;
  v_residents integer;
begin
  if p_person_id is null or p_tile_entity_id is null then
    raise exception 'NOXIA_RENTAL_REQUIRED_ARGUMENT_MISSING';
  end if;

  -- Lock the target dwelling: capacity check and move become one transaction.
  select * into v_tile
  from public.tile_entities
  where id=p_tile_entity_id
    and entity_type='building'
    and status='active'
  for update;

  if not found then raise exception 'NOXIA_RENTAL_NOT_FOUND'; end if;
  if v_tile.owner_class <> 'PLAYER' then raise exception 'NOXIA_RENTAL_NOT_PRIVATE'; end if;
  if v_tile.residential_capacity is null or v_tile.residential_capacity < 1 then
    raise exception 'NOXIA_RENTAL_NOT_RESIDENTIAL';
  end if;
  if v_tile.lease_price is null or v_tile.lease_price <= 0 then
    raise exception 'NOXIA_RENTAL_NOT_OFFERED';
  end if;

  select actor_id into v_landlord_actor
  from public.profile_economic_actors
  where profile_id=v_tile.profile_id;

  if v_landlord_actor is null then
    raise exception 'NOXIA_RENTAL_LANDLORD_ACCOUNT_MISSING';
  end if;

  select count(*)::integer into v_residents
  from public.person_assignments
  where tile_entity_id=p_tile_entity_id
    and assignment_type='home'
    and is_active=true;

  if v_residents >= v_tile.residential_capacity then
    raise exception 'NOXIA_RENTAL_FULL';
  end if;

  select id into v_current_assignment
  from public.person_assignments
  where person_id=p_person_id
    and assignment_type='home'
    and is_active=true
  order by created_at,id
  limit 1
  for update;

  -- End the previous home/tenancy only inside this same transaction.
  if v_current_assignment is not null then
    update public.person_assignments
    set is_active=false,updated_at=now()
    where id=v_current_assignment;

    update public.person_tenancies
    set status='ended',updated_at=now()
    where assignment_id=v_current_assignment and status<>'ended';
  end if;

  v_location_id := v_tile.location_id;

  insert into public.person_assignments(
    person_id,assignment_type,location_id,tile_entity_id,is_active
  ) values (
    p_person_id,'home',v_location_id,p_tile_entity_id,true
  )
  returning id into v_new_assignment;

  insert into public.person_tenancies(
    assignment_id,person_id,location_id,tile_entity_id,landlord_actor_id,
    rent_per_billing,billing_interval_ticks,next_due_tick,status,origin,tenure
  ) values (
    v_new_assignment,p_person_id,v_location_id,p_tile_entity_id,v_landlord_actor,
    v_tile.lease_price,720,p_tick+720,'active','market','rented'
  )
  returning id into v_tenancy_id;

  update public.people
  set current_location_id=v_location_id
  where id=p_person_id;

  return jsonb_build_object(
    'ok',true,
    'person_id',p_person_id,
    'assignment_id',v_new_assignment,
    'tenancy_id',v_tenancy_id,
    'location_id',v_location_id,
    'tile_entity_id',p_tile_entity_id,
    'rent_per_billing',v_tile.lease_price,
    'next_due_tick',p_tick+720
  );
end;
$$;

revoke all on function public.move_person_to_market_rental(uuid,uuid,bigint)
  from public,anon,authenticated;
grant execute on function public.move_person_to_market_rental(uuid,uuid,bigint)
  to service_role;

comment on function public.move_person_to_market_rental(uuid,uuid,bigint) is
  'Atomically moves a person into an explicitly offered private rental and creates origin=market tenancy. Not called automatically by the tick engine.';

commit;
