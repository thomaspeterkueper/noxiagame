-- Korrektur zu 20261028150000: Das Wohnhaus Lange Straße 26 (osm:way:30389764) ist das
-- Kolpinghaus Frankfurt, eine katholische Einrichtung – kein passender Wohnort für den
-- Rabbiner. Neue Wohnung: Mehrfamilienhaus Lange Straße 22 (osm:way:175084512), ohne
-- Einrichtung, rund 525 m von der Baumweg-Synagoge.
update public.person_assignments pa
set region_feature_id = (
      select rf.id from public.region_features rf join public.celestial_regions cr on cr.id=rf.region_id
      where cr.body='earth' and rf.properties->>'noxia_source_id'='osm:way:175084512'
      order by rf.created_at limit 1),
    updated_at = now()
from public.people p
where p.id=pa.person_id and p.person_key='earth-frankfurt-baumweg-rabbi-001'
  and pa.assignment_type='home' and pa.is_active
  and exists (select 1 from public.region_features rf where rf.properties->>'noxia_source_id'='osm:way:175084512')
  and pa.region_feature_id in (select id from public.region_features where properties->>'noxia_source_id'='osm:way:30389764');
