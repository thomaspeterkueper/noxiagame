-- NOXIA docking-class type boundary repair
-- 2026-09-15
--
-- The persistent docking Core exposes noxia_ship_docking_class(uuid) for an
-- instantiated ship. Arrival Control works from ships.ship_type_id and therefore
-- needs the same canonical mapping for a text ship-type identifier. Keep the
-- existing UUID function intact for compatibility and add the missing overload
-- before the Arrival Control migrations run.

set search_path to public;

create or replace function public.noxia_ship_docking_class(p_ship_type_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(p_ship_type_id, ''))
    when 'heavy_hauler' then 'intersolar-heavy'
    when 'pioneer' then 'intersolar-heavy'
    when 'asce-0.3p' then 'surface-transfer-shuttle'
    when 'service_craft' then 'service-craft'
    when 'service-craft' then 'service-craft'
    else 'intersolar-standard'
  end
$$;

revoke all on function public.noxia_ship_docking_class(text) from public, anon, authenticated;
grant execute on function public.noxia_ship_docking_class(text) to service_role;

comment on function public.noxia_ship_docking_class(text) is
  'Canonical docking vessel class for a ship_type_id; overload used by Arrival Control without requiring a ship instance.';
