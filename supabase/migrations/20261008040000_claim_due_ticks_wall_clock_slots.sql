-- Tick heartbeat: count crossed wall-clock slots instead of elapsed time.
--
-- Before: due = floor((now() - last_claim_at) / interval). The hourly cron does
-- not fire at exactly the same millisecond each hour. Whenever a run arrived a
-- few milliseconds *earlier* in the hour than the previous one, the elapsed
-- time was 3599.x s, due was 0 and the hour produced no tick. The next run then
-- claimed either 2 ticks at once or, with unlucky jitter again, only 1 and the
-- hour was lost for good.
--
-- Now: due = number of interval boundaries (epoch-aligned, i.e. full hours for
-- 3600 s) crossed since the last claim. Every hourly run crosses exactly one
-- boundary regardless of jitter. Catch-up after a real outage still works and
-- stays capped by p_max.

create or replace function public.claim_due_ticks(p_interval_seconds integer, p_max integer)
returns table(claimed integer, latest_tick bigint)
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_last_at  timestamptz;
  v_last_num bigint;
  v_due      int;
  i          int;
begin
  -- Serialisiert alle Aufrufer bis zum Transaktionsende
  perform pg_advisory_xact_lock(778899);

  select created_at, tick_number
    into v_last_at, v_last_num
    from tick_log
    order by tick_number desc
    limit 1;

  -- Allererster Aufruf: Basis-Tick anlegen, nichts nachzurechnen
  if v_last_num is null then
    insert into tick_log(tick_number, tick_type) values (1, 'baseline');
    claimed := 0; latest_tick := 1;
    return next; return;
  end if;

  v_due := (floor(extract(epoch from now()) / p_interval_seconds)
          - floor(extract(epoch from v_last_at) / p_interval_seconds))::int;
  if v_due < 1 then
    claimed := 0; latest_tick := v_last_num;
    return next; return;
  end if;
  if v_due > p_max then v_due := p_max; end if;

  -- Slots beanspruchen (created_at = now() → Folge-Aufrufer im selben Slot sehen nichts fällig)
  for i in 1..v_due loop
    insert into tick_log(tick_number, tick_type)
      values (v_last_num + i, 'full');
  end loop;

  claimed := v_due; latest_tick := v_last_num + v_due;
  return next;
end $function$;

revoke execute on function public.claim_due_ticks(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_due_ticks(integer, integer) to service_role;
