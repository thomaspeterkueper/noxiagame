-- supabase/migrations/20261106080000_farm_goods.sql
-- Erträge aus Feld und Weide als Güter (NOXIA-MAT-0001; Lebensmittelkette NOXIA-FOOD-0002
-- kennt Getreide und Kartoffeln schon als Güter). Eigene Datei, weil neue Werte eines
-- Aufzählungstyps erst nach dem Commit nutzbar sind.
-- Einheiten: Tonnen; Rinder in Stück.
alter type public.resource_type add value if not exists 'grain';
alter type public.resource_type add value if not exists 'potatoes';
alter type public.resource_type add value if not exists 'cattle';
