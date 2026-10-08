-- NOXIA-LIVING-0010, Stufe 3 — Wohnkapazität, staatliche Grundversorgung, Konten.
--
-- Entscheidungen vom 2026-10-08:
--   * Die sieben Tharsis-Leitungen bekommen ein neues staatliches Habitat.
--   * Prometheus bekommt ein staatliches Habitat; die vier dort Arbeitenden bleiben.
--   * Habitat = 8 Plätze, Wohnblock = 12 Plätze, als echte residential_capacity.
--   * Jeder Ort mit Bewohnern hat eine staatlich garantierte Minimalunterkunft.
--     Hier umgesetzt als Gästeplätze im staatlichen Habitat (transient_capacity),
--     nicht als neuer Gebäudetyp: Die Oberfläche kennt 'habitat', einen neuen
--     Typ müsste sie erst darstellen können.
--   * Alle Personen erhalten ein Wirtschaftskonto mit gekennzeichnetem Startbestand.
--   * Backfill-Zuweisungen sind als solche markiert und zählen später nicht als
--     freiwillige Marktentscheidung.
--
-- Die Migration ist wiederholbar: jeder Schritt prüft, ob er schon geschehen ist.
-- Sie verschiebt niemanden zwischen Orten und beendet keine bestehende Zuweisung.

begin;

-- 1. Kapazität je Wohngebäude ------------------------------------------------

alter table public.tile_entities
  add column if not exists residential_capacity integer check (residential_capacity is null or residential_capacity >= 0),
  add column if not exists transient_capacity integer not null default 0 check (transient_capacity >= 0);

comment on column public.tile_entities.residential_capacity is
  'Plätze für Bewohner (NOXIA-LIVING-0010). Belegung ergibt sich aus aktiven home-Zuweisungen, nicht aus population_bonus.';
comment on column public.tile_entities.transient_capacity is
  'Zusätzliche Gästeplätze für vorübergehende Unterkunft: Ankunft, Räumung, Wohnungssuche.';

update public.tile_entities set residential_capacity = 8
where entity_type = 'building' and entity_id = 'habitat' and residential_capacity is null;

update public.tile_entities set residential_capacity = 12
where entity_type = 'building' and entity_id = 'residential_block' and residential_capacity is null;

-- 2. Herkunft und Wohnform eines Mietverhältnisses --------------------------------

alter table public.person_tenancies
  add column if not exists origin text not null default 'provided'
    check (origin in ('backfill', 'provided', 'market')),
  add column if not exists tenure text not null default 'provided'
    check (tenure in ('provided', 'rented', 'owned', 'transient'));

comment on column public.person_tenancies.origin is
  'backfill = Datenbereinigung, provided = zugewiesen, market = eigene Entscheidung über den Markt. Nur market zählt in der Spielraum- und Machtanalyse.';

-- Alles, was heute besteht, ist gesetzt worden und keine Marktentscheidung.
update public.person_tenancies set origin = 'backfill' where origin = 'provided';

-- 3. Neue staatliche Habitate ------------------------------------------------

-- Tharsis (slug mars): Raster 20 m, x = -310 + Spalte*20, y = 230 - Zeile*20.
-- Zeile 1, Spalte 5 ist frei; Raumbezug wird vom Verwaltungsgebäude übernommen.
insert into public.tile_entities (
  location_id, tile_level, tile_row, tile_col, entity_type, entity_id, status,
  is_state_owned, owner_class, placement_mode, x_m, y_m, rotation_deg,
  footprint_width_m, footprint_depth_m, site_id, terrain_dataset_id, terrain_status,
  spatial_region_id, residential_capacity, transient_capacity
)
select admin.location_id, 0, 1, 5, 'building', 'habitat', 'active',
       true, 'STATE', 'world', -210, 210, 0,
       28, 22, admin.site_id, admin.terrain_dataset_id, admin.terrain_status,
       admin.spatial_region_id, 8, 2
from public.tile_entities admin
join public.locations l on l.id = admin.location_id
where l.slug = 'mars' and admin.entity_id = 'admin'
  and not exists (
    select 1 from public.tile_entities te
    where te.location_id = admin.location_id and te.entity_type = 'building'
      and te.tile_level = 0 and te.tile_row = 1 and te.tile_col = 5
  );

-- Prometheus nutzt das alte Kachelraster; Zeile 3, Spalte 7 ist frei.
insert into public.tile_entities (
  location_id, tile_level, tile_row, tile_col, entity_type, entity_id, status,
  is_state_owned, owner_class, placement_mode, residential_capacity, transient_capacity
)
select l.id, 0, 3, 7, 'building', 'habitat', 'active', true, 'STATE', 'legacy_tile', 8, 2
from public.locations l
where l.slug = 'prometheus'
  and not exists (
    select 1 from public.tile_entities te
    where te.location_id = l.id and te.entity_type = 'building'
      and te.tile_level = 0 and te.tile_row = 3 and te.tile_col = 7
  );

-- 4. Staatlich garantierte Minimalunterkunft ---------------------------------------

-- Zwei Gästeplätze in je einem staatlichen Habitat pro Ort.
update public.tile_entities te set transient_capacity = 2
where te.entity_type = 'building' and te.entity_id = 'habitat' and te.owner_class = 'STATE'
  and te.transient_capacity = 0
  and te.id = (
    select first.id from public.tile_entities first
    where first.location_id = te.location_id and first.entity_type = 'building'
      and first.entity_id = 'habitat' and first.owner_class = 'STATE'
    order by first.created_at, first.id limit 1
  );

