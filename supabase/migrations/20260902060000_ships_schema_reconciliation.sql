-- Reconcile ship columns that exist in production but were previously introduced
-- outside the retained local migration chain. This migration is intentionally
-- idempotent so fresh Supabase preview branches reproduce production before the
-- docking-assignment release migration runs.

alter table public.ships
  add column if not exists ship_type_id text default 'freighter_mk1'::text,
  add column if not exists frame_entity_id uuid,
  add column if not exists is_active boolean default false;

-- Production has this FK and no dedicated indexes for these three columns.
-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS, so guard it explicitly.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'ships'
      and c.conname = 'ships_frame_entity_id_fkey'
  ) then
    alter table public.ships
      add constraint ships_frame_entity_id_fkey
      foreign key (frame_entity_id) references public.tile_entities(id);
  end if;
end
$$;

comment on column public.ships.ship_type_id is 'Canonical ship-type identifier; restored from production schema drift for reproducible previews.';
comment on column public.ships.frame_entity_id is 'Optional tile/entity frame associated with the ship.';
comment on column public.ships.is_active is 'Whether this ship is the currently active ship for gameplay/docking assignment purposes.';
