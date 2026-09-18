alter table public.core_sample_jobs
  add column if not exists target_depth_m integer not null default 10
  check (target_depth_m > 0 and target_depth_m <= 500);

create or replace function public.start_core_sample_job(
  p_profile_id uuid,
  p_location_id uuid,
  p_latitude_deg double precision,
  p_longitude_deg double precision,
  p_target_depth_m integer,
  p_energy_cost integer default 25,
  p_component_cost integer default 1,
  p_duration_seconds integer default 900
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_energy integer;
  v_components integer;
  v_job uuid;
begin
  if p_latitude_deg < -90 or p_latitude_deg > 90 or p_longitude_deg < -180 or p_longitude_deg > 180 then
    raise exception 'invalid_coordinates';
  end if;
  if p_target_depth_m <= 0 or p_target_depth_m > 500 then
    raise exception 'invalid_depth';
  end if;
  if not exists (
    select 1 from public.player_instruments
    where profile_id=p_profile_id and instrument_id='core_sample'
  ) then
    raise exception 'core_sample_not_owned';
  end if;

  select stock into v_energy
  from public.location_resources
  where location_id=p_location_id and resource='energy'
  for update;

  select stock into v_components
  from public.location_resources
  where location_id=p_location_id and resource='components'
  for update;

  if coalesce(v_energy,0) < p_energy_cost then raise exception 'insufficient_energy'; end if;
  if coalesce(v_components,0) < p_component_cost then raise exception 'insufficient_components'; end if;

  update public.location_resources
  set stock=stock-p_energy_cost, updated_at=now()
  where location_id=p_location_id and resource='energy';

  update public.location_resources
  set stock=stock-p_component_cost, updated_at=now()
  where location_id=p_location_id and resource='components';

  insert into public.core_sample_jobs(
    profile_id, location_id, latitude_deg, longitude_deg, target_depth_m,
    energy_cost, component_cost, completes_at
  ) values (
    p_profile_id, p_location_id, p_latitude_deg, p_longitude_deg, p_target_depth_m,
    p_energy_cost, p_component_cost, now()+make_interval(secs=>p_duration_seconds)
  ) returning id into v_job;

  return v_job;
end $$;

revoke all on function public.start_core_sample_job(uuid,uuid,double precision,double precision,integer,integer,integer,integer) from public;
grant execute on function public.start_core_sample_job(uuid,uuid,double precision,double precision,integer,integer,integer,integer) to service_role;
