-- NOXIA Core: serialize concurrent retries of the same idempotent command.
--
-- The existing domain implementations already persist command IDs and return the
-- stored result on normal retries. These thin wrappers add a transaction-scoped
-- advisory lock keyed by command type + command UUID so two simultaneous retries
-- cannot both pass the initial command lookup.

set search_path to public;

alter function public.noxia_transfer_cargo(uuid,uuid,uuid,uuid,public.resource_type,integer)
  rename to noxia_transfer_cargo_impl;

create or replace function public.noxia_transfer_cargo(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_source_inventory_id uuid,
  p_target_inventory_id uuid,
  p_resource public.resource_type,
  p_amount integer
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('noxia_transfer_cargo:' || p_command_id::text, 0));
  return public.noxia_transfer_cargo_impl(
    p_command_id,
    p_actor_profile_id,
    p_source_inventory_id,
    p_target_inventory_id,
    p_resource,
    p_amount
  );
end;
$function$;

alter function public.noxia_create_transport_job(uuid,uuid,uuid,text,uuid,uuid,uuid,text,public.resource_type,integer,jsonb)
  rename to noxia_create_transport_job_impl;

create or replace function public.noxia_create_transport_job(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_location_id uuid,
  p_domain text,
  p_source_inventory_id uuid,
  p_destination_inventory_id uuid,
  p_vehicle_inventory_id uuid,
  p_vehicle_role text,
  p_resource public.resource_type,
  p_amount integer,
  p_route_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('noxia_create_transport_job:' || p_command_id::text, 0));
  return public.noxia_create_transport_job_impl(
    p_command_id,
    p_actor_profile_id,
    p_location_id,
    p_domain,
    p_source_inventory_id,
    p_destination_inventory_id,
    p_vehicle_inventory_id,
    p_vehicle_role,
    p_resource,
    p_amount,
    p_route_snapshot
  );
end;
$function$;

alter function public.noxia_reserve_docking_port(uuid,uuid,uuid,text,timestamptz)
  rename to noxia_reserve_docking_port_impl;

create or replace function public.noxia_reserve_docking_port(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_port_id text,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('noxia_reserve_docking_port:' || p_command_id::text, 0));
  return public.noxia_reserve_docking_port_impl(
    p_command_id,
    p_actor_profile_id,
    p_ship_id,
    p_port_id,
    p_expires_at
  );
end;
$function$;

alter function public.noxia_dock_vessel(uuid,uuid,uuid,text)
  rename to noxia_dock_vessel_impl;

create or replace function public.noxia_dock_vessel(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_port_id text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('noxia_dock_vessel:' || p_command_id::text, 0));
  return public.noxia_dock_vessel_impl(p_command_id, p_actor_profile_id, p_ship_id, p_port_id);
end;
$function$;

alter function public.noxia_undock_vessel(uuid,uuid,uuid,text)
  rename to noxia_undock_vessel_impl;

create or replace function public.noxia_undock_vessel(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_port_id text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('noxia_undock_vessel:' || p_command_id::text, 0));
  return public.noxia_undock_vessel_impl(p_command_id, p_actor_profile_id, p_ship_id, p_port_id);
end;
$function$;

alter function public.noxia_cancel_docking_reservation(uuid,uuid,uuid,text)
  rename to noxia_cancel_docking_reservation_impl;

create or replace function public.noxia_cancel_docking_reservation(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_port_id text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('noxia_cancel_docking_reservation:' || p_command_id::text, 0));
  return public.noxia_cancel_docking_reservation_impl(p_command_id, p_actor_profile_id, p_ship_id, p_port_id);
end;
$function$;

alter function public.noxia_define_transport_itinerary(uuid,uuid,uuid,jsonb,jsonb)
  rename to noxia_define_transport_itinerary_impl;

create or replace function public.noxia_define_transport_itinerary(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_legs jsonb,
  p_handovers jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('noxia_define_transport_itinerary:' || p_command_id::text, 0));
  return public.noxia_define_transport_itinerary_impl(
    p_command_id,
    p_actor_profile_id,
    p_job_id,
    p_legs,
    p_handovers
  );
end;
$function$;

-- The renamed implementations and public command entrypoints stay server-only.
revoke all on function public.noxia_transfer_cargo_impl(uuid,uuid,uuid,uuid,public.resource_type,integer) from public, anon, authenticated;
revoke all on function public.noxia_create_transport_job_impl(uuid,uuid,uuid,text,uuid,uuid,uuid,text,public.resource_type,integer,jsonb) from public, anon, authenticated;
revoke all on function public.noxia_reserve_docking_port_impl(uuid,uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.noxia_dock_vessel_impl(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_undock_vessel_impl(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_cancel_docking_reservation_impl(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_define_transport_itinerary_impl(uuid,uuid,uuid,jsonb,jsonb) from public, anon, authenticated;

revoke all on function public.noxia_transfer_cargo(uuid,uuid,uuid,uuid,public.resource_type,integer) from public, anon, authenticated;
revoke all on function public.noxia_create_transport_job(uuid,uuid,uuid,text,uuid,uuid,uuid,text,public.resource_type,integer,jsonb) from public, anon, authenticated;
revoke all on function public.noxia_reserve_docking_port(uuid,uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.noxia_dock_vessel(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_undock_vessel(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_cancel_docking_reservation(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_define_transport_itinerary(uuid,uuid,uuid,jsonb,jsonb) from public, anon, authenticated;

grant execute on function public.noxia_transfer_cargo_impl(uuid,uuid,uuid,uuid,public.resource_type,integer) to service_role;
grant execute on function public.noxia_create_transport_job_impl(uuid,uuid,uuid,text,uuid,uuid,uuid,text,public.resource_type,integer,jsonb) to service_role;
grant execute on function public.noxia_reserve_docking_port_impl(uuid,uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.noxia_dock_vessel_impl(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_undock_vessel_impl(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_cancel_docking_reservation_impl(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_define_transport_itinerary_impl(uuid,uuid,uuid,jsonb,jsonb) to service_role;

grant execute on function public.noxia_transfer_cargo(uuid,uuid,uuid,uuid,public.resource_type,integer) to service_role;
grant execute on function public.noxia_create_transport_job(uuid,uuid,uuid,text,uuid,uuid,uuid,text,public.resource_type,integer,jsonb) to service_role;
grant execute on function public.noxia_reserve_docking_port(uuid,uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.noxia_dock_vessel(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_undock_vessel(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_cancel_docking_reservation(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_define_transport_itinerary(uuid,uuid,uuid,jsonb,jsonb) to service_role;
