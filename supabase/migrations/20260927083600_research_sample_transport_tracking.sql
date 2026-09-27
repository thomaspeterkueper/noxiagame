set search_path to public;

create or replace function noxia_register_research_sample_item()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inventory logistics_inventories%rowtype;
  v_resource region_resources%rowtype;
  v_owner uuid;
begin
  if new.resource::text <> 'research_sample' or new.amount <= 0 then return new; end if;
  select * into v_inventory from logistics_inventories where id=new.inventory_id;
  if not found or v_inventory.subject_type <> 'region_resource' or v_inventory.subject_id is null then return new; end if;
  select * into v_resource from region_resources where id=v_inventory.subject_id;
  if not found then return new; end if;
  begin v_owner := nullif(v_resource.properties->>'sampled_by','')::uuid; exception when others then v_owner := null; end;
  insert into research_samples(prospect_id,owner_profile_id,source_inventory_id,sample_kind,status,collected_at,metadata)
  values(
    v_resource.id,v_owner,v_inventory.id,
    coalesce(nullif(v_resource.properties->>'sample_kind',''),'regolith_reference'),
    'collected',coalesce((v_resource.properties->>'sampled_at')::timestamptz,now()),
    jsonb_build_object('body',coalesce(v_resource.properties->>'body','unknown'),'surfaceHub',v_resource.properties->>'surface_hub','provenance',coalesce(v_resource.properties->>'provenance','unknown'))
  )
  on conflict (prospect_id,sample_kind) do update
  set source_inventory_id=excluded.source_inventory_id,
      owner_profile_id=coalesce(research_samples.owner_profile_id,excluded.owner_profile_id),
      updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_register_research_sample_item on logistics_inventory_items;
create trigger trg_register_research_sample_item
after insert or update of amount on logistics_inventory_items
for each row execute function noxia_register_research_sample_item();

create or replace function noxia_track_research_sample_transport()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_prospect uuid;
  v_status text;
begin
  if new.resource::text <> 'research_sample' then return new; end if;
  begin v_prospect := nullif(new.route_snapshot->>'prospectId','')::uuid; exception when others then v_prospect := null; end;
  if v_prospect is null then
    select subject_id into v_prospect from logistics_inventories where id=new.source_inventory_id and subject_type='region_resource';
  end if;
  if v_prospect is null then return new; end if;
  v_status := case when new.status='completed' then 'returned' else 'in_transit' end;
  update research_samples
  set return_job_id=new.id,
      destination_inventory_id=new.destination_inventory_id,
      status=case when status='analyzed' then status else v_status end,
      returned_at=case when new.status='completed' then coalesce(returned_at,new.completed_at,now()) else returned_at end,
      updated_at=now()
  where prospect_id=v_prospect;
  return new;
end;
$$;

drop trigger if exists trg_track_research_sample_transport on transport_jobs;
create trigger trg_track_research_sample_transport
after insert or update of status on transport_jobs
for each row execute function noxia_track_research_sample_transport();

-- Backfill the registry after trigger creation for samples that predate this core.
insert into research_samples(prospect_id,source_inventory_id,sample_kind,status,collected_at,metadata)
select rr.id,li.id,coalesce(nullif(rr.properties->>'sample_kind',''),'regolith_reference'),'collected',coalesce((rr.properties->>'sampled_at')::timestamptz,now()),jsonb_build_object('body',coalesce(rr.properties->>'body','unknown'),'surfaceHub',rr.properties->>'surface_hub','provenance',coalesce(rr.properties->>'provenance','unknown'))
from region_resources rr
join logistics_inventories li on li.subject_type='region_resource' and li.subject_id=rr.id
join logistics_inventory_items item on item.inventory_id=li.id and item.resource::text='research_sample' and item.amount>0
on conflict (prospect_id,sample_kind) do nothing;

update research_samples rs
set return_job_id=tj.id,
    destination_inventory_id=tj.destination_inventory_id,
    status=case when tj.status='completed' then 'returned' else 'in_transit' end,
    returned_at=case when tj.status='completed' then coalesce(tj.completed_at,now()) else null end,
    updated_at=now()
from transport_jobs tj
where tj.resource::text='research_sample'
  and (tj.route_snapshot->>'prospectId')=rs.prospect_id::text
  and tj.status in ('reserved','loading','in_transit','arrived','unloading','completed');
