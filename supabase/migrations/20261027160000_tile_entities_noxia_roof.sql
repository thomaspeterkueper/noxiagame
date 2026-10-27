-- Erdkarte (Thomas, 27.10.2026): Das Startcafé im realen Haus Hauptstraße 72 bekommt
-- auf der Weltkarte das NOXIA-Dach, wie die öffentlichen Gebäude des Ortes (W-7).
-- Gekaufte und umgebaute Häuser behalten dagegen ihr reales Aussehen. In der Datenbank
-- sind beide sonst nicht zu unterscheiden (Spielergebäude mit source_ref), deshalb ein
-- ausdrückliches Merkmal.

alter table public.tile_entities add column if not exists noxia_roof boolean not null default false;
comment on column public.tile_entities.noxia_roof is
  'Weltkarte: Gebäude im realen Haus mit NOXIA-Dach zeichnen statt im Aussehen des realen Hauses (z. B. Startcafé). Öffentliche Gebäude des Ortes bekommen es ohnehin.';

update public.tile_entities
   set noxia_roof = true
 where source_ref = 'osm:way:191141346' and entity_id = 'cafe' and status = 'active';
