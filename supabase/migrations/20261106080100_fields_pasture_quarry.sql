-- supabase/migrations/20261106080100_fields_pasture_quarry.sql
-- Feldbau, Weide und Steinbruch auf eigenen Flurstücken (NOXIA-MAT-0001).
-- Thomas, 28.10.2026: „Wie ist es mit Getreideanbau, Tierzucht? Steinbruch usw?“
--
--   * Feld (Ackerland): säen (Saatgut und Bestellung an die Gemeinde), nach der Reifezeit
--     ernten; einige Tage volle Ernte, dann die Hälfte, danach verdorben. Ertrag ins
--     Lager (grain, potatoes).
--   * Weide (Grünland): Jungrinder von der Gemeinde kaufen, höchstens zwei je ha; nach einem
--     Spieljahr schlachtreif und an die Gemeinde verkaufen. Tiere je Kaufzeitpunkt (cohorts).
--   * Steinbruch (Tagebau, Grube, Steinbruch): Abbau wächst mit der Zeit seit dem letzten
--     Abbau (höchstens vier Spielmonate), Kosten für Sprengen und Laden an die Gemeinde, der
--     Vorrat geht zur Neige. Bruchstein ins Lager; Lohnbrechen zu Schotter.
--   * Wald: Vorrat wächst jetzt mit dem Zuwachs (auch nach Aufforstung von null an), bis zum
--     Vorrat eines ausgewachsenen Waldes.
-- Mengen, Zeiten und Preise rechnet der Server (lib/worldlab/landWork.ts) und gibt sie mit.

set search_path to public;

