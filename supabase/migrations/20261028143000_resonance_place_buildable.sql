-- NOXIA-NPC-RELIGION-0002: Resonanzplatz als baubarer Gebäudetyp (Thomas, 28.10.2026).
-- Gebaut wird über den normalen Bauweg (player_builds, Geld des Bauherrn), nicht per Seed.
-- Kein Personal, keine Produktion. Steht im Tharsis Hub einer, lädt Theodor Grün
-- (mars-tharsis-omnizedent-001) dort wöchentlich zur Resonanzrunde ein (realPlaceActivity).
insert into public.building_definitions (key, name, tier, category, is_active, production, consumption, description, cost_credits, build_time_ticks, population_bonus, sort_order)
values ('resonance_place', 'Resonanzplatz', 1, 'life', true, '[]'::jsonb, '[]'::jsonb,
        'Offener Ort der Omnizedenz für Begegnung, Gespräch, Lesen und Stille. Kein Personal nötig.', 1500, 2, 0, 155)
on conflict (key) do update set name = excluded.name, description = excluded.description, is_active = true,
  cost_credits = excluded.cost_credits, build_time_ticks = excluded.build_time_ticks;
