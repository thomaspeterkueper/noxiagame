-- NOXIA Core security hardening before hosted docking/itinerary rollout.
--
-- All mutable docking/itinerary RPCs are server-only and called through the
-- service-role application facade. SECURITY DEFINER is therefore unnecessary;
-- use caller privileges and explicitly close helper-function EXECUTE exposure.

set search_path to public;

alter function public.noxia_cleanup_expired_docking_reservations() security invoker;
alter function public.noxia_reserve_docking_port(uuid,uuid,uuid,text,timestamptz) security invoker;
alter function public.noxia_dock_vessel(uuid,uuid,uuid,text) security invoker;
alter function public.noxia_undock_vessel(uuid,uuid,uuid,text) security invoker;
alter function public.noxia_cancel_docking_reservation(uuid,uuid,uuid,text) security invoker;
alter function public.noxia_transfer_connected_cargo(uuid,uuid,uuid,uuid,uuid,public.resource_type,integer) security invoker;
alter function public.noxia_define_transport_itinerary(uuid,uuid,uuid,jsonb,jsonb) security invoker;

revoke all on function public.noxia_canonical_station_slug(text) from public, anon, authenticated;
revoke all on function public.noxia_ship_docking_class(uuid) from public, anon, authenticated;
revoke all on function public.noxia_docking_compatible(text,text) from public, anon, authenticated;
revoke all on function public.noxia_cleanup_expired_docking_reservations() from public, anon, authenticated;
revoke all on function public.noxia_reserve_docking_port(uuid,uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.noxia_dock_vessel(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_undock_vessel(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_cancel_docking_reservation(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_transfer_connected_cargo(uuid,uuid,uuid,uuid,uuid,public.resource_type,integer) from public, anon, authenticated;
revoke all on function public.noxia_define_transport_itinerary(uuid,uuid,uuid,jsonb,jsonb) from public, anon, authenticated;

grant execute on function public.noxia_canonical_station_slug(text) to service_role;
grant execute on function public.noxia_ship_docking_class(uuid) to service_role;
grant execute on function public.noxia_docking_compatible(text,text) to service_role;
grant execute on function public.noxia_cleanup_expired_docking_reservations() to service_role;
grant execute on function public.noxia_reserve_docking_port(uuid,uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.noxia_dock_vessel(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_undock_vessel(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_cancel_docking_reservation(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_transfer_connected_cargo(uuid,uuid,uuid,uuid,uuid,public.resource_type,integer) to service_role;
grant execute on function public.noxia_define_transport_itinerary(uuid,uuid,uuid,jsonb,jsonb) to service_role;
