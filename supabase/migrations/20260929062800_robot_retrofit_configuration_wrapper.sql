create or replace function public.noxia_retrofit_robot_equipment_v2(
  p_profile_id uuid,
  p_vehicle_id uuid,
  p_workshop_inventory_id uuid,
  p_target_role text,
  p_current_equipment_keys text[],
  p_target_equipment_keys text[],
  p_vehicle_modules jsonb,
  p_vehicle_energy jsonb,
  p_cargo_capacity_t numeric,
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
  v_status text;
  v_result jsonb;
begin
  select status into v_status
  from public.vehicle_instances
  where id = p_vehicle_id and owner_profile_id = p_profile_id
  for update;
  if not found then raise exception 'vehicle_not_found'; end if;
  if v_status not in ('ready','configuration') then raise exception 'vehicle_not_ready'; end if;
  if v_status = 'configuration' then
    update public.vehicle_instances set status='ready',updated_at=now() where id=p_vehicle_id;
  end if;

  select public.noxia_retrofit_robot_equipment(
    p_profile_id,p_vehicle_id,p_workshop_inventory_id,p_target_role,
    p_current_equipment_keys,p_target_equipment_keys,p_vehicle_modules,p_vehicle_energy,
    p_cargo_capacity_t,p_modifications,p_emergent_state,p_energy_cost,p_component_cost
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.noxia_retrofit_robot_equipment_v2(uuid,uuid,uuid,text,text[],text[],jsonb,jsonb,numeric,jsonb,jsonb,integer,integer) from public;
grant execute on function public.noxia_retrofit_robot_equipment_v2(uuid,uuid,uuid,text,text[],text[],jsonb,jsonb,numeric,jsonb,jsonb,integer,integer) to service_role;
