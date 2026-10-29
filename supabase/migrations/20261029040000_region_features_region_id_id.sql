-- Kartenkacheln: Objekte einer Region seitenweise nach ID lesen (lib/worldlab/tileSource.server.ts).
-- Ohne diesen Index las jede Seite den ganzen Primärschlüssel (75 000 Zeilen) und
-- filterte nach Region; bei vielen Kacheln gleichzeitig lief das in die Zeitgrenze
-- (Fehler 57014 auf /api/world-lab/tile, Auswertung des Spielerverhaltens 28.10.2026).
create index if not exists region_features_region_id_id_idx on public.region_features (region_id, id);
