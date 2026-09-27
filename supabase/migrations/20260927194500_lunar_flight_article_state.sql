-- Extend trusted spacecraft flight articles with the explicit physical quantities
-- required by ENG-LUNAR-ASCENT-r1. Values remain nullable and therefore fail
-- closed until measured/configured by authoritative NOXIA state.

alter table public.spacecraft_flight_articles
  add column if not exists crew_cargo_mission_equipment_kg numeric null
    check (crew_cargo_mission_equipment_kg is null or crew_cargo_mission_equipment_kg >= 0),
  add column if not exists usable_ascent_propellant_kg numeric null
    check (usable_ascent_propellant_kg is null or usable_ascent_propellant_kg >= 0);

comment on column public.spacecraft_flight_articles.crew_cargo_mission_equipment_kg is
  'Resolved combined crew, cargo and mission-equipment physical mass for Engineering ascent envelopes; never inferred from legacy gameplay units.';
comment on column public.spacecraft_flight_articles.usable_ascent_propellant_kg is
  'Resolved usable ascent propellant mass for Engineering authority checks; null means unresolved and must fail closed.';
