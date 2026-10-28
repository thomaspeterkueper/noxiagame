-- NOXIA-NPC-RELIGION-0001 / -0002
-- Vertreter weiterer Religionen (Thomas, 28.10.2026: „katholisch, evangelisch,
-- muslimisch, jüdisch, hinduistisch, buddhistisch – müssen nicht alle in Sundern
-- sein, aber wichtig, dass sie vertreten sind und man mit ihnen sprechen kann“).
-- Katholisch: Elias Hartmann (St. Johannes Sundern) besteht bereits.
--
-- Muster wie Pfarrer-Pilot und Omnizedent/innen: normale aktive Personen,
-- Arbeitsort = reales importiertes Gotteshaus (region_feature), Wohnung = reales
-- Wohnhaus in Gehweite als Zuweisung an den Grundriss (ohne Eigentumswechsel).
-- Die Ordensfrau wohnt im Tempel. Gemeindeträger als Institution ohne Lohnsatz:
-- religiöse Institutionen haben in NOXIA noch keine modellierten Einnahmen.
-- Die Figuren sind erfunden; sie sprechen nicht für die realen Gemeinden.
--
-- Idempotent; bricht ab, wenn ein Ort fehlt.

create or replace function pg_temp.seed_place_person(
  p_key text, p_name text, p_birth int, p_bio text, p_role text, p_traits jsonb, p_look text,
  p_presentation text, p_work_src text, p_role_code text, p_employer text, p_employer_bio text,
  p_employer_weights jsonb, p_home_src text
) returns uuid language plpgsql as $$
declare
  v_tick bigint; v_earth uuid; v_work uuid; v_home uuid; v_person uuid; v_actor uuid; v_employer uuid; v_home_assignment uuid;
begin
  select coalesce(max(tick_number),0) into v_tick from public.tick_log;
  select id into v_earth from public.locations where slug='earth';
  select rf.id into v_work from public.region_features rf join public.celestial_regions cr on cr.id=rf.region_id
   where cr.body='earth' and rf.properties->>'noxia_source_id'=p_work_src order by rf.created_at limit 1;
  select rf.id into v_home from public.region_features rf join public.celestial_regions cr on cr.id=rf.region_id
   where cr.body='earth' and rf.properties->>'noxia_source_id'=coalesce(p_home_src,p_work_src) order by rf.created_at limit 1;
  if v_earth is null or v_work is null or v_home is null then
    raise exception 'NOXIA_RELIGION_PLACE_MISSING %', p_key;
  end if;

  select id into v_person from public.people where person_key=p_key limit 1;
  if v_person is null then
    insert into public.people(display_name,birth_year,current_location_id,simulation_tier,activity_state,last_action,
      last_decision_factors,last_tick,person_key,bio_short,public_role,traits,observable_description)
    values (p_name,p_birth,v_earth,'active','idle','settled_here','{}'::jsonb,v_tick,p_key,p_bio,p_role,p_traits,p_look)
    returning id into v_person;
  end if;

  select id into v_employer from public.actors where kind='institution' and display_name=p_employer order by created_at limit 1;
  if v_employer is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values ('institution',p_employer,p_employer_bio,'{}'::jsonb,p_employer_weights) returning id into v_employer;
  end if;

  select actor_id into v_actor from public.person_economic_actors where person_id=v_person;
  if v_actor is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values ('npc_person',p_name,'Persönlicher Wirtschaftsakteur der Living Population.','{}'::jsonb,'{}'::jsonb) returning id into v_actor;
    insert into public.person_economic_actors(person_id,actor_id) values (v_person,v_actor);
  end if;

  insert into public.person_life_state(person_id,life_stage,age_ticks,family_desire,last_family_event_tick)
  values (v_person,'adult',0,0.5,null) on conflict (person_id) do nothing;
  insert into public.person_needs(person_id,need_code,satisfaction,updated_tick)
  values (v_person,'sustenance',0.70,v_tick),(v_person,'rest',0.70,v_tick),(v_person,'safety',0.70,v_tick),
         (v_person,'social',0.70,v_tick),(v_person,'purpose',0.70,v_tick),(v_person,'variety',0.70,v_tick)
  on conflict (person_id,need_code) do nothing;

  if not exists (select 1 from public.npc_ledger where actor_id=v_actor and ref='bootstrap:person:'||v_person::text) then
    insert into public.npc_ledger(actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note)
    values (v_actor,v_tick,'endowment',null,0,980,v_earth,'bootstrap:person:'||v_person::text,
      'Bootstrap-Startbestand des neu materialisierten NPC; keine wiederkehrende Einnahme');
  end if;

  select id into v_home_assignment from public.person_assignments
   where person_id=v_person and assignment_type='home' and is_active=true order by created_at limit 1;
  if v_home_assignment is null then
    insert into public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,region_feature_id,employer_actor_id,role_code,starts_tick,ends_tick,is_active)
    values (v_person,'home',v_earth,null,v_home,null,'resident',v_tick,null,true) returning id into v_home_assignment;
    insert into public.person_tenancies(assignment_id,person_id,location_id,tile_entity_id,landlord_actor_id,rent_per_billing,billing_interval_ticks,next_due_tick,status,origin,tenure)
    values (v_home_assignment,v_person,v_earth,null,null,null,720,null,'provided','provided','provided') on conflict (assignment_id) do nothing;
  end if;

  if not exists (select 1 from public.person_assignments where person_id=v_person and assignment_type='work' and is_active=true) then
    insert into public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,region_feature_id,employer_actor_id,role_code,starts_tick,ends_tick,is_active)
    values (v_person,'work',v_earth,null,v_work,v_employer,p_role_code,v_tick,null,true);
  end if;

  insert into public.person_appearance(person_id,gender_identity,gender_presentation,body_frame,skin_tone_code,hair_style_code,hair_color_code,facial_hair_code,visible_age_band,clothing_profile,cultural_heritage)
  values (
    v_person,null,p_presentation,
    case mod(abs(hashtextextended(v_person::text,23)),3) when 0 then 'slender' when 1 then 'average' else 'broad' end,
    'skin_'||(1+mod(abs(hashtextextended(v_person::text,37)),6))::text,
    case when p_role_code='monastic' then 'shaved' else
      case mod(abs(hashtextextended(v_person::text,41)),4) when 0 then 'short' when 1 then 'long' when 2 then 'curly' else 'short' end end,
    case mod(abs(hashtextextended(v_person::text,43)),4) when 0 then 'dark' when 1 then 'brown' when 2 then 'grey' else 'dark' end,
    case when p_presentation='masculine' and mod(abs(hashtextextended(v_person::text,47)),2)=0 then 'short' else 'none' end,
    'adult','{}'::jsonb,'{}'::jsonb
  ) on conflict (person_id) do nothing;
  return v_person;
