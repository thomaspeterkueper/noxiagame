-- supabase/migrations/20261028150000_venue_house_rules_nightclub_staffing.sql
-- Requests der Gastronomie an Bevölkerung und Ökonomie (Thomas, 28.10.2026: „bitte requests umsetzen“):
--
--   R-19 Nachtclub als Lokalart:
--     * building_definitions `nightclub` (Stufe 2, life, 3 000 Cr, 3 Ticks), Karte mit Eintritt,
--       Getränk, Longdrink, Shot, Wasser.
--     * real_venue_kind: amenity=nightclub → nightclub (wie venueKindForRealPlace).
--     * Umbau (start_earth_venue_conversion) nimmt `nightclub` an, convert_earth_building nicht.
--     * Bestellung im Nachtclub: andere Posten als Eintritt nur mit bezahltem Eintritt der
--       letzten acht Stunden („Man braucht Eintritt.“, Thomas, 28.10.2026).
--     * Personal wie Bar und Restaurant; Bewohner gehen nachts aus, wenn ihnen Geselligkeit
--       fehlt (run_npc_nightlife, aus run_npc_consumption).
--   R-18 Preise und Dienstleistungen je Haus:
--     * venue_price_overrides (Preis oder „nicht im Angebot“ je Haus und Posten) und
--       venue_services (Toilette: verfügbar, Gebühr, nur für Gäste). Ohne Eintrag gilt die
--       Karte der Lokalart bzw. „Toilette frei für jeden“.
--     * Ändern darf nur der Eigentümer (Spieler oder sein Unternehmen): set_venue_price,
--       set_venue_service. Bewohner zahlen die Hauspreise (Faktor auf ihren Konsum).
--     * Toilette mit Gebühr ist ein Posten `toilet` über order_hospitality_item.
--   R-14 Personal für Bank und Reisebüro:
--     * run_venue_staffing stellt in allen Häusern mit Personalplätzen ein, die eine Art aus
--       noxia_staffed_kinds() haben (Lokale, Bank, Reisebüro); Rolle je Platz aus
--       building_staff_roles (Bank: Schalter, Beratung, Schalter, Büro).
--     * Übergangsreserve für die öffentlichen Dienste der Erde (14 Tageslöhne), ausgewiesen
--       als bootstrap:employer:<actor>:public_services – wie bei Metropol und Balkan Grill.

set search_path to public;

-- ── Arten mit Personal ───────────────────────────────────────────────────────
create or replace function public.noxia_staffed_kinds() returns text[]
language sql immutable as $$
  select array['cafe', 'bar', 'restaurant', 'hotel', 'nightclub', 'bank', 'travel_agency']::text[]
$$;

-- ── R-19: Nachtclub ──────────────────────────────────────────────────────────
create or replace function public.real_venue_kind(p_tags jsonb) returns text
language sql immutable as $$
  select case
    when lower(coalesce(p_tags->>'amenity', '')) in ('cafe', 'fast_food', 'ice_cream') then 'cafe'
    when lower(coalesce(p_tags->>'amenity', '')) = 'nightclub' then 'nightclub'
    when lower(coalesce(p_tags->>'amenity', '')) in ('bar', 'pub', 'biergarten') then 'bar'
    when lower(coalesce(p_tags->>'amenity', '')) = 'restaurant' then 'restaurant'
    when lower(coalesce(p_tags->>'tourism', '')) in ('hotel', 'guest_house', 'motel', 'hostel') then 'hotel'
    else null end
$$;

insert into public.building_definitions
  (key, name, tier, category, is_active, production, sort_order, consumption, description,
   cost_credits, requires_tier, sale_base_cost, build_time_ticks, population_bonus, allowed_locations, requires_building)
values
  ('nightclub', 'Nachtclub', 2, 'life', true, '[]'::jsonb, 151, '[]'::jsonb,
   'Tanzfläche vor dem DJ-Pult, Tresen, Lounge und Türsteher. Geöffnet nachts, Eintritt an der Tür. Auf der Erde durch Umbau eines gekauften Hauses.',
   3000, null, null, 3, 0, null, null)
on conflict (key) do nothing;

insert into public.hospitality_menu (entity_id, item_code, label, price_credits, active)
values
  ('nightclub', 'entry', 'Eintritt', 8, true),
  ('nightclub', 'drink', 'Getränk', 4, true),
  ('nightclub', 'longdrink', 'Longdrink', 7, true),
  ('nightclub', 'shot', 'Shot', 3, true),
  ('nightclub', 'water', 'Wasser', 2, true)
on conflict (entity_id, item_code) do nothing;

-- Bewohner im Nachtclub: Anlass ist Geselligkeit, Preis Eintritt + Getränk.
insert into public.npc_service_catalog (entity_id, service_code, need_code, price_credits, satisfaction_gain, min_interval_ticks)
values ('nightclub', 'nightclub_night', 'social', 12, 0.30, 24)
on conflict do nothing;

-- ── R-18: Preise und Dienstleistungen je Haus ────────────────────────────────
create table if not exists public.venue_price_overrides (
  tile_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  item_code      text not null,
  price_credits  integer check (price_credits is null or price_credits between 1 and 999),
  active         boolean not null default true,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null,
  primary key (tile_entity_id, item_code)
);

create table if not exists public.venue_services (
  tile_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  service_code   text not null check (service_code in ('toilet')),
  available      boolean not null default true,
  price_credits  integer not null default 0 check (price_credits between 0 and 99),
  guests_only    boolean not null default false,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null,
  primary key (tile_entity_id, service_code)
);

alter table public.venue_price_overrides enable row level security;
alter table public.venue_services enable row level security;
revoke all on public.venue_price_overrides, public.venue_services from anon, authenticated;

