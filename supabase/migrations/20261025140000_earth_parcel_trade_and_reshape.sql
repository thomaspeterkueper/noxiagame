-- supabase/migrations/20261025140000_earth_parcel_trade_and_reshape.sql
-- Flurstücke und Häuser an andere Spieler verkaufen, Flurstücke teilen und
-- zusammenlegen (Thomas, 25.10.2026: „setze um was möglich ist“).
--
--   * earth_property_listings: Angebot eines Spielers (Flurstück oder Haus ohne Kataster)
--     mit Wunschpreis. Kauf = Transfer Käufer → Verkäufer (beides Spielerkonten),
--     protokolliert in earth_property_sales.
--   * Mit dem Flurstück wechseln alle Gebäude des Verkäufers darauf (Mitte im Flurstück),
--     abgerissene Flächen und Mietverhältnisse (neuer Vermieter: Firma des Käufers).
--     Solange darauf gebaut wird, ist kein Verkauf möglich.
--   * reshape_earth_parcels: eigene Flurstücke ersetzen (teilen 1 → 2, zusammenlegen 2 → 1).
--     Die Geometrie rechnet der Server (lib/worldlab/parcelGeometry.ts). Die alten
--     Flurstücke bleiben als „retired“ stehen (ein späterer Katasterabruf überschreibt
--     sie nicht wieder ins Spiel). Vermessungsgebühr an die Gemeinde (Transfer).

set search_path to public;

alter table public.earth_parcels add column if not exists retired_at timestamptz;
alter table public.earth_parcels add column if not exists parent_ids text[];
create index if not exists earth_parcels_live on public.earth_parcels(min_lat, max_lat) where retired_at is null;

create table if not exists public.earth_property_listings (
  kind       text not null check (kind in ('parcel', 'building')),
  ref        text not null,
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  price      integer not null check (price between 1 and 100000000),
  listed_at  timestamptz not null default now(),
  primary key (kind, ref)
);

create table if not exists public.earth_property_sales (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  ref        text not null,
  seller_id  uuid not null,
  buyer_id   uuid not null,
  price      integer not null,
  entities   jsonb not null default '[]'::jsonb,
  sold_at    timestamptz not null default now()
);

alter table public.earth_property_listings enable row level security;
alter table public.earth_property_sales enable row level security;
drop policy if exists earth_property_listings_read on public.earth_property_listings;
create policy earth_property_listings_read on public.earth_property_listings for select using (true);
grant select on public.earth_property_listings to anon, authenticated;
grant all on public.earth_property_listings, public.earth_property_sales to service_role;

