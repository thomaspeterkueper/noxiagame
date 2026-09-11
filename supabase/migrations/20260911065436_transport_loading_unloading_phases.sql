-- Mirrors production migration 20260911065436_transport_loading_unloading_phases.
-- Makes loading and unloading first-class observable phases while preserving
-- backwards compatibility for callers that start directly from reserved or
-- complete directly from arrived.

create or replace function public.noxia_begin_loading_transport_job(
  p_job_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_job public.transport_jobs%rowtype;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status='loading' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status<>'reserved' then raise exception 'NOXIA_TRANSPORT_JOB_STATE_INVALID:%',v_job.status using errcode='P0001'; end if;
  if v_job.vehicle_inventory_id is null then raise exception 'NOXIA_TRANSPORT_VEHICLE_REQUIRED' using errcode='P0001'; end if;
  update public.transport_jobs set status='loading',updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_start_transport_job(
  p_job_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_job public.transport_jobs%rowtype;
  v_capacity integer;
  v_eta integer;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status='in_transit' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status not in ('reserved','loading') then raise exception 'NOXIA_TRANSPORT_JOB_STATE_INVALID:%',v_job.status using errcode='P0001'; end if;
  if v_job.vehicle_inventory_id is null then raise exception 'NOXIA_TRANSPORT_VEHICLE_REQUIRED' using errcode='P0001'; end if;
  if v_job.domain='surface' and coalesce((v_job.route_snapshot->>'passable')::boolean,false) is not true then raise exception 'NOXIA_TRANSPORT_ROUTE_NOT_PASSABLE' using errcode='P0001'; end if;
  if public.noxia_inventory_amount(v_job.source_inventory_id,v_job.resource) < v_job.amount then raise exception 'NOXIA_INVENTORY_STOCK_INSUFFICIENT' using errcode='P0001'; end if;
  v_capacity:=public.noxia_inventory_capacity(v_job.vehicle_inventory_id);
  if v_capacity is not null and public.noxia_inventory_total_amount(v_job.vehicle_inventory_id)+v_job.amount>v_capacity then raise exception 'NOXIA_TRANSPORT_VEHICLE_CAPACITY_INSUFFICIENT' using errcode='P0001'; end if;

  perform public.noxia_adjust_inventory_amount(v_job.source_inventory_id,v_job.resource,-v_job.amount);
  perform public.noxia_adjust_inventory_amount(v_job.vehicle_inventory_id,v_job.resource,v_job.amount);
  update public.logistics_reservations set status='consumed',settled_at=now() where purpose_type='transport_job' and purpose_id=v_job.id and direction='outbound' and status='active';
  if coalesce(v_job.route_snapshot->>'etaSeconds','') ~ '^[0-9]+$' then v_eta:=(v_job.route_snapshot->>'etaSeconds')::integer; end if;
  if v_eta is null or v_eta <= 0 then raise exception 'NOXIA_TRANSPORT_ROUTE_ETA_REQUIRED' using errcode='P0001'; end if;
  update public.transport_jobs set status='in_transit',started_at=coalesce(started_at,now()),arrives_at=now()+make_interval(secs=>v_eta),updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_arrive_transport_job(
  p_job_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare v_job public.transport_jobs%rowtype;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status in ('arrived','unloading','completed') then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status<>'in_transit' then raise exception 'NOXIA_TRANSPORT_JOB_STATE_INVALID:%',v_job.status using errcode='P0001'; end if;
  if v_job.arrives_at is not null and v_job.arrives_at>now() then raise exception 'NOXIA_TRANSPORT_NOT_ARRIVED:%',extract(epoch from (v_job.arrives_at-now()))::integer using errcode='P0001'; end if;
  update public.transport_jobs set status='arrived',arrived_at=coalesce(arrived_at,now()),updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_begin_unloading_transport_job(
  p_job_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_job public.transport_jobs%rowtype;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status='unloading' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status<>'arrived' then raise exception 'NOXIA_TRANSPORT_JOB_STATE_INVALID:%',v_job.status using errcode='P0001'; end if;
  update public.transport_jobs set status='unloading',updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_complete_transport_job(
  p_job_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_job public.transport_jobs%rowtype;
  v_capacity integer;
  v_total integer;
  v_other_inbound integer;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status='completed' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status='in_transit' and v_job.arrives_at is not null and v_job.arrives_at<=now() then
    update public.transport_jobs set status='arrived',arrived_at=coalesce(arrived_at,now()),updated_at=now() where id=v_job.id returning * into v_job;
  end if;
  if v_job.status not in ('arrived','unloading') then raise exception 'NOXIA_TRANSPORT_JOB_STATE_INVALID:%',v_job.status using errcode='P0001'; end if;
  if v_job.vehicle_inventory_id is null then raise exception 'NOXIA_TRANSPORT_VEHICLE_REQUIRED' using errcode='P0001'; end if;
  if public.noxia_inventory_amount(v_job.vehicle_inventory_id,v_job.resource)<v_job.amount then raise exception 'NOXIA_TRANSPORT_VEHICLE_CARGO_MISSING' using errcode='P0001'; end if;

  update public.logistics_reservations set status='consumed',settled_at=now() where purpose_type='transport_job' and purpose_id=v_job.id and direction='inbound' and status='active';
  v_capacity:=public.noxia_inventory_capacity(v_job.destination_inventory_id);
  if v_capacity is not null then
    v_total:=public.noxia_inventory_total_amount(v_job.destination_inventory_id);
    select coalesce(sum(amount),0)::integer into v_other_inbound from public.logistics_reservations where inventory_id=v_job.destination_inventory_id and direction='inbound' and status='active';
    if v_total+v_other_inbound+v_job.amount>v_capacity then raise exception 'NOXIA_INVENTORY_CAPACITY_INSUFFICIENT' using errcode='P0001'; end if;
  end if;
  perform public.noxia_adjust_inventory_amount(v_job.vehicle_inventory_id,v_job.resource,-v_job.amount);
  perform public.noxia_adjust_inventory_amount(v_job.destination_inventory_id,v_job.resource,v_job.amount);
  update public.transport_jobs set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_cancel_transport_job(
  p_job_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare v_job public.transport_jobs%rowtype;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status='cancelled' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status not in ('reserved','loading') then raise exception 'NOXIA_TRANSPORT_CANCEL_REQUIRES_RESERVED_OR_LOADING:%',v_job.status using errcode='P0001'; end if;
  update public.logistics_reservations set status='released',settled_at=now() where purpose_type='transport_job' and purpose_id=v_job.id and status='active';
  update public.transport_jobs set status='cancelled',cancelled_at=now(),updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

revoke all on function public.noxia_begin_loading_transport_job(uuid,uuid) from public, anon, authenticated;
revoke all on function public.noxia_begin_unloading_transport_job(uuid,uuid) from public, anon, authenticated;
grant execute on function public.noxia_begin_loading_transport_job(uuid,uuid) to service_role;
grant execute on function public.noxia_begin_unloading_transport_job(uuid,uuid) to service_role;
