-- Reconcile the repository migration history with the live world-placement schema.
--
-- World placement is canonical in metric/geodetic coordinates and therefore has
-- no meaningful legacy grid row/column. Production already carries these
-- columns as nullable; fresh preview databases must reach the same state before
-- the Selmecke/world-object seeds run.

set search_path to public;

alter table public.tile_entities
  alter column tile_row drop not null,
  alter column tile_col drop not null;

comment on column public.tile_entities.tile_row is
  'Legacy grid row. Nullable for placement_mode=world; not a canonical planetary coordinate.';
comment on column public.tile_entities.tile_col is
  'Legacy grid column. Nullable for placement_mode=world; not a canonical planetary coordinate.';
