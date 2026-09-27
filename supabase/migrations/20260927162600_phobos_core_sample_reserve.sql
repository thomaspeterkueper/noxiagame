insert into public.location_resources(location_id,resource,stock,consumption,production,base_production)
select l.id,'components'::public.resource_type,6,0,0,0
from public.locations l
where l.slug='phobos'
on conflict (location_id,resource) do update
set stock=greatest(public.location_resources.stock,6),
    updated_at=now();
