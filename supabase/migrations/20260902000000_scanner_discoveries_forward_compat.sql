-- Forward compatibility for databases where a scanner_discoveries migration
-- variant is already recorded in migration history.
--
-- Fresh databases obtain the canonical shape from 20260831220000:
-- measurement_count column, row level security, no browser grants, no policies.
-- Databases that recorded the 20260901093000 variant created the table without
-- measurement_count and with an owner-read policy that can never match because
-- grants to anon/authenticated are revoked. db push never re-applies an
-- already-recorded version, so this migration converges those databases onto
-- the canonical shape. Idempotent and a no-op where the canonical shape already
-- exists.

set search_path to public;

do $$
begin
  if to_regclass('public.scanner_discoveries') is not null then
    alter table public.scanner_discoveries
      add column if not exists measurement_count integer not null default 1 check (measurement_count > 0);

    drop policy if exists "scanner discoveries readable by owner" on public.scanner_discoveries;

    revoke all on public.scanner_discoveries from anon, authenticated;
  end if;
end $$;
