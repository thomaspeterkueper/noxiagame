-- NOXIA Arrival Control / Docking phase guard
-- 2026-09-15
--
-- A persistent docking reservation at an orbital station is an approach
-- clearance. It must therefore originate from a valid station-arrival state.

set search_path to public;

create or replace function public.noxia_guard_station_docking_reservation_phase()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_station text;
  v_phase text;
begin
  if new.status <> 'active' then return new; end if;

  select station_slug into v_station
  from public.docking_ports
  where id = new.port_id;

  if v_station is null then return new; end if;

  select phase into v_phase
  from public.ship_arrival_states
  where ship_id = new.ship_id
    and station_slug = v_station
  for update;

  if not found then
    raise exception 'NOXIA_DOCKING_ARRIVAL_STATE_REQUIRED:%:%', new.ship_id, v_station
      using errcode = 'P0001';
  end if;

  if v_phase not in ('arrival-rendezvous', 'holding', 'approach') then
    raise exception 'NOXIA_DOCKING_ARRIVAL_PHASE_INVALID:%', v_phase
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_noxia_guard_station_docking_reservation_phase on public.docking_reservations;
create trigger trg_noxia_guard_station_docking_reservation_phase
before insert or update of status on public.docking_reservations
for each row execute function public.noxia_guard_station_docking_reservation_phase();

revoke all on function public.noxia_guard_station_docking_reservation_phase() from public, anon, authenticated;
grant execute on function public.noxia_guard_station_docking_reservation_phase() to service_role;

comment on function public.noxia_guard_station_docking_reservation_phase() is
  'Prevents orbital port reservation unless the ship has a server-authoritative arrival state eligible for approach clearance.';
