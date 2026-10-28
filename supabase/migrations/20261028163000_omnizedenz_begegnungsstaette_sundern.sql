-- Omnizedenz-Begegnungsstätte Sundern, Hauptstraße 87 (Thomas, 28.10.2026).
--
-- Das Haus wurde über den normalen Spielweg erworben (Konto McKnight):
--   buy_earth_parcel  Flurstück 05102802000122______ (Gemarkung Sundern, Flur 20,
--                     Flurstück 122, 310 m²) samt Haus osm:way:459501013 – 6000 Cr
--   convert_earth_building  → resonance_place – 750 Cr (halber Neubaupreis)
-- Diese Migration benennt das Haus und verlegt Johanna Linds Resonanzrunde
-- (mittwochs 19–21 Uhr) von der Hubertushalle dorthin.

update tile_entities
set display_name = 'Omnizedenz-Begegnungsstätte Sundern'
where entity_id = 'resonance_place'
  and source_ref = 'osm:way:459501013';

-- Arbeitsplatz: das umgebaute Haus statt der Hubertushalle.
update person_assignments pa
set tile_entity_id = te.id, region_feature_id = null, updated_at = now()
from people p, tile_entities te
where p.person_key = 'earth-sundern-omnizedent-001'
  and pa.person_id = p.id and pa.assignment_type = 'work' and pa.is_active
  and te.entity_id = 'resonance_place' and te.source_ref = 'osm:way:459501013';

update people
set public_role = 'Omnizedentin · Begegnungsstätte Hauptstraße 87', updated_at = now()
where person_key = 'earth-sundern-omnizedent-001';