-- 5. Wohnzuweisungen ---------------------------------------------------------

-- 5a. Die sieben benannten Leitungen in Tharsis: bisher ohne Wohnzuweisung.
insert into public.person_assignments (person_id, assignment_type, location_id, tile_entity_id, is_active)
select p.id, 'home', l.id, hab.id, true
from public.people p
join public.locations l on l.slug = 'mars' and l.id = p.current_location_id
join public.tile_entities hab on hab.location_id = l.id and hab.entity_type = 'building'
  and hab.entity_id = 'habitat' and hab.owner_class = 'STATE' and hab.tile_row = 1 and hab.tile_col = 5
where p.person_key is not null
  and not exists (
    select 1 from public.person_assignments a
    where a.person_id = p.id and a.assignment_type = 'home' and a.is_active
  );

-- 5b. Wohnzuweisungen ohne Gebäude auf Mond, Phobos und Prometheus:
--     in das staatliche Habitat des Ortes, solange dort Platz ist.
with target as (
  select distinct on (te.location_id) te.location_id, te.id, te.residential_capacity
  from public.tile_entities te
  join public.locations l on l.id = te.location_id
  where l.slug in ('moon', 'phobos', 'prometheus')
    and te.entity_type = 'building' and te.entity_id = 'habitat' and te.owner_class = 'STATE'
  order by te.location_id, te.created_at, te.id
),
waiting as (
  select a.id, a.location_id, row_number() over (partition by a.location_id order by a.person_id) as position
  from public.person_assignments a
  where a.assignment_type = 'home' and a.is_active and a.tile_entity_id is null
)
update public.person_assignments a
set tile_entity_id = target.id, updated_at = now()
from waiting
join target on target.location_id = waiting.location_id
where a.id = waiting.id
  and waiting.position + (
    select count(*) from public.person_assignments r
    where r.tile_entity_id = target.id and r.assignment_type = 'home' and r.is_active
  ) <= target.residential_capacity;

-- 5c. Mietverhältnisse dazu, ausdrücklich als Backfill und ohne Miete.
insert into public.person_tenancies (
  assignment_id, person_id, location_id, tile_entity_id, landlord_actor_id,
  rent_per_billing, billing_interval_ticks, next_due_tick, status, origin, tenure
)
select a.id, a.person_id, a.location_id, a.tile_entity_id, public.ensure_public_actor(a.location_id),
       null, 720, null, 'provided', 'backfill', 'provided'
from public.person_assignments a
join public.tile_entities te on te.id = a.tile_entity_id and te.owner_class = 'STATE'
where a.assignment_type = 'home' and a.is_active
on conflict (assignment_id) do update set
  tile_entity_id = excluded.tile_entity_id,
  landlord_actor_id = coalesce(public.person_tenancies.landlord_actor_id, excluded.landlord_actor_id),
  updated_at = now();

-- 6. Wirtschaftskonto für jede Person -----------------------------------------

-- Es wurde nie Lohn gezahlt, eine Lohnhistorie gibt es nicht. Der Startbestand
-- ist deshalb ein ausdrücklich gekennzeichneter Bootstrap: 14 Tageslöhne der
-- eigenen Rolle (60 je Tag, wo die Rolle keinen Satz hat). Er ist damit nicht
-- für alle gleich und bleibt im Hauptbuch über ref und note erkennbar.
do $$
declare
  v_person record;
  v_actor_id uuid;
  v_amount integer;
begin
  for v_person in
    select p.id, p.display_name, p.current_location_id,
           coalesce((
             select r.daily_credits from public.person_assignments a
             join public.role_wage_rates r on r.role_code = a.role_code
             where a.person_id = p.id and a.assignment_type = 'work' and a.is_active
             limit 1
           ), 60) as daily_wage
    from public.people p
    left join public.person_life_state pls on pls.person_id = p.id
    where coalesce(pls.life_stage, 'adult') = 'adult'
      and not exists (select 1 from public.person_economic_actors pea where pea.person_id = p.id)
    order by p.id
  loop
    insert into public.actors (kind, display_name, bio_short, personality, decision_weights)
    values ('npc_person', v_person.display_name, 'Persönlicher Wirtschaftsakteur der Living Population.', '{}'::jsonb, '{}'::jsonb)
    returning id into v_actor_id;

    insert into public.person_economic_actors (person_id, actor_id) values (v_person.id, v_actor_id);

    v_amount := v_person.daily_wage * 14;
    insert into public.npc_ledger (actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
    values (
      v_actor_id, 0, 'endowment', null, 0, v_amount, v_person.current_location_id,
      'bootstrap:person:' || v_person.id::text,
      'Bootstrap-Startbestand: 14 Tageslöhne, keine Lohnhistorie rekonstruierbar'
    );
  end loop;
end $$;

-- 7. Belegung als Sicht ------------------------------------------------------

create or replace view public.residential_occupancy
with (security_invoker = true) as
select te.id as tile_entity_id,
       te.location_id,
       te.entity_id,
       te.owner_class,
       te.residential_capacity,
       te.transient_capacity,
       count(a.id) filter (where a.assignment_type = 'home') as residents,
       greatest(0, coalesce(te.residential_capacity, 0) - count(a.id) filter (where a.assignment_type = 'home')) as free_places
from public.tile_entities te
left join public.person_assignments a on a.tile_entity_id = te.id and a.is_active
where te.entity_type = 'building' and te.residential_capacity is not null and te.status = 'active'
group by te.id;

revoke all on public.residential_occupancy from anon, authenticated;
grant select on public.residential_occupancy to service_role;

commit;