create table if not exists public.earth_parcel_field (
  parcel_id    text primary key references public.earth_parcels(id) on delete cascade,
  area_ha      numeric not null check (area_ha >= 0),
  crop         text,
  sown_at      timestamptz,
  ripe_at      timestamptz,
  harvested_at timestamptz,
  updated_at   timestamptz not null default now()
);
create table if not exists public.earth_parcel_herd (
  parcel_id  text primary key references public.earth_parcels(id) on delete cascade,
  cohorts    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.earth_parcel_quarry (
  parcel_id       text primary key references public.earth_parcels(id) on delete cascade,
  area_ha         numeric not null check (area_ha >= 0),
  reserve_t       numeric not null check (reserve_t >= 0),
  last_extract_at timestamptz,
  updated_at      timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['earth_parcel_field', 'earth_parcel_herd', 'earth_parcel_quarry'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Öffentlicher Akteur der Erde (Gemeindekasse) und aktueller Tick
create or replace function public.noxia_earth_actor()
returns uuid language sql stable security definer set search_path = public as $$
  select a.actor_id from public.location_public_actors a join public.locations l on l.id = a.location_id where l.slug = 'earth'
$$;

-- Spieler zahlt an die Gemeinde (Gebühr, Saatgut, Jungtiere …)
create or replace function public.noxia_pay_earth_actor(p_profile_id uuid, p_amount integer, p_kind text, p_resource text, p_goods integer, p_ref text, p_note text)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_credits integer; v_tick bigint;
begin
  if p_amount < 0 then raise exception 'NOXIA_AMOUNT_INVALID'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if v_credits is null or v_credits < p_amount then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  update public.profiles set credits = credits - p_amount where id = p_profile_id;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (public.noxia_earth_actor(), v_tick, p_kind, p_resource, coalesce(p_goods, 0), p_amount, (select id from public.locations where slug = 'earth'), p_ref, p_note);
  return v_credits - p_amount;
end;
$$;

-- Gemeinde zahlt an den Spieler (Ankauf), nur solange ihre Kasse reicht
create or replace function public.noxia_earth_actor_buys(p_profile_id uuid, p_total integer, p_resource text, p_goods integer, p_ref text, p_note text)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.noxia_earth_actor(); v_balance numeric; v_tick bigint; v_credits integer;
begin
  select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_actor;
  if v_balance < p_total then raise exception 'NOXIA_BUYER_FUNDS'; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  update public.profiles set credits = credits + p_total where id = p_profile_id returning credits into v_credits;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'buy', p_resource, p_goods, -p_total, (select id from public.locations where slug = 'earth'), p_ref, p_note);
  return v_credits;
end;
$$;

create or replace function public.noxia_owns_earth_parcel(p_profile_id uuid, p_parcel_id text)
returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare v_bought timestamptz;
begin
  select o.bought_at into v_bought from public.earth_parcel_owners o join public.earth_parcels p on p.id = o.parcel_id
   where o.parcel_id = p_parcel_id and o.profile_id = p_profile_id and p.retired_at is null;
  if not found then raise exception 'NOXIA_PROPERTY_NOT_OWNED'; end if;
  return coalesce(v_bought, now());
end;
$$;

-- ── Feld ─────────────────────────────────────────────────────────────────────────

create or replace function public.sow_earth_field(p_profile_id uuid, p_parcel_id text, p_crop text, p_area_ha numeric, p_grow_days numeric, p_spoil_days numeric, p_fee integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_field public.earth_parcel_field%rowtype; v_credits integer;
begin
  perform public.noxia_owns_earth_parcel(p_profile_id, p_parcel_id);
  insert into public.earth_parcel_field(parcel_id, area_ha) values (p_parcel_id, greatest(0, p_area_ha)) on conflict (parcel_id) do nothing;
  select * into v_field from public.earth_parcel_field where parcel_id = p_parcel_id for update;
  -- Noch etwas auf dem Feld, das weder geerntet noch verdorben ist?
  if v_field.sown_at is not null and (v_field.harvested_at is null or v_field.harvested_at < v_field.sown_at)
     and now() <= v_field.ripe_at + make_interval(secs => p_spoil_days * 86400) then
    raise exception 'NOXIA_FIELD_BUSY';
  end if;
  v_credits := public.noxia_pay_earth_actor(p_profile_id, p_fee, 'income', null, 0, 'field_sow:' || p_parcel_id || ':player:' || p_profile_id, 'Saatgut und Bestellung (' || p_crop || ')');
  update public.earth_parcel_field
     set area_ha = greatest(0, p_area_ha), crop = p_crop, sown_at = now(), ripe_at = now() + make_interval(secs => p_grow_days * 86400), harvested_at = null, updated_at = now()
   where parcel_id = p_parcel_id;
  return jsonb_build_object('ok', true, 'crop', p_crop, 'fee', p_fee, 'credits', v_credits, 'ripeAt', now() + make_interval(secs => p_grow_days * 86400));
end;
$$;

create or replace function public.harvest_earth_field(p_profile_id uuid, p_parcel_id text, p_resource text, p_t_per_ha numeric, p_late_days numeric, p_spoil_days numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_field public.earth_parcel_field%rowtype; v_amount integer; v_late boolean; v_depot uuid;
begin
  perform public.noxia_owns_earth_parcel(p_profile_id, p_parcel_id);
  select * into v_field from public.earth_parcel_field where parcel_id = p_parcel_id for update;
  if not found or v_field.sown_at is null or (v_field.harvested_at is not null and v_field.harvested_at >= v_field.sown_at) then raise exception 'NOXIA_FIELD_EMPTY'; end if;
  if now() < v_field.ripe_at then raise exception 'NOXIA_FIELD_NOT_RIPE'; end if;
  if now() > v_field.ripe_at + make_interval(secs => p_spoil_days * 86400) then raise exception 'NOXIA_FIELD_SPOILED'; end if;
  v_late := now() > v_field.ripe_at + make_interval(secs => p_late_days * 86400);
  v_amount := floor(floor(v_field.area_ha * p_t_per_ha) * case when v_late then 0.5 else 1 end);
  update public.earth_parcel_field set harvested_at = now(), updated_at = now() where parcel_id = p_parcel_id;
  v_depot := public.noxia_profile_earth_depot(p_profile_id);
  if v_amount > 0 then perform public.noxia_adjust_inventory_amount(v_depot, p_resource::public.resource_type, v_amount); end if;
  return jsonb_build_object('ok', true, 'amount', v_amount, 'late', v_late, 'resource', p_resource, 'stock', public.noxia_inventory_amount(v_depot, p_resource::public.resource_type));
end;
$$;

-- ── Weide ────────────────────────────────────────────────────────────────────────

create or replace function public.buy_earth_cattle(p_profile_id uuid, p_parcel_id text, p_count integer, p_price integer, p_capacity integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_herd public.earth_parcel_herd%rowtype; v_count integer; v_credits integer;
begin
  if p_count is null or p_count < 1 then raise exception 'NOXIA_AMOUNT_INVALID'; end if;
  perform public.noxia_owns_earth_parcel(p_profile_id, p_parcel_id);
  insert into public.earth_parcel_herd(parcel_id) values (p_parcel_id) on conflict (parcel_id) do nothing;
  select * into v_herd from public.earth_parcel_herd where parcel_id = p_parcel_id for update;
  select coalesce(sum((c->>'n')::integer), 0) into v_count from jsonb_array_elements(v_herd.cohorts) c;
  if v_count + p_count > p_capacity then raise exception 'NOXIA_PASTURE_FULL'; end if;
  v_credits := public.noxia_pay_earth_actor(p_profile_id, p_count * p_price, 'sell', 'cattle', -p_count, 'cattle_buy:' || p_parcel_id || ':player:' || p_profile_id, 'Jungrinder an einen Spieler');
  update public.earth_parcel_herd set cohorts = cohorts || jsonb_build_array(jsonb_build_object('n', p_count, 'since', now())), updated_at = now() where parcel_id = p_parcel_id;
  return jsonb_build_object('ok', true, 'count', v_count + p_count, 'paid', p_count * p_price, 'credits', v_credits);
end;
$$;

create or replace function public.sell_earth_cattle(p_profile_id uuid, p_parcel_id text, p_price integer, p_mature_days numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_herd public.earth_parcel_herd%rowtype; v_mature integer; v_rest jsonb; v_credits integer;
begin
  perform public.noxia_owns_earth_parcel(p_profile_id, p_parcel_id);
  select * into v_herd from public.earth_parcel_herd where parcel_id = p_parcel_id for update;
  if not found then raise exception 'NOXIA_CATTLE_NOT_READY'; end if;
  select coalesce(sum((c->>'n')::integer) filter (where (c->>'since')::timestamptz <= now() - make_interval(secs => p_mature_days * 86400)), 0),
         coalesce(jsonb_agg(c) filter (where (c->>'since')::timestamptz > now() - make_interval(secs => p_mature_days * 86400)), '[]'::jsonb)
    into v_mature, v_rest
    from jsonb_array_elements(v_herd.cohorts) c;
  if v_mature < 1 then raise exception 'NOXIA_CATTLE_NOT_READY'; end if;
  v_credits := public.noxia_earth_actor_buys(p_profile_id, v_mature * p_price, 'cattle', v_mature, 'cattle_sale:' || p_parcel_id || ':player:' || p_profile_id, 'Schlachtrinder von einem Spieler');
  update public.earth_parcel_herd set cohorts = v_rest, updated_at = now() where parcel_id = p_parcel_id;
  return jsonb_build_object('ok', true, 'sold', v_mature, 'total', v_mature * p_price, 'credits', v_credits);
end;
$$;

-- ── Steinbruch ───────────────────────────────────────────────────────────────────

create or replace function public.extract_earth_quarry(p_profile_id uuid, p_parcel_id text, p_area_ha numeric, p_reserve_t numeric, p_t_per_ha_day numeric, p_max_days numeric, p_fee_share numeric, p_unit_price integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_bought timestamptz; v_quarry public.earth_parcel_quarry%rowtype; v_days numeric; v_amount integer; v_fee integer; v_credits integer; v_depot uuid;
begin
  v_bought := public.noxia_owns_earth_parcel(p_profile_id, p_parcel_id);
  insert into public.earth_parcel_quarry(parcel_id, area_ha, reserve_t) values (p_parcel_id, greatest(0, p_area_ha), greatest(0, p_reserve_t)) on conflict (parcel_id) do nothing;
  select * into v_quarry from public.earth_parcel_quarry where parcel_id = p_parcel_id for update;
  if v_quarry.reserve_t < 1 then raise exception 'NOXIA_QUARRY_EXHAUSTED'; end if;
  v_days := least(p_max_days, extract(epoch from (now() - coalesce(v_quarry.last_extract_at, v_bought))) / 86400);
  v_amount := floor(least(v_quarry.reserve_t, p_t_per_ha_day * v_quarry.area_ha * v_days));
  if v_amount < 1 then raise exception 'NOXIA_QUARRY_NOT_READY'; end if;
  v_fee := ceil(v_amount * p_unit_price * p_fee_share);
  v_credits := public.noxia_pay_earth_actor(p_profile_id, v_fee, 'income', null, 0, 'quarry:' || p_parcel_id || ':player:' || p_profile_id, 'Sprengen, Laden, Maschinen im Steinbruch');
  update public.earth_parcel_quarry set reserve_t = reserve_t - v_amount, last_extract_at = now(), updated_at = now() where parcel_id = p_parcel_id;
  v_depot := public.noxia_profile_earth_depot(p_profile_id);
  perform public.noxia_adjust_inventory_amount(v_depot, 'stone'::public.resource_type, v_amount);
  return jsonb_build_object('ok', true, 'amount', v_amount, 'fee', v_fee, 'credits', v_credits, 'reserve', v_quarry.reserve_t - v_amount, 'stock', public.noxia_inventory_amount(v_depot, 'stone'::public.resource_type));
end;
$$;

-- Lohnverarbeitung im Lager: p_amount von p_from → p_out von p_to, Gebühr an die Gemeinde
-- (Brecher: Bruchstein → Schotter; später Mühle, Ziegelei …)
create or replace function public.convert_earth_material(p_profile_id uuid, p_from text, p_to text, p_amount integer, p_out integer, p_fee integer, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_depot uuid; v_credits integer;
begin
  if p_amount is null or p_amount < 1 or p_out < 0 then raise exception 'NOXIA_AMOUNT_INVALID'; end if;
  v_depot := public.noxia_profile_earth_depot(p_profile_id);
  v_credits := public.noxia_pay_earth_actor(p_profile_id, p_fee, 'income', null, 0, 'convert:' || p_from || '>' || p_to || ':player:' || p_profile_id, p_note);
  perform public.noxia_adjust_inventory_amount(v_depot, p_from::public.resource_type, -p_amount);
  if p_out > 0 then perform public.noxia_adjust_inventory_amount(v_depot, p_to::public.resource_type, p_out); end if;
  return jsonb_build_object('ok', true, 'from', p_from, 'to', p_to, 'amount', p_amount, 'out', p_out, 'fee', p_fee, 'credits', v_credits);
end;
$$;

-- ── Wald: Vorrat wächst ─────────────────────────────────────────────────────────

create or replace function public.harvest_earth_forest(p_profile_id uuid, p_parcel_id text, p_mode text, p_area_ha numeric, p_stock_m3 numeric, p_growth_m3_year numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_forest public.earth_parcel_forest%rowtype;
  v_since timestamptz; v_years numeric; v_amount integer; v_depot uuid; v_bought timestamptz; v_stock numeric;
begin
  if p_mode not in ('sustainable', 'clear') then raise exception 'NOXIA_MODE_INVALID'; end if;
  v_bought := public.noxia_owns_earth_parcel(p_profile_id, p_parcel_id);

  insert into public.earth_parcel_forest(parcel_id, area_ha, stock_m3, growth_m3_year)
  values (p_parcel_id, greatest(0, p_area_ha), greatest(0, p_stock_m3), greatest(0, p_growth_m3_year))
  on conflict (parcel_id) do nothing;
  select * into v_forest from public.earth_parcel_forest where parcel_id = p_parcel_id for update;

  if v_forest.cleared_at is not null and (v_forest.replanted_at is null or v_forest.replanted_at > now() - interval '300 days') then
    raise exception 'NOXIA_FOREST_CLEARED';
  end if;

  -- Vorrat heute: gewachsen seit der letzten Änderung, höchstens ein ausgewachsener Wald
  v_stock := least(greatest(p_stock_m3, v_forest.stock_m3), v_forest.stock_m3 + v_forest.growth_m3_year * extract(epoch from (now() - v_forest.updated_at)) / (30 * 86400));

  if p_mode = 'clear' then
    v_amount := floor(v_stock);
    if v_amount < 1 then raise exception 'NOXIA_FOREST_EMPTY'; end if;
    update public.earth_parcel_forest set stock_m3 = 0, cleared_at = now(), replanted_at = null, last_harvest_at = now(), updated_at = now() where parcel_id = p_parcel_id;
  else
    -- Zuwachs seit dem letzten Einschlag bzw. Kauf/Aufforstung, höchstens zwei Spieljahre
    v_since := coalesce(v_forest.last_harvest_at, v_forest.replanted_at, v_bought, now());
    v_years := least(2, extract(epoch from (now() - v_since)) / (30 * 86400));
    v_amount := floor(least(v_stock, v_forest.growth_m3_year * v_years));
    if v_amount < 1 then raise exception 'NOXIA_FOREST_NOT_GROWN'; end if;
    update public.earth_parcel_forest set stock_m3 = v_stock - v_amount, last_harvest_at = now(), updated_at = now() where parcel_id = p_parcel_id;
  end if;

  v_depot := public.noxia_profile_earth_depot(p_profile_id);
  perform public.noxia_adjust_inventory_amount(v_depot, 'roundwood'::public.resource_type, v_amount);
  return jsonb_build_object('ok', true, 'mode', p_mode, 'amount', v_amount, 'stock', public.noxia_inventory_amount(v_depot, 'roundwood'::public.resource_type));
end;
$$;

revoke all on function public.noxia_earth_actor() from public, anon, authenticated;
revoke all on function public.noxia_pay_earth_actor(uuid,integer,text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.noxia_earth_actor_buys(uuid,integer,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.noxia_owns_earth_parcel(uuid,text) from public, anon, authenticated;
revoke all on function public.sow_earth_field(uuid,text,text,numeric,numeric,numeric,integer) from public, anon, authenticated;
revoke all on function public.harvest_earth_field(uuid,text,text,numeric,numeric,numeric) from public, anon, authenticated;
revoke all on function public.buy_earth_cattle(uuid,text,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.sell_earth_cattle(uuid,text,integer,numeric) from public, anon, authenticated;
revoke all on function public.extract_earth_quarry(uuid,text,numeric,numeric,numeric,numeric,numeric,integer) from public, anon, authenticated;
revoke all on function public.convert_earth_material(uuid,text,text,integer,integer,integer,text) from public, anon, authenticated;
revoke all on function public.harvest_earth_forest(uuid,text,text,numeric,numeric,numeric) from public, anon, authenticated;
grant execute on function public.noxia_earth_actor() to service_role;
grant execute on function public.noxia_pay_earth_actor(uuid,integer,text,text,integer,text,text) to service_role;
grant execute on function public.noxia_earth_actor_buys(uuid,integer,text,integer,text,text) to service_role;
grant execute on function public.noxia_owns_earth_parcel(uuid,text) to service_role;
grant execute on function public.sow_earth_field(uuid,text,text,numeric,numeric,numeric,integer) to service_role;
grant execute on function public.harvest_earth_field(uuid,text,text,numeric,numeric,numeric) to service_role;
grant execute on function public.buy_earth_cattle(uuid,text,integer,integer,integer) to service_role;
grant execute on function public.sell_earth_cattle(uuid,text,integer,numeric) to service_role;
grant execute on function public.extract_earth_quarry(uuid,text,numeric,numeric,numeric,numeric,numeric,integer) to service_role;
grant execute on function public.convert_earth_material(uuid,text,text,integer,integer,integer,text) to service_role;
grant execute on function public.harvest_earth_forest(uuid,text,text,numeric,numeric,numeric) to service_role;