end $$;

select pg_temp.seed_place_person(
  'earth-sundern-lukaskirche-pastor-001','Katrin Vogelsang',2064,
  'Evangelische Pfarrerin an der Lukaskirche in Sundern. Predigt, Seelsorge, Konfirmandenarbeit und ein offenes Ohr für Zweifel; trinkt ihren Kaffee gern im Gemeindezentrum.',
  'Pfarrerin · Lukaskirche','{"patience":0.74,"curiosity":0.68,"sociability":0.72}'::jsonb,
  'Eine Frau mittleren Alters mit Brille; begrüßt Leute mit Namen.','feminine',
  'osm:way:264006197','pastor','Evangelische Lukasgemeinde Sundern',
  'NOXIA-Gemeindeträger am real importierten Standort Lukaskirche in Sundern.',
  '{"domain":"religious_community","tradition":"christian","denomination":"protestant"}'::jsonb,
  'osm:way:309525841');

select pg_temp.seed_place_person(
  'earth-frankfurt-hamidiye-imam-001','Yusuf Demir',2070,
  'Imam an der Hamidiye-Moschee in Frankfurt-Sachsenhausen. Leitet das Freitagsgebet, unterrichtet Koranlesen, berät Familien und spricht Deutsch, Türkisch und Arabisch.',
  'Imam · Hamidiye-Moschee','{"patience":0.80,"curiosity":0.62,"sociability":0.70}'::jsonb,
  'Ein Mann um die vierzig mit gepflegtem Bart; ruhig und freundlich.','masculine',
  'osm:node:5174702142','imam','Hamidiye-Moschee Frankfurt – Gemeinde',
  'NOXIA-Gemeindeträger am real importierten Standort Hamidiye-Moschee in Frankfurt.',
  '{"domain":"religious_community","tradition":"islamic","denomination":"sunni"}'::jsonb,
  'osm:way:174662462');

select pg_temp.seed_place_person(
  'earth-frankfurt-baumweg-rabbi-001','David Rosenthal',2061,
  'Rabbiner an der Baumweg-Synagoge in Frankfurt. Gottesdienste zum Schabbat, Tora-Unterricht und Seelsorge; erzählt gern aus der langen Geschichte der jüdischen Gemeinde Frankfurts.',
  'Rabbiner · Baumweg-Synagoge','{"patience":0.78,"curiosity":0.80,"sociability":0.64}'::jsonb,
  'Ein älterer Mann mit Kippa und grauem Bart; hört aufmerksam zu.','masculine',
  'osm:way:135194156','rabbi','Jüdische Gemeinde – Baumweg-Synagoge',
  'NOXIA-Gemeindeträger am real importierten Standort Baumweg-Synagoge in Frankfurt.',
  '{"domain":"religious_community","tradition":"jewish"}'::jsonb,
  'osm:way:30389764');

select pg_temp.seed_place_person(
  'earth-dwarka-dwarkadhish-pujari-001','Mahesh Pandya',2072,
  'Pujari am Dwarkadhish-Tempel in Dvārakā. Hält die täglichen Aartis für Krishna als Dwarkadhish, den König von Dvārakā, und erklärt Pilgern die Geschichte der Stadt.',
  'Pujari · Dwarkadhish-Tempel','{"patience":0.76,"curiosity":0.66,"sociability":0.74}'::jsonb,
  'Ein Mann um die vierzig in weißem Dhoti; lächelt viel.','masculine',
  'osm:way:1343177752','priest','Dwarkadhish-Tempel Dvārakā',
  'NOXIA-Träger am real importierten Standort Dwarkadhish-Tempel in Dvārakā.',
  '{"domain":"religious_community","tradition":"hindu"}'::jsonb,
  'osm:way:1343177610');

select pg_temp.seed_place_person(
  'earth-frankfurt-foguangshan-monastic-001','Miao Ling',2075,
  'Buddhistische Ordensfrau am Fo-Guang-Shan-Tempel in Frankfurt, wo sie auch lebt. Lehrt humanistischen Buddhismus, leitet Meditation und die sonntägliche Andacht mit Dharma-Vortrag.',
  'Ordensfrau · Fo-Guang-Shan-Tempel','{"patience":0.86,"curiosity":0.70,"sociability":0.62}'::jsonb,
  'Eine Frau mit kahlem Kopf in brauner Robe; spricht leise und klar.','feminine',
  'osm:node:487332120','monastic','Fo-Guang-Shan-Tempel Frankfurt',
  'NOXIA-Träger am real importierten Standort Fo-Guang-Shan-Tempel in Frankfurt.',
  '{"domain":"religious_community","tradition":"buddhist","school":"humanistic"}'::jsonb,
  null);
