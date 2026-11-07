-- Issue #615 / PR #627: READ-ONLY legacy cancellation audit.
-- Run manually against a disposable clone before deciding how to handle
-- pre-snapshot builds. Safe to run before OR after the draft migration.
-- No ownership identifiers or player data are returned.
-- A NULL snapshot is an unknown historical refund, NOT a zero-credit refund.
-- Never backfill from today's mutable building_definitions prices.

select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'player_builds'
    and column_name = 'refund_credits_snapshot'
) as refund_snapshot_column_present;

select
  b.target_type,
  b.status,
  b.buildable_id,
  count(*) as build_count,
  count(*) filter (
    where to_jsonb(b)->>'refund_credits_snapshot' is null
  ) as missing_refund_snapshots,
  count(*) filter (
    where (to_jsonb(b)->>'refund_credits_snapshot') ~ '^[0-9]+$'
  ) as valid_nonnegative_snapshots
from public.player_builds as b
where b.target_type = 'building'
  and b.status in ('building', 'cancelled')
group by b.target_type, b.status, b.buildable_id
order by missing_refund_snapshots desc, build_count desc, b.buildable_id;
