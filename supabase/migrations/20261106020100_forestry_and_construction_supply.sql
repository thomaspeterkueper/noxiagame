-- supabase/migrations/20261106020100_forestry_and_construction_supply.sql
-- Holz aus dem eigenen Wald, Verkauf an die Gemeinde, Lohnschnitt, Baustoffe aus dem
-- eigenen Lager für den Bau (NOXIA-MAT-0001; Requests 20261028-0040 und -0041).
-- Thomas, 28.10.2026: „Kann man eigentlich Wald roden und das Rohholz verkaufen?“ –
-- „richtiger Verbrauch“.
--
--   * Baustofflager je Spieler auf der Erde: logistics_inventories (depot, native,
--     subject_type 'profile_earth_depot', subject_id = Profil) – derselbe Bestand wie alle
--     Inventare, kein zweiter.
--   * Wald je Flurstück (earth_parcel_forest): Holzvorrat, Zuwachs je Spieljahr.
--     Ein Spieljahr = 30 echte Tage (Lebenslauf-Uhr 12×, NOXIA-TIME-0001).
--     Nachhaltig: höchstens der Zuwachs seit dem letzten Einschlag (bis zwei Spieljahre).
--     Kahlschlag: der ganze Vorrat; danach Aufforstung nötig, erst nach zehn Spieljahren
--     wieder Einschlag.
--   * Verkauf an die Gemeinde (öffentlicher Akteur der Erde): Transfer Akteur → Spieler,
--     Ware ins Akteursbuch (npc_ledger kind 'buy'). Nur, solange die Gemeindekasse reicht.
--   * Lohnschnitt im Sägewerk: 1 m³ Rundholz → 0,6 m³ Schnittholz, Gebühr an die Gemeinde.
--   * Bau: Baustoffe der Stückliste werden zuerst aus dem eigenen Lager genommen; nur der
--     Rest wird zugekauft (heutiger Weg, Credits). Protokoll in construction_material_uses.
-- Mengen und Preise rechnet der Server (lib/game/construction/materials.ts, lib/worldlab/landUse.ts).

set search_path to public;

create table if not exists public.earth_parcel_forest (
  parcel_id       text primary key references public.earth_parcels(id) on delete cascade,
  area_ha         numeric not null check (area_ha >= 0),
  stock_m3        numeric not null check (stock_m3 >= 0),
  growth_m3_year  numeric not null check (growth_m3_year >= 0),
  last_harvest_at timestamptz,
  cleared_at      timestamptz,
  replanted_at    timestamptz,
  updated_at      timestamptz not null default now()
);
alter table public.earth_parcel_forest enable row level security;
drop policy if exists earth_parcel_forest_read on public.earth_parcel_forest;
create policy earth_parcel_forest_read on public.earth_parcel_forest for select using (true);
grant select on public.earth_parcel_forest to anon, authenticated;
grant all on public.earth_parcel_forest to service_role;

create table if not exists public.construction_material_uses (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  build_ref   text not null,
  resource    public.resource_type not null,
  needed      integer not null,
  from_stock  integer not null,
  bought      integer not null,
  unit_price  integer not null,
  created_at  timestamptz not null default now()
);
alter table public.construction_material_uses enable row level security;
grant all on public.construction_material_uses to service_role;

