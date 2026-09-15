-- Backfill legacy intersolar ships already parked at the aggregated Moon node.
-- Before Lunar Orbital Interface existed, `ships.location = moon, status = docked`
-- was the only available projection. These ships are not surface-landed: place
-- them in Lunar Arrival Control unless a physical docking connection already exists.

set search_path = public;

insert into public.ship_arrival_states (
  ship_id,
  station_slug,
  phase,
  holding_zone_id,
  holding_reason,
  queue_entered_at,
  target_port_id,
  created_at,
  updated_at
)
select
  s.id,
  'moon',
  'holding',
  public.noxia_arrival_holding_zone('moon', public.noxia_ship_docking_class(s.id)),
  'legacy-arrival-backfill',
  coalesce(s.updated_at, s.created_at, now()),
  null,
  now(),
  now()
from public.ships s
where public.noxia_canonical_station_slug(s.location) = 'moon'
  and s.status = 'docked'
  and public.noxia_ship_docking_class(s.id) in ('intersolar-standard', 'intersolar-heavy')
  and not exists (
    select 1 from public.ship_arrival_states a where a.ship_id = s.id
  )
  and not exists (
    select 1 from public.docking_connections c
    where c.ship_id = s.id and c.status = 'docked'
  )
on conflict (ship_id) do nothing;
