-- Repair encounter evidence lost by the central population-engine rewrite.
-- Source of truth for the backfill is persisted personal memory; no synthetic
-- encounters or relationship strength are created here.

with current_tick as (
  select coalesce(max(tick_number),0)::bigint as tick from public.tick_log
),
evidence as (
  select
    person_id,
    other_person_id,
    count(*) filter (
      where memory_kind in ('interaction','assistance','conflict','shared_work')
    )::integer as encounter_count,
    count(*) filter (
      where memory_kind in ('interaction','assistance','conflict','shared_work')
        and tick >= (select tick-72 from current_tick)
    )::integer as recent_72,
    count(*) filter (
      where memory_kind in ('interaction','assistance','conflict','shared_work')
        and tick >= (select tick-168 from current_tick)
    )::integer as recent_168,
    max(tick) filter (
      where memory_kind in ('interaction','assistance','conflict','shared_work')
    )::bigint as last_evidence_tick
  from public.person_memories
  where other_person_id is not null
  group by person_id,other_person_id
),
reconstructed as (
  select
    person_id,
    other_person_id,
    encounter_count,
    least(
      1.0,
      recent_72 * 0.12
      + greatest(0,recent_168-recent_72) * 0.05
    )::numeric as recent_score,
    last_evidence_tick
  from evidence
  where encounter_count > 0
)
update public.person_relationships r
set
  encounter_count_total = greatest(r.encounter_count_total, x.encounter_count),
  recent_encounter_score = greatest(r.recent_encounter_score, x.recent_score),
  relationship_updated_tick = greatest(
    coalesce(r.relationship_updated_tick,0),
    coalesce(x.last_evidence_tick,0)
  ),
  updated_at = now()
from reconstructed x
where r.person_id=x.person_id
  and r.other_person_id=x.other_person_id;
