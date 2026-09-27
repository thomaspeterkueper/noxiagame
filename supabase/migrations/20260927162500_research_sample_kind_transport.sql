create or replace function public.noxia_track_research_sample_transport()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prospect uuid;
  v_status text;
  v_sample_kind text;
begin
  if new.resource::text <> 'research_sample' then return new; end if;
  begin v_prospect := nullif(new.route_snapshot->>'prospectId','')::uuid; exception when others then v_prospect := null; end;
  v_sample_kind := nullif(new.route_snapshot->>'sampleKind','');
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
  where prospect_id=v_prospect
    and (v_sample_kind is null or sample_kind=v_sample_kind);
  return new;
end;
$function$;