-- Karte eines Hauses: Karte der Lokalart, mit Hauspreisen; abbestellte Posten fehlen.
create or replace function public.venue_menu(p_tile_entity_id uuid)
returns table(item_code text, label text, price_credits integer, base_price_credits integer, house_price boolean)
language sql stable security definer set search_path = public as $$
  select m.item_code, m.label,
         coalesce(o.price_credits, m.price_credits) as price_credits,
         m.price_credits as base_price_credits,
         (o.price_credits is not null) as house_price
    from public.tile_entities te
    join public.hospitality_menu m on m.entity_id = te.entity_id and m.active
    left join public.venue_price_overrides o on o.tile_entity_id = te.id and o.item_code = m.item_code
   where te.id = p_tile_entity_id and coalesce(o.active, true)
   order by coalesce(o.price_credits, m.price_credits), m.item_code
$$;

-- Wie viel teurer oder billiger ein Haus als die Karte seiner Art ist (1 = wie die Karte).
-- Bewohner kaufen Bündel (z. B. „Snack und Getränk“), keine einzelnen Posten; ihr Preis
-- folgt deshalb dem Verhältnis der Hauskarte zur Karte der Lokalart.
create or replace function public.venue_price_factor(p_tile_entity_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(price_credits)::numeric / nullif(sum(base_price_credits), 0), 1)
    from public.venue_menu(p_tile_entity_id)
$$;

-- Wer die Hausregeln ändern darf: der Spieler, dem das Haus gehört, oder sein Unternehmen.
create or replace function public.venue_owned_by(p_profile_id uuid, p_tile_entity_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tile_entities te
     where te.id = p_tile_entity_id
       and (te.profile_id = p_profile_id
            or te.actor_id in (select actor_id from public.profile_economic_actors where profile_id = p_profile_id))
  )
$$;

create or replace function public.set_venue_price(
  p_profile_id uuid, p_tile_entity_id uuid, p_item_code text, p_price_credits integer, p_active boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_entity text;
begin
  if not public.venue_owned_by(p_profile_id, p_tile_entity_id) then raise exception 'NOXIA_VENUE_NOT_OWNED'; end if;
  select entity_id into v_entity from public.tile_entities where id = p_tile_entity_id;
  if not exists (select 1 from public.hospitality_menu where entity_id = v_entity and item_code = p_item_code and active) then
    raise exception 'NOXIA_ORDER_ITEM_NOT_OFFERED';
  end if;
  if p_price_credits is not null and (p_price_credits < 1 or p_price_credits > 999) then raise exception 'NOXIA_PRICE_INVALID'; end if;
  if p_price_credits is null and coalesce(p_active, true) then
    -- Zurück auf die Karte der Lokalart.
    delete from public.venue_price_overrides where tile_entity_id = p_tile_entity_id and item_code = p_item_code;
  else
    insert into public.venue_price_overrides (tile_entity_id, item_code, price_credits, active, updated_at, updated_by)
    values (p_tile_entity_id, p_item_code, p_price_credits, coalesce(p_active, true), now(), p_profile_id)
    on conflict (tile_entity_id, item_code) do update
      set price_credits = excluded.price_credits, active = excluded.active, updated_at = now(), updated_by = excluded.updated_by;
  end if;
  return jsonb_build_object('ok', true, 'menu', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.venue_menu(p_tile_entity_id) m));
end;
$$;

create or replace function public.set_venue_service(
  p_profile_id uuid, p_tile_entity_id uuid, p_service_code text, p_available boolean, p_price_credits integer, p_guests_only boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.venue_owned_by(p_profile_id, p_tile_entity_id) then raise exception 'NOXIA_VENUE_NOT_OWNED'; end if;
  if p_service_code is distinct from 'toilet' then raise exception 'NOXIA_SERVICE_UNKNOWN'; end if;
  if coalesce(p_price_credits, 0) < 0 or coalesce(p_price_credits, 0) > 99 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  insert into public.venue_services (tile_entity_id, service_code, available, price_credits, guests_only, updated_at, updated_by)
  values (p_tile_entity_id, p_service_code, coalesce(p_available, true), coalesce(p_price_credits, 0), coalesce(p_guests_only, false), now(), p_profile_id)
  on conflict (tile_entity_id, service_code) do update
    set available = excluded.available, price_credits = excluded.price_credits, guests_only = excluded.guests_only,
        updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true, 'services', public.venue_service_rules(p_tile_entity_id));
end;
$$;

