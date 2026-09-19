create table if not exists public.player_instrument_state (
  profile_id uuid not null references auth.users(id) on delete cascade,
  instrument_id text not null,
  condition_percent integer not null default 100 check (condition_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (profile_id, instrument_id),
  foreign key (profile_id, instrument_id) references public.player_instruments(profile_id, instrument_id) on delete cascade
);

grant select, insert, update on public.player_instrument_state to service_role;

create or replace function public.start_core_sample_job_v2(
  p_profile_id uuid,
  p_location_id uuid,
  p_latitude_deg double precision,
  p_longitude_deg double precision,
  p_target_depth_m integer,
  p_rig_id text,
  p_wear_cost integer,
  p_energy_cost integer,
  p_component_cost integer,
  p_duration_seconds integer
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_energy integer;
  v_components integer;
  v_condition integer;
  v_job uuid;
begin
  if p_latitude_deg < -90 or p_latitude_deg > 90 or p_longitude_deg < -180 or p_longitude_deg > 180 then raise exception 'invalid_coordinates'; end if;
  if p_target_depth_m <= 0 or p_target_depth_m > 500 then raise exception 'invalid_depth'; end if;
  if p_wear_cost < 0 or p_wear_cost > 100 then raise exception 'invalid_wear'; end if;

  if not exists (select 1 from public.player_instruments where profile_id=p_profile_id and instrument_id='core_sample') then raise exception 'core_sample_not_owned'; end if;
  if not exists (select 1 from public.player_instruments where profile_id=p_profile_id and instrument_id=p_rig_id) then raise exception 'drill_rig_not_owned'; end if;

  insert into public.player_instrument_state(profile_id,instrument_id,condition_percent)
  values (p_profile_id,p_rig_id,100)
  on conflict (profile_id,instrument_id) do nothing;

  select condition_percent into v_condition
  from public.player_instrument_state
  where profile_id=p_profile_id and instrument_id=p_rig_id
  for update;
  if coalesce(v_condition,0) < p_wear_cost then raise exception 'drill_rig_requires_service'; end if;

  select stock into v_energy from public.location_resources where location_id=p_location_id and resource='energy' for update;
  select stock into v_components from public.location_resources where location_id=p_location_id and resource='components' for update;
  if coalesce(v_energy,0) < p_energy_cost then raise exception 'insufficient_energy'; end if;
  if coalesce(v_components,0) < p_component_cost then raise exception 'insufficient_components'; end if;

  update public.location_resources set stock=stock-p_energy_cost, updated_at=now() where location_id=p_location_id and resource='energy';
  update public.location_resources set stock=stock-p_component_cost, updated_at=now() where location_id=p_location_id and resource='components';
  update public.player_instrument_state set condition_percent=condition_percent-p_wear_cost, updated_at=now()
    where profile_id=p_profile_id and instrument_id=p_rig_id;

  insert into public.core_sample_jobs(profile_id,location_id,latitude_deg,longitude_deg,target_depth_m,energy_cost,component_cost,completes_at,result)
  values (p_profile_id,p_location_id,p_latitude_deg,p_longitude_deg,p_target_depth_m,p_energy_cost,p_component_cost,
          now()+make_interval(secs=>p_duration_seconds),jsonb_build_object('rig_id',p_rig_id,'wear_cost',p_wear_cost))
  returning id into v_job;
  return v_job;
end $$;

revoke all on function public.start_core_sample_job_v2(uuid,uuid,double precision,double precision,integer,text,integer,integer,integer,integer) from public;
grant execute on function public.start_core_sample_job_v2(uuid,uuid,double precision,double precision,integer,text,integer,integer,integer,integer) to service_role;
