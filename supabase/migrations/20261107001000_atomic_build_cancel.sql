-- #615: cancellation is atomic and refuses to infer refunds from mutable prices.
-- Draft migration: deployment requires backfill policy and integration tests.
alter table public.player_builds
  add column if not exists refund_credits_snapshot integer;

-- A snapshot is optional for legacy rows, but must never be negative.
-- A missing snapshot prevents cancellation rather than guessing a refund.
alter table public.player_builds
  add constraint player_builds_refund_snapshot_nonnegative
  check (refund_credits_snapshot is null or refund_credits_snapshot >= 0);

create or replace function public.noxia_cancel_build(p_profile_id uuid, p_build_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_build public.player_builds%rowtype;
  v_credits integer;
begin
  if p_profile_id is null or p_build_id is null then
    raise exception 'NOXIA_CANCEL_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;
  select * into v_build from public.player_builds
  where id = p_build_id for update;
  if not found or v_build.profile_id is distinct from p_profile_id then
    raise exception 'NOXIA_CANCEL_BUILD_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_build.target_type is distinct from 'building' then
    raise exception 'NOXIA_CANCEL_TARGET_INVALID:%', v_build.target_type using errcode = 'P0001';
  end if;
  if v_build.status = 'cancelled' then
    return jsonb_build_object('build_id', v_build.id, 'status', 'cancelled',
      'refund', 0, 'idempotent', true);
  end if;
  if v_build.status is distinct from 'building' then
    raise exception 'NOXIA_CANCEL_INVALID_STATUS:%', v_build.status using errcode = 'P0001';
  end if;
  if v_build.refund_credits_snapshot is null
     or v_build.refund_credits_snapshot < 0 then
    raise exception 'NOXIA_CANCEL_REFUND_SNAPSHOT_REQUIRED' using errcode = 'P0001';
  end if;
  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'NOXIA_CANCEL_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  update public.player_builds set status = 'cancelled'
  where id = v_build.id and status = 'building';
  update public.profiles
  set credits = credits + v_build.refund_credits_snapshot
  where id = p_profile_id returning credits into v_credits;
  return jsonb_build_object('build_id', v_build.id, 'status', 'cancelled',
    'refund', v_build.refund_credits_snapshot, 'credits', v_credits,
    'idempotent', false);
end;
$$;
revoke all on function public.noxia_cancel_build(uuid,uuid) from public, anon, authenticated;
grant execute on function public.noxia_cancel_build(uuid,uuid) to service_role;