-- Hausregeln für die Oberfläche: { toilet: { available, priceCredits, guestsOnly } }.
create or replace function public.venue_service_rules(p_tile_entity_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('toilet', jsonb_build_object(
    'available', coalesce(s.available, true),
    'priceCredits', coalesce(s.price_credits, 0),
    'guestsOnly', coalesce(s.guests_only, false)))
    from (select 1) one
    left join public.venue_services s on s.tile_entity_id = p_tile_entity_id and s.service_code = 'toilet'
$$;

-- ── Umbau: Nachtclub zulassen ────────────────────────────────────────────────
create or replace function public.start_earth_venue_conversion(
  p_profile_id uuid, p_entity_id uuid, p_type text, p_cost integer, p_build_ticks integer,
  p_staff_capacity integer, p_transient_capacity integer, p_residential_capacity integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tile_entities%rowtype;
  v_credits integer;
  v_ready timestamptz;
  v_plan jsonb;
begin
  if p_type not in ('cafe', 'bar', 'restaurant', 'hotel', 'nightclub') then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if not exists (select 1 from public.building_definitions where key = p_type and is_active) then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if p_cost is null or p_cost < 0 or p_build_ticks is null or p_build_ticks < 0 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select * into v_row from public.tile_entities where id = p_entity_id for update;
  if not found then raise exception 'NOXIA_BUILDING_NOT_FOUND'; end if;
  if v_row.profile_id is distinct from p_profile_id then raise exception 'NOXIA_BUILDING_NOT_OWNED'; end if;
  if v_row.source_ref is null then raise exception 'NOXIA_BUILDING_NOT_ACQUIRED'; end if;
  if v_row.conversion_plan is not null then raise exception 'NOXIA_CONVERSION_PENDING'; end if;
  if v_row.entity_id = p_type then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if v_credits < p_cost then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  -- Umbaukosten wie ein Bau: abgebucht ohne Gegenbuchung (dieselbe Senke wie /api/game/build/spatial).
  update public.profiles set credits = credits - p_cost where id = p_profile_id;
  v_ready := now() + make_interval(hours => p_build_ticks);
  v_plan := jsonb_build_object('type', p_type, 'cost', p_cost, 'build_ticks', p_build_ticks, 'started_at', now(), 'ready_at', v_ready,
    'staff_capacity', greatest(0, coalesce(p_staff_capacity, 0)), 'transient_capacity', greatest(0, coalesce(p_transient_capacity, 0)),
    'residential_capacity', greatest(0, coalesce(p_residential_capacity, 0)), 'from', v_row.entity_id);
  update public.tile_entities set conversion_plan = v_plan where id = p_entity_id;
  if p_build_ticks = 0 then perform public.complete_due_earth_conversions(); end if;
  return jsonb_build_object('ok', true, 'entity_id', p_entity_id, 'type', p_type, 'cost', p_cost, 'credits', v_credits - p_cost, 'ready_at', v_ready, 'plan', v_plan);
end;
$$;


create or replace function public.convert_earth_building(p_profile_id uuid, p_entity_id uuid, p_type text, p_cost integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tile_entities%rowtype;
  v_credits integer;
begin
  if p_cost is null or p_cost < 0 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  if p_type in ('cafe', 'bar', 'restaurant', 'hotel', 'nightclub') then raise exception 'NOXIA_TYPE_INVALID'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select * into v_row from public.tile_entities where id = p_entity_id for update;
  if not found then raise exception 'NOXIA_BUILDING_NOT_FOUND'; end if;
  if v_row.profile_id is distinct from p_profile_id then raise exception 'NOXIA_BUILDING_NOT_OWNED'; end if;
  if v_row.source_ref is null then raise exception 'NOXIA_BUILDING_NOT_ACQUIRED'; end if;
  if v_row.conversion_plan is not null then raise exception 'NOXIA_CONVERSION_PENDING'; end if;
  if not exists (select 1 from public.building_definitions where key = p_type and is_active) then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if v_credits < p_cost then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  update public.profiles set credits = credits - p_cost where id = p_profile_id;
  update public.tile_entities set entity_id = p_type, built_at = now() where id = p_entity_id;
  return jsonb_build_object('ok', true, 'entity_id', p_entity_id, 'type', p_type, 'cost', p_cost, 'credits', v_credits - p_cost);
end;
$$;


-- ── Bestellung: Hauspreise, Toilette, Eintritt im Nachtclub (R-18, R-19) ─────
create or replace function public.order_hospitality_item(p_profile_id uuid, p_tile_entity_id uuid, p_item_code text, p_request_id uuid, p_tick bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_credits integer;
  v_tile public.tile_entities%rowtype;
  v_price integer;
  v_label text;
  v_service public.venue_services%rowtype;
  v_seller uuid;
  v_tax_rate numeric;
  v_tax integer;
  v_net integer;
  v_order public.player_hospitality_orders%rowtype;
  v_ref text;
begin
  if p_profile_id is null or p_tile_entity_id is null or p_item_code is null or p_request_id is null or p_tick is null then
    raise exception 'NOXIA_ORDER_REQUIRED_ARGUMENT_MISSING';
  end if;

  -- Sperrt das Spielerkonto: Prüfung und Abbuchung sind eine Transaktion.
  select credits into v_credits from public.profiles where id=p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;

  -- Dieselbe Anfrage noch einmal: nichts erneut buchen, das alte Ergebnis zurückgeben.
  select * into v_order from public.player_hospitality_orders where request_id=p_request_id;
  if found then
    if v_order.profile_id <> p_profile_id then raise exception 'NOXIA_ORDER_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'order_id',v_order.id,
      'price_credits',v_order.price_credits,'tax_credits',v_order.transaction_tax_credits,'credits',v_credits);
  end if;

  select * into v_tile from public.tile_entities
  where id=p_tile_entity_id and entity_type='building' and status='active';
  if not found then raise exception 'NOXIA_ORDER_VENUE_NOT_FOUND'; end if;

  if p_item_code = 'toilet' then
    -- Toilette nach Hausregel (R-18); ohne Eintrag frei für jeden.
    select * into v_service from public.venue_services where tile_entity_id=v_tile.id and service_code='toilet';
    if found and not v_service.available then raise exception 'NOXIA_SERVICE_UNAVAILABLE'; end if;
    if found and v_service.guests_only and not exists (
      select 1 from public.player_hospitality_orders o
       where o.profile_id=p_profile_id and o.tile_entity_id=v_tile.id and o.item_code<>'toilet'
         and o.created_at > now() - interval '4 hours'
    ) then raise exception 'NOXIA_SERVICE_GUESTS_ONLY'; end if;
    v_price := coalesce(v_service.price_credits, 0);
    v_label := 'Toilette';
    if v_price = 0 then
      return jsonb_build_object('ok',true,'duplicate',false,'order_id',null,'item_code','toilet','label',v_label,
        'price_credits',0,'tax_credits',0,'seller_net_credits',0,'credits',v_credits,'free',true);
    end if;
  else
    select m.price_credits, m.label into v_price, v_label from public.venue_menu(v_tile.id) m where m.item_code=p_item_code;
    if v_price is null then raise exception 'NOXIA_ORDER_ITEM_NOT_OFFERED'; end if;

    -- Nachtclub: ohne Eintritt der letzten acht Stunden nur der Eintritt (R-19).
    if v_tile.entity_id = 'nightclub' and p_item_code <> 'entry' and not exists (
      select 1 from public.player_hospitality_orders o
       where o.profile_id=p_profile_id and o.tile_entity_id=v_tile.id and o.item_code='entry'
         and o.created_at > now() - interval '8 hours'
    ) then raise exception 'NOXIA_ENTRY_REQUIRED'; end if;
  end if;

  select coalesce(
    v_tile.actor_id,
    (select actor_id from public.profile_economic_actors where profile_id=v_tile.profile_id),
    (select actor_id from public.location_public_actors where location_id=v_tile.location_id)
  ) into v_seller;
  if v_seller is null then raise exception 'NOXIA_ORDER_SELLER_ACCOUNT_MISSING'; end if;

  if v_credits < v_price then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  select least(1,greatest(0,coalesce(cs.tax_transaction,0))) into v_tax_rate
  from public.colony_settings cs where cs.location_id=v_tile.location_id;
  v_tax_rate := coalesce(v_tax_rate,0);
  v_tax := least(v_price, greatest(0, round(v_price*v_tax_rate)::integer));
  v_net := v_price - v_tax;

  insert into public.player_hospitality_orders(
    request_id,profile_id,tile_entity_id,seller_actor_id,item_code,price_credits,
    transaction_tax_rate,transaction_tax_credits,seller_net_credits,tick
  ) values (
    p_request_id,p_profile_id,p_tile_entity_id,v_seller,p_item_code,v_price,
    v_tax_rate,v_tax,v_net,p_tick
  ) returning * into v_order;

  v_ref := 'hospitality_order:' || v_order.id::text;

  update public.profiles set credits = credits - v_price where id=p_profile_id;

  if v_net > 0 then
    insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
    values (v_seller,p_tick,'income',0,v_net,v_tile.location_id,v_ref,'Verkauf netto: ' || v_label);
  end if;

  if v_tax > 0 then
    insert into public.colony_ledger(location_id,tick,entry_type,profile_id,resource_type,amount,note)
    values (v_tile.location_id,p_tick,'tax_transaction',p_profile_id,null,v_tax,'Konsumsteuer (' || v_ref || ')');
  end if;

  return jsonb_build_object(
    'ok',true,'duplicate',false,'order_id',v_order.id,'item_code',p_item_code,'label',v_label,
    'price_credits',v_price,'tax_credits',v_tax,'seller_net_credits',v_net,
    'credits',v_credits - v_price
  );
end;
$function$;

-- ── R-14: Rollen je Personalplatz ────────────────────────────────────────────
insert into public.role_wage_rates (role_code, daily_credits)
values ('bank_clerk', 60), ('bank_advisor', 75), ('travel_agent', 60)
on conflict (role_code) do nothing;

create table if not exists public.building_staff_roles (
  entity_id text not null,
  slot      integer not null check (slot >= 1),
  role_code text not null references public.role_wage_rates(role_code),
  label     text,
  primary key (entity_id, slot)
);
alter table public.building_staff_roles enable row level security;
revoke all on public.building_staff_roles from anon, authenticated;

-- Bank: Reihenfolge wie im Innenraum (Schalter, Beratung, zweiter Schalter, Büro).
insert into public.building_staff_roles (entity_id, slot, role_code, label) values
  ('bank', 1, 'bank_clerk', 'Schalter'),
  ('bank', 2, 'bank_advisor', 'Beratung'),
  ('bank', 3, 'bank_clerk', 'Schalter'),
  ('bank', 4, 'bank_clerk', 'Büro'),
  ('travel_agency', 1, 'travel_agent', 'Beratung'),
  ('travel_agency', 2, 'travel_agent', 'Beratung')
on conflict (entity_id, slot) do nothing;

-- Übergangsreserve für die öffentlichen Dienste der Erde: 14 Tageslöhne für die
-- Plätze von Bank und Reisebüro, einmalig und ausgewiesen (NOXIA-FIN-0001).
do $$
declare
  v_earth uuid;
  v_actor uuid;
  v_daily integer;
  v_tick bigint;
begin
  select id into v_earth from public.locations where slug = 'earth';
  select actor_id into v_actor from public.location_public_actors where location_id = v_earth;
  if v_actor is null then return; end if;
  if exists (select 1 from public.npc_ledger where actor_id = v_actor and ref = 'bootstrap:employer:' || v_actor::text || ':public_services') then return; end if;
  select coalesce(sum(w.daily_credits), 0) into v_daily
    from public.tile_entities te
    join generate_series(1, 8) s(slot) on s.slot <= coalesce(te.staff_capacity, 0)
    left join public.building_staff_roles r on r.entity_id = te.entity_id and r.slot = s.slot
    join public.role_wage_rates w on w.role_code = coalesce(r.role_code, 'service')
   where te.location_id = v_earth and te.is_state_owned and te.status = 'active' and te.entity_id in ('bank', 'travel_agency');
  if v_daily = 0 then return; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'endowment', null, 0, 14 * v_daily, v_earth, 'bootstrap:employer:' || v_actor::text || ':public_services',
          'Bootstrap-Übergangsreserve: 14 Tageslöhne für das Personal von Bank und Reisebüro des Ortes');
end $$;


-- ── Personal (R-14, R-19) ───────────────────────────────────────────────────
create or replace function public.run_venue_staffing(p_tick bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue record;
  v_wage integer;
  v_payroll integer;
  v_balance numeric;
  v_person uuid;
  v_actor uuid;
  v_assignment uuid;
  v_name text;
  v_hash text;
  v_key text;
  v_n integer;
  v_home_free boolean;
  v_rehomed integer := 0;
  v_hired integer := 0;
  v_created integer := 0;
  v_no_money integer := 0;
  v_no_employer integer := 0;
  v_no_candidate integer := 0;
  v_role text;
  v_role_wage integer;
  v_first text[] := array['Anna','Lukas','Marie','Jonas','Sophie','Felix','Lea','Paul','Hannah','Ben','Clara','Elias','Greta','Moritz','Ida','Jakob','Emilia','Noah','Lina','Theo','Mila','Karl','Frieda','Anton','Ella','Oskar','Luise','Henri','Rosa','Mats','Yusuf','Elif','Milan','Ana','Nikola','Sara'];
  v_last text[] := array['Schulte','Becker','Hoffmann','Wiese','Kemper','Rinsche','Vogt','Lange','Hennecke','Brüggemann','Schmidt','Klein','Wolf','Kaiser','Schröder','Bremer','Lohmann','Hesse','Busch','Peters','Yilmaz','Kaya','Petrović','Nowak','Ferreira','Rossi'];
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_STAFFING_TICK_INVALID'; end if;
  select daily_credits into v_wage from public.role_wage_rates where role_code = 'service';
  if v_wage is null then return jsonb_build_object('ok', false, 'reason', 'no_service_wage'); end if;

  -- 0. Der Arbeitgeber folgt dem Eigentümer eines realen Lokals.
  update public.person_assignments pa
     set employer_actor_id = own.actor_id, updated_at = now()
    from (
      select te.id, coalesce(te.actor_id, pea.actor_id, case when te.is_state_owned then lpa.actor_id end) as actor_id
        from public.tile_entities te
        left join public.profile_economic_actors pea on pea.profile_id = te.profile_id
        left join public.location_public_actors lpa on lpa.location_id = te.location_id
       where te.entity_id = any(public.noxia_staffed_kinds()) and te.source_ref is not null
    ) own
   where pa.tile_entity_id = own.id and pa.assignment_type = 'work' and pa.is_active
     and own.actor_id is not null and pa.employer_actor_id is distinct from own.actor_id;
  get diagnostics v_rehomed = row_count;

  for v_venue in
    select te.id, te.location_id, te.latitude_deg, te.longitude_deg, te.x_m, te.y_m, te.spatial_region_id,
           te.display_name, te.entity_id, coalesce(te.residential_capacity, 0) as residential_capacity, l.slug,
           coalesce(te.actor_id, pea.actor_id, case when te.is_state_owned then lpa.actor_id end) as employer
      from public.tile_entities te
      join public.locations l on l.id = te.location_id
      left join public.profile_economic_actors pea on pea.profile_id = te.profile_id
      left join public.location_public_actors lpa on lpa.location_id = te.location_id
     where te.entity_type = 'building' and te.status = 'active' and te.conversion_plan is null
       and te.entity_id = any(public.noxia_staffed_kinds())
       and coalesce(te.staff_capacity, 0) > (
         select count(*) from public.person_assignments a where a.tile_entity_id = te.id and a.assignment_type = 'work' and a.is_active)
     order by te.id
  loop
    if v_venue.employer is null then v_no_employer := v_no_employer + 1; continue; end if;

    -- Rolle des nächsten freien Platzes (R-14: Bank Schalter, Beratung, Schalter, Büro), sonst Service.
    v_role := coalesce((select r.role_code from public.building_staff_roles r
                         where r.entity_id = v_venue.entity_id
                           and r.slot = 1 + (select count(*) from public.person_assignments a
                                              where a.tile_entity_id = v_venue.id and a.assignment_type = 'work' and a.is_active)), 'service');
    v_role_wage := coalesce((select daily_credits from public.role_wage_rates where role_code = v_role), v_wage);

    select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_venue.employer;
    -- Lohnsumme seiner Lokale (andere Stellen desselben Arbeitgebers zählen hier nicht;
    -- die Lohnrunde zahlt sie trotzdem aus demselben Konto).
    select coalesce(sum(w.daily_credits), 0) into v_payroll
      from public.person_assignments a
      join public.role_wage_rates w on w.role_code = a.role_code
      join public.tile_entities t on t.id = a.tile_entity_id and t.entity_id = any(public.noxia_staffed_kinds())
     where a.employer_actor_id = v_venue.employer and a.assignment_type = 'work' and a.is_active;
    if v_balance < 7 * (v_payroll + v_role_wage) then v_no_money := v_no_money + 1; continue; end if;

    -- Bewerber: übernommene Menschen des realen Ortes ohne Arbeit, die nächste zuerst.
    v_person := null;
    select p.id into v_person
      from public.people p
      join public.person_economic_actors pea on pea.person_id = p.id
      left join public.person_life_state pls on pls.person_id = p.id
      left join public.person_surface_presence sp on sp.person_id = p.id
     where p.current_location_id = v_venue.location_id
       and coalesce(pls.life_stage, 'adult') = 'adult'
       and (p.person_key like 'earth-house:%' or p.person_key like 'earth-local:%')
       and not exists (select 1 from public.person_assignments a where a.person_id = p.id and a.assignment_type = 'work' and a.is_active)
       and sp.latitude_deg is not null and v_venue.latitude_deg is not null
       and abs(sp.latitude_deg - v_venue.latitude_deg) < 0.045 and abs(sp.longitude_deg - v_venue.longitude_deg) < 0.07
     order by (sp.latitude_deg - v_venue.latitude_deg)^2 + ((sp.longitude_deg - v_venue.longitude_deg) * 0.62)^2, p.id
     limit 1;

    if v_person is null then
      -- Nur auf der Erde: jemand aus dem realen Ort kommt dazu.
      if v_venue.slug <> 'earth' or v_venue.latitude_deg is null then v_no_candidate := v_no_candidate + 1; continue; end if;
      select count(*) + 1 into v_n from public.people where person_key like 'earth-local:' || v_venue.id::text || ':%';
      v_key := 'earth-local:' || v_venue.id::text || ':' || v_n::text;
      v_hash := md5(v_key);
      v_name := v_first[1 + (('x' || substr(v_hash, 1, 6))::bit(24)::int % array_length(v_first, 1))]
             || ' ' || v_last[1 + (('x' || substr(v_hash, 7, 6))::bit(24)::int % array_length(v_last, 1))];
      insert into public.people(display_name, birth_year, current_location_id, simulation_tier, activity_state, last_action,
                                last_decision_factors, last_tick, person_key, bio_short, traits, observable_description)
      values (v_name, 2030 + (('x' || substr(v_hash, 13, 4))::bit(16)::int % 40), v_venue.location_id, 'background', 'idle', 'hired',
              jsonb_build_object('materialized_for', 'venue_staff', 'tile_entity_id', v_venue.id, 'role', v_role), p_tick, v_key,
              left('Arbeitet in ' || coalesce(v_venue.display_name, case when v_venue.entity_id in ('bank', 'travel_agency') then 'einem Betrieb des Ortes' else 'einem Lokal' end) || '.', 200),
              jsonb_build_object('origin', 'real_town_local'),
              'Eine Person aus dem Ort')
      returning id into v_person;
      insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
      values ('npc_person', v_name, 'Persönlicher Wirtschaftsakteur der Living Population.', '{}'::jsonb, '{}'::jsonb)
      returning id into v_actor;
      insert into public.person_economic_actors(person_id, actor_id) values (v_person, v_actor);
      insert into public.person_life_state(person_id, life_stage, age_ticks, family_desire, last_family_event_tick)
      values (v_person, 'adult', 0, 0.5, null) on conflict (person_id) do nothing;
      insert into public.person_needs(person_id, need_code, satisfaction, updated_tick)
      values (v_person,'sustenance',0.70,p_tick),(v_person,'rest',0.70,p_tick),(v_person,'safety',0.70,p_tick),
             (v_person,'social',0.70,p_tick),(v_person,'purpose',0.70,p_tick),(v_person,'variety',0.70,p_tick)
      on conflict (person_id, need_code) do nothing;
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_actor, p_tick, 'endowment', null, 0, 980, v_venue.location_id, 'bootstrap:person:' || v_person::text,
              'Bootstrap-Startbestand: Person aus dem realen Ort, als Personal eines Lokals ins Spiel übernommen');
      insert into public.person_surface_presence(person_id, location_id, source_kind, source_ref, x_m, y_m, latitude_deg, longitude_deg, spatial_region_id, confidence, updated_tick)
      values (v_person, v_venue.location_id, 'building_anchor', 'tile_entity:' || v_venue.id::text, v_venue.x_m, v_venue.y_m,
              v_venue.latitude_deg, v_venue.longitude_deg, v_venue.spatial_region_id, 0.9, p_tick)
      on conflict (person_id) do nothing;

      -- Wohnt über dem Lokal, wenn dort eine Wohnung frei ist (R-6), Miete an den Eigentümer.
      v_home_free := v_venue.residential_capacity > (
        select count(*) from public.person_assignments a where a.tile_entity_id = v_venue.id and a.assignment_type = 'home' and a.is_active);
      if v_home_free then
        insert into public.person_assignments(person_id, assignment_type, location_id, tile_entity_id, role_code, starts_tick, ends_tick, is_active)
        values (v_person, 'home', v_venue.location_id, v_venue.id, 'resident', p_tick, null, true)
        returning id into v_assignment;
        insert into public.person_tenancies(assignment_id, person_id, location_id, tile_entity_id, landlord_actor_id,
                                            rent_per_billing, billing_interval_ticks, next_due_tick, status, origin, tenure)
        values (v_assignment, v_person, v_venue.location_id, v_venue.id, v_venue.employer, 200, 720, p_tick + 720, 'active', 'market', 'rented');
      end if;
      v_created := v_created + 1;
    end if;

    insert into public.person_assignments(person_id, assignment_type, location_id, tile_entity_id, employer_actor_id, role_code, starts_tick, ends_tick, is_active)
    values (v_person, 'work', v_venue.location_id, v_venue.id, v_venue.employer, v_role, p_tick, null, true);
    v_hired := v_hired + 1;
  end loop;

  return jsonb_build_object('ok', true, 'tick', p_tick, 'hired', v_hired, 'created', v_created, 'employer_updated', v_rehomed,
    'no_money', v_no_money, 'no_employer', v_no_employer, 'no_candidate', v_no_candidate);
end;
$$;

-- ── Konsum der Bewohner: Hauspreise, Nachtclub mit Personal (R-18, R-19) ────
create or replace function public.run_npc_consumption(p_tick bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_person record;
  v_offer record;
  v_buyer_balance numeric;
  v_event_id uuid;
  v_ref text;
  v_tax_rate numeric;
  v_tax integer;
  v_net integer;
  v_emergency boolean;
  v_bought integer := 0;
  v_emergency_count integer := 0;
  v_no_money integer := 0;
  v_waiting integer := 0;
  v_no_seller integer := 0;
  v_total integer := 0;
  v_tax_total integer := 0;
  v_night jsonb;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_CONSUMPTION_TICK_INVALID'; end if;
  if mod(p_tick,6) <> 0 then
    return jsonb_build_object(
      'ok',true,'due',false,'bought',0,'emergency',0,'waiting',0,'no_money',0,'no_seller',0,
      'total_credits',0,'tax_credits',0
    );
  end if;

  for v_person in
    select p.id person_id,p.current_location_id,pn.satisfaction,pea.actor_id buyer_actor_id
    from public.people p
    join public.person_needs pn on pn.person_id=p.id and pn.need_code='sustenance'
    join public.person_economic_actors pea on pea.person_id=p.id
    left join public.person_life_state pls on pls.person_id=p.id
    where pn.satisfaction < 0.65
      and coalesce(pls.life_stage,'adult')='adult'
      and p.current_location_id is not null
    order by pn.satisfaction asc,p.id
  loop
    select coalesce(sum(credit_delta),0) into v_buyer_balance
    from public.npc_ledger where actor_id=v_person.buyer_actor_id;

    v_emergency := false;

    -- Bezahlbare Angebote: Lokale vor der Kantine. Bar und Restaurant nur mit Personal.
    -- Unter den Lokalen gestreut je Person und Tick, billigere häufiger (∝ 1 / Preis).
    select te.id tile_entity_id,te.entity_id,c.service_code,c.need_code,
           greatest(1,round(c.price_credits*public.venue_price_factor(te.id)))::integer price_credits,
           c.satisfaction_gain,c.min_interval_ticks,
           coalesce(te.actor_id,pea.actor_id,lpa.actor_id) seller_actor_id
    into v_offer
    from public.tile_entities te
    join public.npc_service_catalog c on c.entity_id=te.entity_id and c.active=true
    left join public.profile_economic_actors pea on pea.profile_id=te.profile_id
    left join public.location_public_actors lpa on lpa.location_id=te.location_id
    where te.location_id=v_person.current_location_id
      and te.status='active'
      and c.need_code='sustenance'
      and greatest(1,round(c.price_credits*public.venue_price_factor(te.id))) <= v_buyer_balance
      and (
        te.actor_id is not null
        or (te.owner_class='PLAYER' and pea.actor_id is not null)
        or (te.owner_class='STATE' and lpa.actor_id is not null)
      )
      and (
        te.entity_id not in ('bar','restaurant','hotel','nightclub')
        or exists (select 1 from public.person_assignments w
                   where w.tile_entity_id=te.id and w.assignment_type='work' and w.is_active)
      )
      and not exists (
        select 1 from public.person_consumption_events e
        where e.person_id=v_person.person_id
          and e.service_code=c.service_code
          and e.tick > p_tick-c.min_interval_ticks
      )
    order by (te.entity_id='port_canteen') asc,
             -ln((('x00000000' || substr(md5(v_person.person_id::text || ':' || p_tick::text || ':' || te.id::text),1,8))::bit(64)::bigint + 1)::numeric / 4294967297)
               * greatest(round(c.price_credits*public.venue_price_factor(te.id)),1) asc,
             te.id
    limit 1;

    if not found then
      if not exists (
        select 1 from public.tile_entities te
        join public.npc_service_catalog c on c.entity_id=te.entity_id and c.active=true
        where te.location_id=v_person.current_location_id and te.status='active'
          and c.need_code='sustenance'
      ) then
        v_no_seller:=v_no_seller+1;
        continue;
      end if;
      if v_buyer_balance >= (
        select min(c.price_credits) from public.tile_entities te
        join public.npc_service_catalog c on c.entity_id=te.entity_id and c.active=true
        where te.location_id=v_person.current_location_id and te.status='active'
          and c.need_code='sustenance'
      ) then
        v_waiting:=v_waiting+1;
        continue;
      end if;

      select te.id tile_entity_id,te.entity_id,'canteen_emergency_ration'::text service_code,
             'sustenance'::text need_code,0 price_credits,0.12::numeric satisfaction_gain,
             6 min_interval_ticks,lpa.actor_id seller_actor_id
      into v_offer
      from public.tile_entities te
      join public.location_public_actors lpa on lpa.location_id=te.location_id
      where te.location_id=v_person.current_location_id
        and te.status='active' and te.entity_id='port_canteen'
        and not exists (
          select 1 from public.person_consumption_events e
          where e.person_id=v_person.person_id
            and e.service_code='canteen_emergency_ration'
            and e.tick > p_tick-6
        )
      order by te.id
      limit 1;

      if not found then
        v_no_money:=v_no_money+1;
        continue;
      end if;
      v_emergency := true;
    end if;

    if v_emergency then
      v_tax_rate := 0; v_tax := 0; v_net := 0;
    else
      select least(1,greatest(0,coalesce(cs.tax_transaction,0)))
        into v_tax_rate
      from public.colony_settings cs
      where cs.location_id=v_person.current_location_id;

      v_tax_rate := coalesce(v_tax_rate,0);
      v_tax := least(
        v_offer.price_credits,
        greatest(0,round(v_offer.price_credits*v_tax_rate)::integer)
      );
      v_net := v_offer.price_credits-v_tax;
    end if;

    insert into public.person_consumption_events(
      person_id,buyer_actor_id,seller_actor_id,tile_entity_id,
      service_code,need_code,price_credits,satisfaction_gain,tick,
      transaction_tax_rate,transaction_tax_credits,seller_net_credits
    ) values (
      v_person.person_id,v_person.buyer_actor_id,v_offer.seller_actor_id,v_offer.tile_entity_id,
      v_offer.service_code,v_offer.need_code,v_offer.price_credits,v_offer.satisfaction_gain,p_tick,
      v_tax_rate,v_tax,v_net
    )
    on conflict (person_id,service_code,tick) do nothing
    returning id into v_event_id;

    if v_event_id is null then continue; end if;

    if not v_emergency then
      v_ref := 'consumption:' || v_event_id::text;

      with debit as (
        insert into public.npc_ledger(
          actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note
        ) values (
          v_person.buyer_actor_id,p_tick,'expense',0,-v_offer.price_credits,
          v_person.current_location_id,v_ref,'Alltagskonsum: ' || v_offer.service_code
        )
        on conflict do nothing
        returning 1
      ),
      seller as (
        insert into public.npc_ledger(
          actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note
        )
        select
          v_offer.seller_actor_id,p_tick,'income',0,v_net,
          v_person.current_location_id,v_ref,'Verkauf netto: ' || v_offer.service_code
        from debit
        returning 1
      )
      insert into public.colony_ledger(
        location_id,tick,entry_type,profile_id,resource_type,amount,note
      )
      select
        v_person.current_location_id,p_tick,'tax_transaction',null,null,v_tax,
        'Konsumsteuer (' || v_ref || ')'
      from seller
      where v_tax>0
      on conflict do nothing;

      v_total:=v_total+v_offer.price_credits;
      v_tax_total:=v_tax_total+v_tax;
      v_bought:=v_bought+1;
    else
      v_emergency_count:=v_emergency_count+1;
    end if;

    update public.person_needs
    set satisfaction=least(1,satisfaction+v_offer.satisfaction_gain),updated_tick=p_tick
    where person_id=v_person.person_id and need_code=v_offer.need_code;
  end loop;

  -- Ausgehen am Abend (R-19): eigener Lauf, Anlass Geselligkeit statt Hunger.
  v_night := public.run_npc_nightlife(p_tick);

  return jsonb_build_object(
    'ok',true,'due',true,'bought',v_bought,'emergency',v_emergency_count,
    'waiting',v_waiting,'no_money',v_no_money,'no_seller',v_no_seller,
    'total_credits',v_total,'tax_credits',v_tax_total,'nightlife',v_night
  );
end;
$function$;


-- ── R-19: Ausgehen in der Nacht ──────────────────────────────────────────────
-- Läuft aus run_npc_consumption (alle sechs Ticks). Koloniezeit: Stunde = Tick mod 24,
-- der Nachtclub hat 22–5 Uhr geöffnet. Anlass ist fehlende Geselligkeit, nicht Hunger.
-- Nicht jede einsame Person geht: etwa jede dritte, gestreut je Person und Nacht.
create or replace function public.run_npc_nightlife(p_tick bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour integer := mod(p_tick, 24)::integer;
  v_person record;
  v_offer record;
  v_balance numeric;
  v_event_id uuid;
  v_ref text;
  v_tax_rate numeric;
  v_tax integer;
  v_net integer;
  v_went integer := 0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_NIGHTLIFE_TICK_INVALID'; end if;
  if not (v_hour >= 22 or v_hour < 5) then
    return jsonb_build_object('ok', true, 'open', false, 'went', 0);
  end if;

  for v_person in
    select p.id person_id, p.current_location_id, pea.actor_id buyer_actor_id
      from public.people p
      join public.person_needs pn on pn.person_id = p.id and pn.need_code = 'social'
      join public.person_economic_actors pea on pea.person_id = p.id
      left join public.person_life_state pls on pls.person_id = p.id
     where pn.satisfaction < 0.55
       and coalesce(pls.life_stage, 'adult') = 'adult'
       and p.current_location_id is not null
       and ('x' || substr(md5(p.id::text || ':night:' || (p_tick / 24)::text), 1, 2))::bit(8)::int < 85
     order by pn.satisfaction asc, p.id
  loop
    select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_person.buyer_actor_id;

    select te.id tile_entity_id, c.service_code, c.need_code,
           greatest(1, round(c.price_credits * public.venue_price_factor(te.id)))::integer price_credits,
           c.satisfaction_gain, coalesce(te.actor_id, pea.actor_id, lpa.actor_id) seller_actor_id
      into v_offer
      from public.tile_entities te
      join public.npc_service_catalog c on c.entity_id = te.entity_id and c.active and c.need_code = 'social'
      left join public.profile_economic_actors pea on pea.profile_id = te.profile_id
      left join public.location_public_actors lpa on lpa.location_id = te.location_id
     where te.location_id = v_person.current_location_id
       and te.status = 'active' and te.entity_id = 'nightclub' and te.conversion_plan is null
       and exists (select 1 from public.person_assignments w where w.tile_entity_id = te.id and w.assignment_type = 'work' and w.is_active)
       and coalesce(te.actor_id, pea.actor_id, lpa.actor_id) is not null
       and greatest(1, round(c.price_credits * public.venue_price_factor(te.id))) <= v_balance
       and not exists (select 1 from public.person_consumption_events e
                        where e.person_id = v_person.person_id and e.service_code = c.service_code
                          and e.tick > p_tick - c.min_interval_ticks)
     order by md5(v_person.person_id::text || te.id::text), te.id
     limit 1;
    if not found then continue; end if;

    select least(1, greatest(0, coalesce(cs.tax_transaction, 0))) into v_tax_rate
      from public.colony_settings cs where cs.location_id = v_person.current_location_id;
    v_tax_rate := coalesce(v_tax_rate, 0);
    v_tax := least(v_offer.price_credits, greatest(0, round(v_offer.price_credits * v_tax_rate)::integer));
    v_net := v_offer.price_credits - v_tax;

    v_event_id := null;
    insert into public.person_consumption_events(
      person_id, buyer_actor_id, seller_actor_id, tile_entity_id, service_code, need_code, price_credits,
      satisfaction_gain, tick, transaction_tax_rate, transaction_tax_credits, seller_net_credits)
    values (v_person.person_id, v_person.buyer_actor_id, v_offer.seller_actor_id, v_offer.tile_entity_id,
            v_offer.service_code, v_offer.need_code, v_offer.price_credits, v_offer.satisfaction_gain, p_tick,
            v_tax_rate, v_tax, v_net)
    on conflict (person_id, service_code, tick) do nothing
    returning id into v_event_id;
    if v_event_id is null then continue; end if;

    v_ref := 'consumption:' || v_event_id::text;
    insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
    values (v_person.buyer_actor_id, p_tick, 'expense', 0, -v_offer.price_credits, v_person.current_location_id, v_ref, 'Ausgehen: Nachtclub');
    if v_net > 0 then
      insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
      values (v_offer.seller_actor_id, p_tick, 'income', 0, v_net, v_person.current_location_id, v_ref, 'Verkauf netto: Nachtclub');
    end if;
    if v_tax > 0 then
      insert into public.colony_ledger(location_id, tick, entry_type, profile_id, resource_type, amount, note)
      values (v_person.current_location_id, p_tick, 'tax_transaction', null, null, v_tax, 'Konsumsteuer (' || v_ref || ')');
    end if;
    update public.person_needs set satisfaction = least(1, satisfaction + v_offer.satisfaction_gain), updated_tick = p_tick
     where person_id = v_person.person_id and need_code = 'social';
    v_went := v_went + 1;
  end loop;

  return jsonb_build_object('ok', true, 'open', true, 'went', v_went);
end;
$$;

-- ── Rechte ───────────────────────────────────────────────────────────────────
revoke all on function public.run_npc_nightlife(bigint) from public, anon, authenticated;
grant execute on function public.run_npc_nightlife(bigint) to service_role;
revoke all on function public.set_venue_price(uuid,uuid,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.set_venue_price(uuid,uuid,text,integer,boolean) to service_role;
revoke all on function public.set_venue_service(uuid,uuid,text,boolean,integer,boolean) from public, anon, authenticated;
grant execute on function public.set_venue_service(uuid,uuid,text,boolean,integer,boolean) to service_role;
revoke all on function public.venue_owned_by(uuid,uuid) from public, anon, authenticated;
grant execute on function public.venue_owned_by(uuid,uuid) to service_role;
revoke all on function public.venue_menu(uuid) from public, anon, authenticated;
grant execute on function public.venue_menu(uuid) to service_role;
revoke all on function public.venue_service_rules(uuid) from public, anon, authenticated;
grant execute on function public.venue_service_rules(uuid) to service_role;
revoke all on function public.venue_price_factor(uuid) from public, anon, authenticated;
grant execute on function public.venue_price_factor(uuid) to service_role;
revoke all on function public.order_hospitality_item(uuid,uuid,text,uuid,bigint) from public, anon, authenticated;
grant execute on function public.order_hospitality_item(uuid,uuid,text,uuid,bigint) to service_role;
