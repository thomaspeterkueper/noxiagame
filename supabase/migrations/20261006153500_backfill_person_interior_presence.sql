-- One-time bootstrap of derived room presence from current authoritative assignments.
-- Future updates are owned by lib/game/population/interiorPresence.ts.

set search_path to public;

with ranked as (
  select
    pa.*,
    p.activity_state,
    te.entity_id,
    row_number() over (
      partition by pa.person_id
      order by
        case
          when p.activity_state='working' and pa.assignment_type='work' then 0
          when p.activity_state='resting' and pa.assignment_type='home' then 0
          when p.activity_state in ('socialising','inspecting') and pa.assignment_type='temporary' then 0
          when pa.assignment_type='temporary' then 1
          when pa.assignment_type='home' then 2
          when pa.assignment_type='work' then 3
          else 9
        end,
        pa.id
    ) as rn
  from public.person_assignments pa
  join public.people p on p.id=pa.person_id
  join public.tile_entities te on te.id=pa.tile_entity_id
  where pa.is_active=true
    and pa.tile_entity_id is not null
),
chosen as (
  select * from ranked where rn=1
),
mapped as (
  select
    c.*,
    case
      when c.entity_id in ('habitat','residential_block') then 'habitat-standard-v1'
      when c.entity_id='habitat_cluster' then 'pressurized-habitat-cluster-01'
      when c.entity_id in ('medical_core','medical_annex') then 'medical-standard-v1'
      when c.entity_id in ('factory','workshop','surface_workshop','workshop_clean','workshop_heavy','shipyard') then 'workshop-standard-v1'
      when c.entity_id in ('warehouse','warehouse_storage','logistics_hub','reserve_depot') then 'logistics-standard-v1'
      when c.entity_id in ('school','academy') then 'academy-standard-v1'
      when c.entity_id in ('solar','battery_storage','life_support_hub','eclss_hub','reactor_module','black_start','water_recycler','water_isru','radiator_field') then 'utility-standard-v1'
      when c.entity_id in ('admin','bank','command_node') then 'civic-standard-v1'
      when c.entity_id='archive_library' then 'library-standard-v1'
      when c.entity_id in ('landing_pad','spaceport_core','spaceport_pad_standard','spaceport_pad_mini') then 'spaceport-standard-v1'
      when c.entity_id in ('scanner','laboratory') then 'laboratory-standard-01'
      when c.entity_id in ('cafe','café') then 'cafe-standard-v1'
      else null
    end as template_id
  from chosen c
),
rooms as (
  select
    m.*,
    case
      when m.entity_id in ('habitat','residential_block') then
        case when m.activity_state='socialising' then 'common'
             when m.activity_state='inspecting' then 'support'
             when m.activity_state='working' then 'support'
             when m.activity_state='travelling' then 'airlock'
             else 'quarters' end
      when m.entity_id='habitat_cluster' then
        case when m.activity_state='socialising' then 'commons'
             when m.activity_state='inspecting' or m.activity_state='working' then 'local-utilities'
             when m.activity_state='travelling' then 'entry-airlock'
             else case when mod(abs(hashtext(m.person_id::text)),2)=0 then 'living-a' else 'living-b' end end
      when m.entity_id in ('medical_core','medical_annex') then
        case when m.activity_state='inspecting' then 'diagnostics'
             when m.activity_state='working' then 'treatment'
             else 'reception' end
      when m.entity_id in ('factory','workshop','surface_workshop','workshop_clean','workshop_heavy','shipyard') then
        case when m.activity_state='socialising' then 'crew'
             when m.activity_state in ('working','inspecting') then 'workshop'
             else 'reception' end
      when m.entity_id in ('warehouse','warehouse_storage','logistics_hub','reserve_depot') then
        case when m.activity_state='socialising' then 'office'
             when m.activity_state='working' then 'storage'
             when m.activity_state='inspecting' then 'receiving'
             else 'receiving' end
      when m.entity_id in ('school','academy') then
        case when m.activity_state='working' and coalesce(m.role_code,'') ~* '(scient|research|lab)' then 'lab'
             when m.activity_state='working' then 'classroom'
             when m.activity_state='inspecting' then 'lab'
             else 'entry' end
      when m.entity_id in ('solar','battery_storage','life_support_hub','eclss_hub','reactor_module','black_start','water_recycler','water_isru','radiator_field') then
        case when m.activity_state='working' then 'control'
             when m.activity_state='inspecting' then 'plant'
             else 'entry' end
      when m.entity_id in ('admin','bank','command_node') then
        case when m.activity_state='working' then 'operations'
             when m.activity_state='socialising' then 'meeting'
             else 'service' end
      when m.entity_id='archive_library' then
        case when m.activity_state='working' then 'stacks'
             when m.activity_state='inspecting' then 'archive'
             else 'reading' end
      when m.entity_id in ('landing_pad','spaceport_core','spaceport_pad_standard','spaceport_pad_mini') then
        case when m.activity_state='working' then 'flight_control'
             when m.activity_state='inspecting' then 'service'
             else 'arrival' end
      when m.entity_id in ('scanner','laboratory') then
        case when m.activity_state in ('working','inspecting') then 'analysis-lab'
             when m.activity_state='socialising' then 'meeting'
             when m.activity_state='resting' then 'office'
             else 'airlock' end
      when m.entity_id in ('cafe','café') then
        case when m.activity_state='working' then 'counter'
             when m.activity_state='socialising' or m.activity_state='resting' then 'guest-room'
             else 'entry' end
      else null
    end as room_id
  from mapped m
  where m.template_id is not null
),
current_tick as (
  select coalesce(max(tick_number),0)::bigint as tick from public.tick_log
)
insert into public.person_interior_presence (
  person_id,tile_entity_id,template_id,room_id,target_room_id,
  source_assignment_id,source_kind,entered_tick,updated_tick,updated_at
)
select
  r.person_id,
  r.tile_entity_id,
  r.template_id,
  r.room_id,
  r.room_id,
  r.id,
  case when r.assignment_type='temporary' then 'visit' else 'assignment' end,
  ct.tick,
  ct.tick,
  now()
from rooms r
cross join current_tick ct
where r.room_id is not null
on conflict (person_id) do update set
  tile_entity_id=excluded.tile_entity_id,
  template_id=excluded.template_id,
  room_id=excluded.room_id,
  target_room_id=excluded.target_room_id,
  source_assignment_id=excluded.source_assignment_id,
  source_kind=excluded.source_kind,
  entered_tick=excluded.entered_tick,
  updated_tick=excluded.updated_tick,
  updated_at=excluded.updated_at;
