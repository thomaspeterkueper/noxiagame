-- NOXIA-LIVING-0010 — housing shadow calibration and grounded live preparation.
-- 2026-10-13
--
-- This migration does NOT enable automatic voluntary relocation.
-- It:
--   1) adds decision diagnostics,
--   2) reconstructs missing starts_tick from assignment timestamps,
--   3) exposes three empty private dwellings to shadow evaluation at calibrated rents,
--   4) executes two already-granted public placements for currently unhoused people.

set search_path to public;

alter table public.housing_shadow_decisions
  add column if not exists discontent numeric not null default 0,
  add column if not exists monotony numeric not null default 0,
  add column if not exists bad_company numeric not null default 0,
  add column if not exists scarcity numeric not null default 0,
  add column if not exists rent_strain numeric not null default 0,
  add column if not exists crowding numeric not null default 0,
  add column if not exists insecurity numeric not null default 0,
  add column if not exists commute_burden numeric not null default 0,
  add column if not exists cooldown_blocked boolean not null default false,
  add column if not exists current_housing_value numeric not null default 0,
  add column if not exists best_candidate_value numeric;

-- Reconstruct legacy move timing from the real creation timestamp against tick_log.
-- This avoids pretending that all legacy residents moved in today.
update public.person_assignments pa
set starts_tick = coalesce(
  (
    select max(t.tick_number)
    from public.tick_log t
    where t.created_at <= pa.created_at
  ),
  1
)
where pa.assignment_type='home'
  and pa.is_active=true
  and pa.starts_tick is null;

-- Small test market, derived from current live wages (55 / 70 / 80 / 90 / 110 per day).
-- Billing interval is 720 ticks = 30 days. These rents span roughly 20–44% of
-- monthly wage across the observed distribution, so affordability is heterogeneous.
-- Only currently empty private dwellings are opened.
update public.tile_entities
set lease_price = case id
  when '3bdddfb3-d56f-4ea1-b8a7-18fb31616afe'::uuid then 480
  when '225f2239-d8c0-4c00-9a70-0004c6f64cbc'::uuid then 600
  when 'b3b3a88f-cd30-4ea8-8e7d-c53f5f7dfe54'::uuid then 720
  else lease_price
end
where id in (
  '3bdddfb3-d56f-4ea1-b8a7-18fb31616afe',
  '225f2239-d8c0-4c00-9a70-0004c6f64cbc',
  'b3b3a88f-cd30-4ea8-8e7d-c53f5f7dfe54'
)
and owner_class='PLAYER'
and residential_capacity > 0
and lease_price is null
and not exists (
  select 1 from public.person_assignments pa
  where pa.tile_entity_id=public.tile_entities.id
    and pa.assignment_type='home'
    and pa.is_active=true
);

-- Two people have received the same public-housing grant on every shadow day
-- from tick 2136 through 2232. Execute exactly that already-grounded placement.
do $$
declare
  v_tick bigint := (select coalesce(max(tick_number),0) from public.tick_log);
  v_target uuid := '203e82d7-3bd4-441b-97c2-ccd611b85ecf';
  v_person uuid;
begin
  foreach v_person in array array[
    '2cc0fe39-517f-45ee-ad04-ec8a4f4e825f'::uuid,
    'bfb54052-262e-47ee-8628-04843be43ade'::uuid
  ]
  loop
    if exists (select 1 from public.people where id=v_person)
       and not exists (
         select 1 from public.person_assignments
         where person_id=v_person and assignment_type='home' and is_active=true
       )
       and exists (
         select 1 from public.tile_entities
         where id=v_target and owner_class='STATE' and status='active'
           and residential_capacity > 0
       )
    then
      perform public.move_person_to_public_housing(v_person,v_target,v_tick);
    end if;
  end loop;
end $$;

comment on column public.housing_shadow_decisions.discontent is
  'Normalized relocation pressure at decision time.';
comment on column public.housing_shadow_decisions.cooldown_blocked is
  'True when pressure crossed the threshold but the relocation cooldown prevented action.';
comment on column public.housing_shadow_decisions.best_candidate_value is
  'Best eligible housing-value score visible to the shadow decision, or null when none exists.';
