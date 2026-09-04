-- NOXIA event-stream wiring for authoritative build/entity mutations
-- 2026-08-31
-- Depends on 20260831_noxia_events_entity_states.sql.
--
-- Scope deliberately starts with construction and persisted world entities.
-- Trade/travel are wired separately once their authoritative persistence
-- boundaries are normalized.

set search_path to public;

create or replace function public.noxia_record_player_build_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_effects jsonb;
begin
  if tg_op = 'INSERT' then
    v_type := case
      when new.status = 'building' then 'build.started'
      when new.status = 'selling' then 'building.sale_started'
      else 'build.created'
    end;
    v_effects := jsonb_build_array(jsonb_build_object('type','build_status','buildable_id',new.buildable_id,'status',new.status,'tile_level',new.tile_level,'tile_row',new.tile_row,'tile_col',new.tile_col,'completes_at',new.completes_at));
  else
    if new.status is not distinct from old.status and new.completes_at is not distinct from old.completes_at then return new; end if;
    v_type := 'build.status_changed';
    v_effects := jsonb_build_array(jsonb_build_object('type','build_status','buildable_id',new.buildable_id,'from',old.status,'to',new.status,'tile_level',new.tile_level,'tile_row',new.tile_row,'tile_col',new.tile_col,'completes_at',new.completes_at));
  end if;

  insert into public.simulation_events (event_type,subject_type,subject_id,actor_id,location_id,effects,metadata,occurred_at)
  values (v_type,'build',new.id,new.profile_id,new.location_id,v_effects,jsonb_build_object('source','player_builds_trigger'),now());
  return new;
end;
$$;

drop trigger if exists noxia_player_build_event on public.player_builds;
create trigger noxia_player_build_event after insert or update of status, completes_at on public.player_builds for each row execute function public.noxia_record_player_build_event();

create or replace function public.noxia_record_tile_entity_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event_type text;
  v_properties jsonb;
  v_effects jsonb;
begin
  v_event_type := case when tg_op = 'INSERT' then 'entity.created' else 'entity.updated' end;
  v_properties := jsonb_build_object('entity_type',new.entity_type,'entity_id',new.entity_id,'location_id',new.location_id,'tile_level',new.tile_level,'tile_row',new.tile_row,'tile_col',new.tile_col,'profile_id',new.profile_id,'actor_id',new.actor_id,'owner_class',new.owner_class,'owner_id',new.owner_id,'occupant_id',new.occupant_id,'condition',new.condition,'status',new.status,'parent_id',new.parent_id,'slot',new.slot);
  if tg_op = 'INSERT' then
    v_effects := jsonb_build_array(jsonb_build_object('type','entity_state','to',v_properties));
  else
    v_effects := jsonb_build_array(jsonb_build_object('type','entity_state','from',jsonb_build_object('location_id',old.location_id,'tile_level',old.tile_level,'tile_row',old.tile_row,'tile_col',old.tile_col,'owner_class',old.owner_class,'owner_id',old.owner_id,'occupant_id',old.occupant_id,'condition',old.condition,'status',old.status,'parent_id',old.parent_id,'slot',old.slot),'to',v_properties));
  end if;

  insert into public.simulation_events (event_type,subject_type,subject_id,actor_id,location_id,effects,metadata,occurred_at)
  values (v_event_type,'tile_entity',new.id,coalesce(new.profile_id,new.actor_id),new.location_id,v_effects,jsonb_build_object('source','tile_entities_trigger'),now()) returning id into v_event_id;

  update public.entity_states set valid_to = now() where subject_type='tile_entity' and subject_id=new.id and valid_to is null;
  insert into public.entity_states (subject_type,subject_id,valid_from,properties,source_event) values ('tile_entity',new.id,now(),v_properties,v_event_id);
  return new;
end;
$$;

drop trigger if exists noxia_tile_entity_state on public.tile_entities;
create trigger noxia_tile_entity_state after insert or update of location_id,tile_level,tile_row,tile_col,profile_id,actor_id,owner_class,owner_id,occupant_id,condition,status,parent_id,slot on public.tile_entities for each row execute function public.noxia_record_tile_entity_state();

comment on function public.noxia_record_player_build_event() is 'Authoritative audit/event projection for player_builds lifecycle changes into simulation_events.';
comment on function public.noxia_record_tile_entity_state() is 'Projects tile_entities mutations into simulation_events and temporal entity_states.';