-- Baustofflager des Spielers auf der Erde (anlegen, wenn es fehlt)
create or replace function public.noxia_profile_earth_depot(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_location uuid;
begin
  select id into v_id from public.logistics_inventories
   where storage_kind = 'native' and subject_type = 'profile_earth_depot' and subject_id = p_profile_id;
  if v_id is not null then return v_id; end if;
  select id into v_location from public.locations where slug = 'earth';
  insert into public.logistics_inventories(owner_profile_id, location_id, inventory_kind, storage_kind, subject_type, subject_id, label, public_deposit, public_withdraw, active, metadata)
  values (p_profile_id, v_location, 'depot', 'native', 'profile_earth_depot', p_profile_id, 'Baustofflager', false, false, true, '{"purpose":"NOXIA-MAT-0001"}'::jsonb)
  on conflict (storage_kind, subject_type, subject_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.logistics_inventories where storage_kind = 'native' and subject_type = 'profile_earth_depot' and subject_id = p_profile_id;
  end if;
  return v_id;
end;
$$;

-- Holz schlagen auf eigenem Wald-Flurstück. p_mode: 'sustainable' | 'clear'.
-- p_area_ha, p_stock_m3, p_growth_m3_year: Startwerte, falls der Wald noch nicht erfasst ist.
create or replace function public.harvest_earth_forest(p_profile_id uuid, p_parcel_id text, p_mode text, p_area_ha numeric, p_stock_m3 numeric, p_growth_m3_year numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_forest public.earth_parcel_forest%rowtype;
  v_since timestamptz; v_years numeric; v_amount integer; v_depot uuid; v_bought timestamptz;
begin
  if p_mode not in ('sustainable', 'clear') then raise exception 'NOXIA_MODE_INVALID'; end if;
  select o.bought_at into v_bought from public.earth_parcel_owners o join public.earth_parcels p on p.id = o.parcel_id
   where o.parcel_id = p_parcel_id and o.profile_id = p_profile_id and p.retired_at is null;
  if not found then raise exception 'NOXIA_PROPERTY_NOT_OWNED'; end if;

  insert into public.earth_parcel_forest(parcel_id, area_ha, stock_m3, growth_m3_year)
  values (p_parcel_id, greatest(0, p_area_ha), greatest(0, p_stock_m3), greatest(0, p_growth_m3_year))
  on conflict (parcel_id) do nothing;
  select * into v_forest from public.earth_parcel_forest where parcel_id = p_parcel_id for update;

  if v_forest.cleared_at is not null and (v_forest.replanted_at is null or v_forest.replanted_at > now() - interval '300 days') then
    raise exception 'NOXIA_FOREST_CLEARED';
  end if;

  if p_mode = 'clear' then
    v_amount := floor(v_forest.stock_m3);
    if v_amount < 1 then raise exception 'NOXIA_FOREST_EMPTY'; end if;
    update public.earth_parcel_forest set stock_m3 = 0, cleared_at = now(), replanted_at = null, last_harvest_at = now(), updated_at = now() where parcel_id = p_parcel_id;
  else
    -- Zuwachs seit dem letzten Einschlag bzw. Kauf/Aufforstung, höchstens zwei Spieljahre
    v_since := coalesce(v_forest.last_harvest_at, v_forest.replanted_at, v_bought, now());
    v_years := least(2, extract(epoch from (now() - v_since)) / (30 * 86400));
    v_amount := floor(least(v_forest.stock_m3, v_forest.growth_m3_year * v_years));
    if v_amount < 1 then raise exception 'NOXIA_FOREST_NOT_GROWN'; end if;
    update public.earth_parcel_forest set last_harvest_at = now(), updated_at = now() where parcel_id = p_parcel_id;
  end if;

  v_depot := public.noxia_profile_earth_depot(p_profile_id);
  perform public.noxia_adjust_inventory_amount(v_depot, 'roundwood'::public.resource_type, v_amount);
  return jsonb_build_object('ok', true, 'mode', p_mode, 'amount', v_amount, 'stock', public.noxia_inventory_amount(v_depot, 'roundwood'::public.resource_type));
end;
$$;

-- Aufforsten nach Kahlschlag: Gebühr an die Gemeinde; Vorrat wächst ab jetzt neu.
create or replace function public.replant_earth_forest(p_profile_id uuid, p_parcel_id text, p_fee integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_credits integer; v_location uuid; v_actor uuid; v_tick bigint;
begin
  if not exists (select 1 from public.earth_parcel_owners where parcel_id = p_parcel_id and profile_id = p_profile_id) then raise exception 'NOXIA_PROPERTY_NOT_OWNED'; end if;
  if not exists (select 1 from public.earth_parcel_forest where parcel_id = p_parcel_id and cleared_at is not null and replanted_at is null) then raise exception 'NOXIA_FOREST_NOT_CLEARED'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if v_credits < p_fee then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  select id into v_location from public.locations where slug = 'earth';
  select actor_id into v_actor from public.location_public_actors where location_id = v_location;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  update public.profiles set credits = credits - p_fee where id = p_profile_id;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'income', null, 0, p_fee, v_location, 'forest_replant:' || p_parcel_id || ':player:' || p_profile_id, 'Aufforstung (Pflanzgut, Arbeit)');
  -- Jungwald: Vorrat wächst mit dem Zuwachs; nach zehn Spieljahren wieder Einschlag
  update public.earth_parcel_forest set replanted_at = now(), last_harvest_at = null, updated_at = now() where parcel_id = p_parcel_id;
  return jsonb_build_object('ok', true, 'fee', p_fee, 'credits', v_credits - p_fee);
end;
$$;

-- Ware an die Gemeinde verkaufen (Holz, später andere Baustoffe)
create or replace function public.sell_earth_material(p_profile_id uuid, p_resource text, p_amount integer, p_unit_price integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_depot uuid; v_location uuid; v_actor uuid; v_tick bigint; v_total integer; v_balance numeric; v_credits integer;
begin
  if p_amount is null or p_amount < 1 then raise exception 'NOXIA_AMOUNT_INVALID'; end if;
  v_depot := public.noxia_profile_earth_depot(p_profile_id);
  v_total := p_amount * p_unit_price;
  select id into v_location from public.locations where slug = 'earth';
  select actor_id into v_actor from public.location_public_actors where location_id = v_location;
  select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_actor;
  if v_balance < v_total then raise exception 'NOXIA_BUYER_FUNDS'; end if;
  perform public.noxia_adjust_inventory_amount(v_depot, p_resource::public.resource_type, -p_amount);
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  update public.profiles set credits = credits + v_total where id = p_profile_id returning credits into v_credits;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'buy', p_resource, p_amount, -v_total, v_location, 'material_sale:' || p_resource || ':player:' || p_profile_id, 'Ankauf von einem Spieler');
  return jsonb_build_object('ok', true, 'amount', p_amount, 'total', v_total, 'credits', v_credits, 'stock', public.noxia_inventory_amount(v_depot, p_resource::public.resource_type));
end;
$$;

-- Lohnschnitt: Rundholz → Schnittholz (Ausbeute 60 %), Gebühr je m³ an die Gemeinde
create or replace function public.saw_earth_roundwood(p_profile_id uuid, p_amount integer, p_fee_per_m3 integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_depot uuid; v_lumber integer; v_fee integer; v_credits integer; v_location uuid; v_actor uuid; v_tick bigint;
begin
  if p_amount is null or p_amount < 2 then raise exception 'NOXIA_AMOUNT_INVALID'; end if;
  v_depot := public.noxia_profile_earth_depot(p_profile_id);
  v_lumber := floor(p_amount * 0.6);
  v_fee := p_amount * p_fee_per_m3;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if v_credits < v_fee then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  perform public.noxia_adjust_inventory_amount(v_depot, 'roundwood'::public.resource_type, -p_amount);
  perform public.noxia_adjust_inventory_amount(v_depot, 'lumber'::public.resource_type, v_lumber);
  select id into v_location from public.locations where slug = 'earth';
  select actor_id into v_actor from public.location_public_actors where location_id = v_location;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  update public.profiles set credits = credits - v_fee where id = p_profile_id;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'income', null, 0, v_fee, v_location, 'sawmill:player:' || p_profile_id, 'Lohnschnitt im Sägewerk');
  return jsonb_build_object('ok', true, 'roundwood', -p_amount, 'lumber', v_lumber, 'fee', v_fee, 'credits', v_credits - v_fee);
end;
$$;

-- Baustoffe für einen Bau aus dem eigenen Lager nehmen; Rest gilt als zugekauft.
-- p_bill: [{ "resource": "concrete", "amount": 72, "price": 3 }, …]. Gibt den Wert des
-- Genommenen zurück (um den der Baupreis sinkt).
create or replace function public.take_construction_materials(p_profile_id uuid, p_build_ref text, p_bill jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_depot uuid; v_line jsonb; v_need integer; v_have integer; v_take integer; v_saved integer := 0; v_taken jsonb := '[]'::jsonb;
begin
  v_depot := public.noxia_profile_earth_depot(p_profile_id);
  for v_line in select * from jsonb_array_elements(coalesce(p_bill, '[]'::jsonb)) loop
    v_need := greatest(0, (v_line->>'amount')::integer);
    if v_need = 0 then continue; end if;
    v_have := public.noxia_inventory_amount(v_depot, (v_line->>'resource')::public.resource_type);
    v_take := least(v_have, v_need);
    if v_take > 0 then
      perform public.noxia_adjust_inventory_amount(v_depot, (v_line->>'resource')::public.resource_type, -v_take);
      v_saved := v_saved + v_take * (v_line->>'price')::integer;
      v_taken := v_taken || jsonb_build_object('resource', v_line->>'resource', 'amount', v_take);
    end if;
    insert into public.construction_material_uses(profile_id, build_ref, resource, needed, from_stock, bought, unit_price)
    values (p_profile_id, p_build_ref, (v_line->>'resource')::public.resource_type, v_need, v_take, v_need - v_take, (v_line->>'price')::integer);
  end loop;
  return jsonb_build_object('ok', true, 'saved', v_saved, 'taken', v_taken);
end;
$$;

revoke all on function public.noxia_profile_earth_depot(uuid) from public, anon, authenticated;
revoke all on function public.harvest_earth_forest(uuid,text,text,numeric,numeric,numeric) from public, anon, authenticated;
revoke all on function public.replant_earth_forest(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.sell_earth_material(uuid,text,integer,integer) from public, anon, authenticated;
revoke all on function public.saw_earth_roundwood(uuid,integer,integer) from public, anon, authenticated;
revoke all on function public.take_construction_materials(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.noxia_profile_earth_depot(uuid) to service_role;
grant execute on function public.harvest_earth_forest(uuid,text,text,numeric,numeric,numeric) to service_role;
grant execute on function public.replant_earth_forest(uuid,text,integer) to service_role;
grant execute on function public.sell_earth_material(uuid,text,integer,integer) to service_role;
grant execute on function public.saw_earth_roundwood(uuid,integer,integer) to service_role;
grant execute on function public.take_construction_materials(uuid,text,jsonb) to service_role;
