-- Keep the onboarding host in the default Earth/Sauerland map region so
-- the starterCafe handoff can resolve and open the existing interior reliably.

set search_path to public;

do $$
declare
  v_person uuid;
  v_earth uuid;
  v_cafe uuid;
  v_employer uuid;
begin
  select id into v_person from public.people where person_key='earth-cafe-host' limit 1;
  select id into v_earth from public.locations where slug='earth' limit 1;
  if v_person is null or v_earth is null then return; end if;

  select te.id, pea.actor_id
    into v_cafe, v_employer
  from public.tile_entities te
  left join public.profile_economic_actors pea on pea.profile_id=te.profile_id
  where te.location_id=v_earth
    and te.entity_type='building'
    and te.entity_id='cafe'
    and te.status='active'
    and te.spatial_region_id='earth-sauerland'
  order by te.created_at,te.id
  limit 1;

  if v_cafe is null then
    raise notice 'Starter cafe host correction skipped: no earth-sauerland cafe';
    return;
  end if;

  update public.person_assignments
  set is_active=false,updated_at=now()
  where person_id=v_person
    and assignment_type='work'
    and is_active=true
    and tile_entity_id is distinct from v_cafe;

  if exists (
    select 1 from public.person_assignments
    where person_id=v_person and assignment_type='work' and tile_entity_id=v_cafe
  ) then
    update public.person_assignments
    set is_active=true,employer_actor_id=v_employer,role_code='service',updated_at=now()
    where person_id=v_person and assignment_type='work' and tile_entity_id=v_cafe;
  else
    insert into public.person_assignments(
      person_id,assignment_type,location_id,tile_entity_id,employer_actor_id,role_code,is_active
    ) values (
      v_person,'work',v_earth,v_cafe,v_employer,'service',true
    );
  end if;
end $$;
