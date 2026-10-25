-- supabase/migrations/20261025190000_earth_property_sale_tax.sql
-- Steuer auf Verkäufe zwischen Spielern (Thomas, 25.10.2026: „zwischen spielern vielleicht
-- 5 % steuer? etwas das man später, wenn politik etabliert ist, auch von verwaltungsbezirk
-- zu verwaltungsbezirk angleichen kann“).
--
--   * earth_property_tax_rates: Satz je Verwaltungsbezirk (vorerst die Gemeinde aus dem
--     Kataster, z. B. „Sundern“); district = '*' ist der allgemeine Satz (5 %).
--     Später kann die Politik eines Bezirks hier ihren Satz setzen.
--   * Der Käufer zahlt den Angebotspreis, der Verkäufer erhält ihn abzüglich Steuer,
--     die Steuer geht in die Koloniekasse der Erde (colony_ledger, 'tax_transaction')
--     – wie der versteuerte Kauf von der Gemeinde (noxia_taxed_purchase, R-13).

set search_path to public;

create table if not exists public.earth_property_tax_rates (
  district   text primary key,
  rate       numeric not null check (rate >= 0 and rate <= 0.5),
  set_by     uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.earth_property_tax_rates enable row level security;
drop policy if exists earth_property_tax_rates_read on public.earth_property_tax_rates;
create policy earth_property_tax_rates_read on public.earth_property_tax_rates for select using (true);
grant select on public.earth_property_tax_rates to anon, authenticated;
grant all on public.earth_property_tax_rates to service_role;
insert into public.earth_property_tax_rates(district, rate) values ('*', 0.05) on conflict (district) do nothing;

alter table public.earth_property_sales add column if not exists district text;
alter table public.earth_property_sales add column if not exists tax integer not null default 0;

-- Satz eines Bezirks (sonst der allgemeine, sonst 5 %)
create or replace function public.earth_property_tax_rate(p_district text)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select rate from public.earth_property_tax_rates where district = p_district),
    (select rate from public.earth_property_tax_rates where district = '*'),
    0.05)
$$;
grant execute on function public.earth_property_tax_rate(text) to anon, authenticated, service_role;

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
  v_district text;
  v_rate numeric;
  v_tax integer;
  v_location_id uuid;
  v_tick bigint;
begin
  select * into v_listing from public.earth_property_listings where kind = p_kind and ref = p_ref for update;
  if not found then raise exception 'NOXIA_LISTING_NOT_FOUND'; end if;
  if v_listing.seller_id = p_buyer_id then raise exception 'NOXIA_OWN_LISTING'; end if;
  if p_price is distinct from v_listing.price then raise exception 'NOXIA_PRICE_CHANGED'; end if;

  perform 1 from public.profiles where id in (p_buyer_id, v_listing.seller_id) order by id for update;
  select credits into v_credits from public.profiles where id = p_buyer_id;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  if v_credits < v_listing.price then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  if p_kind = 'parcel' then
    select p.ring, p.label, nullif(p.props->>'gemeinde', '') into v_ring, v_label, v_district from public.earth_parcels p
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

  -- Transfer Käufer → Verkäufer (abzüglich Steuer) → Koloniekasse
  v_rate := public.earth_property_tax_rate(coalesce(v_district, '*'));
  v_tax := least(v_listing.price, greatest(0, round(v_listing.price * v_rate)::integer));
  update public.profiles set credits = credits - v_listing.price where id = p_buyer_id;
  update public.profiles set credits = credits + (v_listing.price - v_tax) where id = v_listing.seller_id;
  if v_tax > 0 then
    select id into v_location_id from public.locations where slug = 'earth';
    select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
    insert into public.colony_ledger(location_id, tick, entry_type, profile_id, resource_type, amount, note)
    values (v_location_id, v_tick, 'tax_transaction', v_listing.seller_id, null, v_tax,
            left('Grundstücksverkauf unter Spielern (' || p_kind || ':' || p_ref || coalesce(', ' || v_district, '') || ')', 240));
  end if;
  insert into public.earth_property_sales(kind, ref, seller_id, buyer_id, price, entities, district, tax)
  values (p_kind, p_ref, v_listing.seller_id, p_buyer_id, v_listing.price, to_jsonb(v_entities), v_district, v_tax);
  delete from public.earth_property_listings where kind = p_kind and ref = p_ref;
  delete from public.earth_property_listings where kind = 'building' and ref = any(array(select unnest(v_entities)::text));

  return jsonb_build_object('ok', true, 'kind', p_kind, 'ref', p_ref, 'price', v_listing.price,
    'tax', v_tax, 'tax_rate', v_rate, 'district', v_district, 'seller_net', v_listing.price - v_tax,
    'credits', v_credits - v_listing.price, 'entities', to_jsonb(v_entities), 'label', v_label);
end;
$$;

revoke all on function public.buy_listed_earth_property(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.buy_listed_earth_property(uuid,text,text,integer) to service_role;
