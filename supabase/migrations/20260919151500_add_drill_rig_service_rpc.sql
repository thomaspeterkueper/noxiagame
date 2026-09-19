create or replace function public.service_drill_rig(
  p_profile_id uuid,
  p_location_id uuid,
  p_rig_id text,
  p_component_cost integer
) returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_components integer;
  v_condition integer;
begin
  if p_component_cost < 0 then raise exception 'invalid_service_cost'; end if;
  if not exists (select 1 from public.player_instruments where profile_id=p_profile_id and instrument_id=p_rig_id) then
    raise exception 'drill_rig_not_owned';
  end if;

  insert into public.player_instrument_state(profile_id,instrument_id,condition_percent)
  values (p_profile_id,p_rig_id,100)
  on conflict (profile_id,instrument_id) do nothing;

  select condition_percent into v_condition
  from public.player_instrument_state
  where profile_id=p_profile_id and instrument_id=p_rig_id
  for update;
  if v_condition >= 100 then return 100; end if;

  select stock into v_components
  from public.location_resources
  where location_id=p_location_id and resource='components'
  for update;
  if coalesce(v_components,0) < p_component_cost then raise exception 'insufficient_components'; end if;

  update public.location_resources set stock=stock-p_component_cost,updated_at=now()
  where location_id=p_location_id and resource='components';
  update public.player_instrument_state set condition_percent=100,updated_at=now()
  where profile_id=p_profile_id and instrument_id=p_rig_id;
  return 100;
end $$;

revoke all on function public.service_drill_rig(uuid,uuid,text,integer) from public;
grant execute on function public.service_drill_rig(uuid,uuid,text,integer) to service_role;
