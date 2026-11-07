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
  ) as valid_nonnegative_snapshots,
  -- Unexpected values must not be treated as valid historical refunds.
  count(*) filter (
    where to_jsonb(b)->>'refund_credits_snapshot' is not null
      and (to_jsonb(b)->>'refund_credits_snapshot') !~ '^[0-9]+$'
  ) as invalid_refund_snapshots,
  -- Only unfinished builds are blocked by absent/invalid snapshots.
  -- This is the count that must be reviewed before switching the API.
  count(*) filter (
    where b.status = 'building'
      and (
        to_jsonb(b)->>'refund_credits_snapshot' is null
        or (to_jsonb(b)->>'refund_credits_snapshot') !~ '^[0-9]+$'
      )
  ) as cancellation_blockers
from public.player_builds as b
where b.target_type = 'building'
  and b.status in ('building', 'cancelled')
group by b.target_type, b.status, b.buildable_id
order by missing_refund_snapshots desc, build_count desc, b.buildable_id;
