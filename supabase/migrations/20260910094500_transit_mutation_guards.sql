-- NOXIA transit mutation guards
-- 2026-09-10
--
-- Once a ship has entered server-authoritative transit, its manifest and
-- identity/activation attributes are frozen until arrival. This closes legacy
-- API paths (spot/order/ship purchase) without duplicating transit awareness in
-- every command. Transit start charges energy before status changes to transit.

set search_path to public;

create or replace function public.noxia_guard_in_transit_ship_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'transit'::public.ship_status and (
    new.ship_type_id is distinct from old.ship_type_id
    or new.cargo_max is distinct from old.cargo_max
    or new.is_active is distinct from old.is_active
  ) then
    raise exception 'NOXIA_TRANSIT_SHIP_MUTATION_FORBIDDEN:%', old.id using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists ships_guard_in_transit_mutation on public.ships;
create trigger ships_guard_in_transit_mutation
  before update of ship_type_id, cargo_max, is_active on public.ships
  for each row
  execute function public.noxia_guard_in_transit_ship_mutation();

create or replace function public.noxia_guard_in_transit_cargo_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ship_id uuid := coalesce(new.ship_id, old.ship_id);
  v_status public.ship_status;
begin
  select status into v_status
  from public.ships
  where id = v_ship_id;

  if v_status = 'transit'::public.ship_status then
    raise exception 'NOXIA_TRANSIT_CARGO_MUTATION_FORBIDDEN:%', v_ship_id using errcode = 'P0001';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists ship_cargo_guard_in_transit_mutation on public.ship_cargo;
create trigger ship_cargo_guard_in_transit_mutation
  before insert or update or delete on public.ship_cargo
  for each row
  execute function public.noxia_guard_in_transit_cargo_mutation();

revoke all on function public.noxia_guard_in_transit_ship_mutation() from public, anon, authenticated;
revoke all on function public.noxia_guard_in_transit_cargo_mutation() from public, anon, authenticated;

comment on function public.noxia_guard_in_transit_ship_mutation() is
  'Invariant guard: active transit freezes ship type, capacity and activation state until arrival.';
comment on function public.noxia_guard_in_transit_cargo_mutation() is
  'Invariant guard: active transit freezes the cargo manifest until arrival.';
