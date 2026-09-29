create or replace function public.noxia_repair_equipment_item(
  p_profile_id uuid,
  p_equipment_id uuid,
  p_workshop_inventory_id uuid,
  p_energy_cost integer,
  p_component_cost integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.equipment_items%rowtype;
  v_workshop public.logistics_inventories%rowtype;
  v_energy_id uuid;
  v_energy_stock integer;
  v_component_id uuid;
  v_component_stock integer;
  v_now timestamptz := now();
begin
  select * into v_item
  from public.equipment_items
  where id = p_equipment_id
  for update;
  if not found then raise exception 'equipment_not_found'; end if;
  if v_item.status <> 'stored' or v_item.inventory_id is distinct from p_workshop_inventory_id then raise exception 'equipment_not_in_workshop'; end if;

  select * into v_workshop
  from public.logistics_inventories
  where id = p_workshop_inventory_id and active = true
  for update;
  if not found or v_workshop.location_id is distinct from v_item.location_id or v_workshop.metadata->>'role' <> 'equipment_workshop' then raise exception 'workshop_not_available'; end if;

  select id,stock into v_energy_id,v_energy_stock from public.resources where location_id=v_item.location_id and resource='energy' for update;
  select id,stock into v_component_id,v_component_stock from public.resources where location_id=v_item.location_id and resource='components' for update;
  if v_energy_id is null or v_component_id is null then raise exception 'resource_rows_missing'; end if;
  if v_energy_stock < p_energy_cost or v_component_stock < p_component_cost then raise exception 'insufficient_resources'; end if;

  update public.resources set stock=stock-p_energy_cost,updated_at=v_now where id=v_energy_id;
  update public.resources set stock=stock-p_component_cost,updated_at=v_now where id=v_component_id;
  update public.equipment_items
  set condition=100,
      wear=0,
      status='stored',
      updated_at=v_now,
      metadata=metadata||jsonb_build_object('lastRepairAt',v_now,'lastRepairBy',p_profile_id)
  where id=p_equipment_id;

  return jsonb_build_object('ok',true,'equipmentId',p_equipment_id,'energyCost',p_energy_cost,'componentCost',p_component_cost,'condition',100,'wear',0);
end;
$$;

revoke all on function public.noxia_repair_equipment_item(uuid,uuid,uuid,integer,integer) from public;
grant execute on function public.noxia_repair_equipment_item(uuid,uuid,uuid,integer,integer) to service_role;
