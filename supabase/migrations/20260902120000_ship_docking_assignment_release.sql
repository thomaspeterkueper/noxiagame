-- Release ship -> landing-pad attribution the moment a ship is deactivated.
--
-- ship_docking_assignments is otherwise only released when the assigned ship
-- travels again. A deactivated or abandoned ship would keep its concrete pad
-- occupied forever and could grief a shared destination (409
-- NO_LANDING_CAPACITY for every arrival). Ship deletion is already covered by
-- the ON DELETE CASCADE on ship_docking_assignments.ship_id; deactivation is
-- not, so it gets an explicit trigger here. The trigger fires for every write
-- path (API, future code, manual updates), not just the current buy flow.

create or replace function public.release_ship_docking_assignment_on_deactivate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active is distinct from old.is_active and not new.is_active then
    delete from public.ship_docking_assignments where ship_id = old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists ships_release_docking_assignment_on_deactivate on public.ships;
create trigger ships_release_docking_assignment_on_deactivate
  before update of is_active on public.ships
  for each row
  execute function public.release_ship_docking_assignment_on_deactivate();

comment on function public.release_ship_docking_assignment_on_deactivate is
  'NOXIA runtime: frees the ship''s docking assignment when the ship is deactivated.';
