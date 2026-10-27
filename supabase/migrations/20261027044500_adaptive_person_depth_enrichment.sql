-- NOXIA-LIVING — first adaptive person-depth enrichment wave.
-- Enrich only people whose persisted simulation history already supports it.
-- IMPORTANT: person_key remains NULL so decision ownership stays with Living Population.

with eligible as (
  select
    p.id,
    p.display_name,
    l.name as location_name,
    pa.role_code,
    coalesce(a.display_name,'') as employer_name,
    (select count(*) from public.person_relationships r where r.person_id=p.id) as relationship_count,
    (select count(*) from public.person_memories m where m.person_id=p.id) as memory_count
  from public.people p
  join public.locations l on l.id=p.current_location_id
  join public.person_assignments pa
    on pa.person_id=p.id and pa.assignment_type='work' and pa.is_active
  left join public.actors a on a.id=pa.employer_actor_id
  where p.simulation_tier='active'
    and p.person_key is null
    and exists (
      select 1 from public.person_assignments h
      where h.person_id=p.id and h.assignment_type='home' and h.is_active
    )
    and exists (select 1 from public.person_economic_actors e where e.person_id=p.id)
    and exists (select 1 from public.person_appearance ap where ap.person_id=p.id)
    and exists (select 1 from public.person_life_state ls where ls.person_id=p.id)
),
qualified as (
  select *,
    case role_code
      when 'geologist' then 'Geologe/in'
      when 'operator' then 'Betriebsoperator/in'
      when 'administrator' then 'Verwaltung'
      when 'technician' then 'Techniker/in'
      when 'scientist' then 'Wissenschaftler/in'
      when 'trader' then 'Handel & Versorgung'
      when 'researcher' then 'Forschung'
      when 'sensor_operator' then 'Sensoroperator/in'
      when 'educator' then 'Bildung'
      when 'logistics' then 'Logistik'
      when 'engineer' then 'Ingenieur/in'
      when 'operations_lead' then 'Betriebsleitung'
      when 'systems_technician' then 'Systemtechnik'
      when 'data_analyst' then 'Datenanalyse'
      else initcap(replace(coalesce(role_code,'Bewohner/in'),'_',' '))
    end as role_label
  from eligible
  where relationship_count >= 3
    and memory_count >= 40
)
update public.people p
set
  public_role = coalesce(
    nullif(trim(p.public_role),''),
    q.role_label || ' · ' || q.location_name
  ),
  bio_short = coalesce(
    nullif(trim(p.bio_short),''),
    case
      when q.employer_name <> '' then
        'Arbeitet als ' || q.role_label || ' in ' || q.location_name || ' für ' || q.employer_name || '. Hat dort einen stabilen Wohn- und Arbeitsalltag.'
      else
        'Arbeitet als ' || q.role_label || ' in ' || q.location_name || '. Hat dort einen stabilen Wohn- und Arbeitsalltag.'
    end
  ),
  updated_at = now()
from qualified q
where p.id=q.id;

-- Mika is already a focal person but lacked an appearance row.
insert into public.person_appearance(
  person_id,
  gender_identity,
  gender_presentation,
  body_frame,
  skin_tone_code,
  hair_style_code,
  hair_color_code,
  facial_hair_code,
  visible_age_band,
  clothing_profile,
  cultural_heritage
)
select
  p.id,
  null,
  'masculine',
  'average',
  'skin_3',
  'short',
  'brown',
  'short',
  'adult',
  '{"work":"cafe","style":"practical"}'::jsonb,
  '{}'::jsonb
from public.people p
where p.person_key='earth-cafe-host'
on conflict (person_id) do nothing;
