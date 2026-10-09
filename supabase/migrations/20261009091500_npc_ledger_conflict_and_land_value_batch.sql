-- NOXIA-PERF: make PostgREST's five-column npc_ledger upsert conflict
-- target match a real unique index (the prior expression index cannot arbitrate it).
-- NULLS NOT DISTINCT preserves the previous coalesce-based idempotency semantics.
create unique index if not exists npc_ledger_postgrest_upsert_idx
  on public.npc_ledger (actor_id, tick, kind, resource, ref) nulls not distinct;

-- Set-based, change-only land value refresh: replaces per-tile HTTP updates.
create or replace function public.refresh_changed_land_values()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  with candidates as (
    select te.id,
      (
        10
        + least(200, round(coalesce(l.population,0) * 0.02))
        + 50
        + greatest(0, round(
            100 - sqrt(
              power(coalesce(te.tile_row,5) - 5, 2)
              + power(coalesce(te.tile_col,5) - 5, 2)
            ) * 10
          ))
      )::integer as computed_value
    from public.tile_entities te
    join public.locations l on l.id = te.location_id
    where l.population > 0
      and te.entity_type = 'building'
  )
  update public.tile_entities te
  set land_value = c.computed_value,
      land_value_updated_at = now()
  from candidates c
  where te.id = c.id
    and te.land_value is distinct from c.computed_value;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.refresh_changed_land_values() from public, anon, authenticated;
grant execute on function public.refresh_changed_land_values() to service_role;
