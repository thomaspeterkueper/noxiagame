-- supabase/migrations/20261106020000_construction_material_goods.sql
-- Baustoffe als Güter im Inventar (NOXIA-MAT-0001, Request 20261028-0040).
-- Eigene Datei, weil neue Werte eines Aufzählungstyps erst nach dem Commit nutzbar sind.
-- Einheiten: Tonnen; Holz in Kubikmetern (ganzzahlig, wie alle Inventarmengen).
alter type public.resource_type add value if not exists 'roundwood';
alter type public.resource_type add value if not exists 'lumber';
alter type public.resource_type add value if not exists 'stone';
alter type public.resource_type add value if not exists 'gravel';
alter type public.resource_type add value if not exists 'sand';
alter type public.resource_type add value if not exists 'cement';
alter type public.resource_type add value if not exists 'concrete';
alter type public.resource_type add value if not exists 'bricks';
alter type public.resource_type add value if not exists 'steel';
alter type public.resource_type add value if not exists 'regolith';