-- Punkt im Ring (Liste von {lat, lon})
create or replace function public.earth_point_in_ring(p_lat double precision, p_lon double precision, p_ring jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  n integer := jsonb_array_length(p_ring);
  i integer; j integer; inside boolean := false;
  ai_lat double precision; ai_lon double precision; aj_lat double precision; aj_lon double precision;
begin
  if n is null or n < 3 then return false; end if;
  j := n - 1;
  for i in 0 .. n - 1 loop
    ai_lat := (p_ring->i->>'lat')::double precision; ai_lon := (p_ring->i->>'lon')::double precision;
    aj_lat := (p_ring->j->>'lat')::double precision; aj_lon := (p_ring->j->>'lon')::double precision;
    if (ai_lat > p_lat) <> (aj_lat > p_lat)
       and p_lon < (aj_lon - ai_lon) * (p_lat - ai_lat) / (aj_lat - ai_lat) + ai_lon then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end;
$$;

-- Angebot setzen (p_price) oder zurückziehen (p_price null)
create or replace function public.list_earth_property(p_profile_id uuid, p_kind text, p_ref text, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = 'parcel' then
    if not exists (select 1 from public.earth_parcel_owners o join public.earth_parcels p on p.id = o.parcel_id
                    where o.parcel_id = p_ref and o.profile_id = p_profile_id and p.retired_at is null) then
      raise exception 'NOXIA_PROPERTY_NOT_OWNED';
    end if;
  elsif p_kind = 'building' then
    if not exists (select 1 from public.tile_entities where id::text = p_ref and profile_id = p_profile_id and source_ref is not null) then
      raise exception 'NOXIA_PROPERTY_NOT_OWNED';
    end if;
    -- Häuser im Kataster gehen nur mit dem Flurstück
    if exists (select 1 from public.tile_entities t join public.earth_parcels p
                 on p.retired_at is null and t.latitude_deg between p.min_lat and p.max_lat and t.longitude_deg between p.min_lon and p.max_lon
                where t.id::text = p_ref and public.earth_point_in_ring(t.latitude_deg, t.longitude_deg, p.ring)) then
      raise exception 'NOXIA_SOLD_WITH_PARCEL';
    end if;
  else
    raise exception 'NOXIA_KIND_INVALID';
  end if;
  if p_price is null then
    delete from public.earth_property_listings where kind = p_kind and ref = p_ref;
    return jsonb_build_object('ok', true, 'listed', false);
  end if;
  if p_price < 1 or p_price > 100000000 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  insert into public.earth_property_listings(kind, ref, seller_id, price) values (p_kind, p_ref, p_profile_id, p_price)
  on conflict (kind, ref) do update set price = excluded.price, seller_id = excluded.seller_id, listed_at = now();
  return jsonb_build_object('ok', true, 'listed', true, 'price', p_price);
end;
$$;

-- Gelistetes Flurstück oder Haus kaufen. p_price: der Preis, den der Käufer gesehen hat.
create or replace function public.buy_listed_earth_property(p_buyer_id uuid, p_kind text, p_ref text, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.earth_property_listings%rowtype;
  v_credits integer;
  v_ring jsonb;
  v_entities uuid[];
  v_landlord uuid;
  v_label text;
begin
  select * into v_listing from public.earth_property_listings where kind = p_kind and ref = p_ref for update;
  if not found then raise exception 'NOXIA_LISTING_NOT_FOUND'; end if;
  if v_listing.seller_id = p_buyer_id then raise exception 'NOXIA_OWN_LISTING'; end if;
  if p_price is distinct from v_listing.price then raise exception 'NOXIA_PRICE_CHANGED'; end if;

  -- Konten in fester Reihenfolge sperren (keine Verklemmung bei gleichzeitigen Käufen)
  perform 1 from public.profiles where id in (p_buyer_id, v_listing.seller_id) order by id for update;
  select credits into v_credits from public.profiles where id = p_buyer_id;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  if v_credits < v_listing.price then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  if p_kind = 'parcel' then
    select p.ring, p.label into v_ring, v_label from public.earth_parcels p
      join public.earth_parcel_owners o on o.parcel_id = p.id
     where p.id = p_ref and o.profile_id = v_listing.seller_id and p.retired_at is null for update of o;
    if not found then raise exception 'NOXIA_PROPERTY_NOT_OWNED'; end if;
    if exists (select 1 from public.player_builds b where b.profile_id = v_listing.seller_id and b.status <> 'complete'
                 and b.latitude_deg is not null and public.earth_point_in_ring(b.latitude_deg, b.longitude_deg, v_ring)) then
      raise exception 'NOXIA_CONSTRUCTION_RUNNING';
    end if;
    select coalesce(array_agg(id), '{}') into v_entities from public.tile_entities
     where profile_id = v_listing.seller_id and latitude_deg is not null
       and public.earth_point_in_ring(latitude_deg, longitude_deg, v_ring);
    update public.earth_parcel_owners set profile_id = p_buyer_id, price = v_listing.price, bought_at = now() where parcel_id = p_ref;
    update public.earth_cleared_buildings set profile_id = p_buyer_id
     where profile_id = v_listing.seller_id and public.earth_point_in_ring(latitude_deg, longitude_deg, v_ring);
  else
    select coalesce(display_name, 'Gebäude') into v_label from public.tile_entities
     where id::text = p_ref and profile_id = v_listing.seller_id and source_ref is not null for update;
    if not found then raise exception 'NOXIA_PROPERTY_NOT_OWNED'; end if;
    v_entities := array[p_ref::uuid];
  end if;

  update public.tile_entities set profile_id = p_buyer_id, owner_id = p_buyer_id
   where id = any(v_entities) and owner_class = 'PLAYER';
  update public.tile_entities set profile_id = p_buyer_id
   where id = any(v_entities) and owner_class <> 'PLAYER';
  select id into v_landlord from public.actors where kind = 'player_corp' and founded_by = p_buyer_id order by created_at limit 1;
  if v_landlord is not null then
    update public.person_tenancies set landlord_actor_id = v_landlord, updated_at = now()
     where tile_entity_id = any(v_entities) and status in ('active', 'provided');
  end if;

  -- Transfer Käufer → Verkäufer
  update public.profiles set credits = credits - v_listing.price where id = p_buyer_id;
  update public.profiles set credits = credits + v_listing.price where id = v_listing.seller_id;
  insert into public.earth_property_sales(kind, ref, seller_id, buyer_id, price, entities)
  values (p_kind, p_ref, v_listing.seller_id, p_buyer_id, v_listing.price, to_jsonb(v_entities));
  delete from public.earth_property_listings where kind = p_kind and ref = p_ref;
  delete from public.earth_property_listings where kind = 'building' and ref = any(array(select unnest(v_entities)::text));

  return jsonb_build_object('ok', true, 'kind', p_kind, 'ref', p_ref, 'price', v_listing.price,
    'credits', v_credits - v_listing.price, 'entities', to_jsonb(v_entities), 'label', v_label);
end;
$$;

-- Eigene Flurstücke ersetzen: p_retire (alte Kennungen), p_new (neue Flurstücke mit
-- id, ring, centre_lat, centre_lon, min_lat, max_lat, min_lon, max_lon, area_m2, label, usage).
create or replace function public.reshape_earth_parcels(p_profile_id uuid, p_retire text[], p_new jsonb, p_fee integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer; v_owned integer; v_item jsonb; v_location_id uuid; v_public_actor uuid; v_tick bigint;
  v_ids text[] := '{}';
begin
  if p_retire is null or array_length(p_retire, 1) is null then raise exception 'NOXIA_PARCEL_NOT_FOUND'; end if;
  if p_new is null or jsonb_array_length(p_new) < 1 then raise exception 'NOXIA_SHAPE_INVALID'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select count(*) into v_owned from public.earth_parcel_owners o join public.earth_parcels p on p.id = o.parcel_id
   where o.parcel_id = any(p_retire) and o.profile_id = p_profile_id and p.retired_at is null;
  if v_owned <> array_length(p_retire, 1) then raise exception 'NOXIA_PROPERTY_NOT_OWNED'; end if;
  perform 1 from public.earth_parcels where id = any(p_retire) for update;
  if coalesce(p_fee, 0) > 0 and v_credits < p_fee then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  update public.earth_parcels set retired_at = now() where id = any(p_retire);
  delete from public.earth_property_listings where kind = 'parcel' and ref = any(p_retire);
  delete from public.earth_parcel_owners where parcel_id = any(p_retire);

  for v_item in select * from jsonb_array_elements(p_new) loop
    insert into public.earth_parcels(id, source, ring, centre_lat, centre_lon, min_lat, max_lat, min_lon, max_lon, area_m2, label, usage, props, parent_ids)
    values (v_item->>'id', 'noxia', v_item->'ring', (v_item->>'centre_lat')::double precision, (v_item->>'centre_lon')::double precision,
            (v_item->>'min_lat')::double precision, (v_item->>'max_lat')::double precision, (v_item->>'min_lon')::double precision, (v_item->>'max_lon')::double precision,
            (v_item->>'area_m2')::integer, left(v_item->>'label', 200), v_item->>'usage', coalesce(v_item->'props', '{}'::jsonb), p_retire);
    insert into public.earth_parcel_owners(parcel_id, profile_id, price) values (v_item->>'id', p_profile_id, 0);
    v_ids := v_ids || (v_item->>'id');
  end loop;

  if coalesce(p_fee, 0) > 0 then
    select id into v_location_id from public.locations where slug = 'earth';
    select actor_id into v_public_actor from public.location_public_actors where location_id = v_location_id;
    if v_public_actor is null then raise exception 'NOXIA_PUBLIC_ACTOR_MISSING'; end if;
    select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
    update public.profiles set credits = credits - p_fee where id = p_profile_id;
    insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
    values (v_public_actor, v_tick, 'income', null, 0, p_fee, v_location_id,
            'parcel_survey:' || array_to_string(v_ids, ',') || ':player:' || p_profile_id::text,
            left('Vermessungsgebühr: ' || array_to_string(p_retire, ', '), 240));
  end if;
  return jsonb_build_object('ok', true, 'parcels', to_jsonb(v_ids), 'fee', coalesce(p_fee, 0), 'credits', v_credits - coalesce(p_fee, 0));
end;
$$;

revoke all on function public.list_earth_property(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.list_earth_property(uuid,text,text,integer) to service_role;
revoke all on function public.buy_listed_earth_property(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.buy_listed_earth_property(uuid,text,text,integer) to service_role;
revoke all on function public.reshape_earth_parcels(uuid,text[],jsonb,integer) from public, anon, authenticated;
grant execute on function public.reshape_earth_parcels(uuid,text[],jsonb,integer) to service_role;
