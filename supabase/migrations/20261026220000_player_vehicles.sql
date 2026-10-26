-- 20261026220000_player_vehicles.sql
-- Fahrzeuge auf der Erde: Kauf im Autohaus, Reparatur in der Werkstatt, Laden an
-- der Station, Fahrten zwischen Orten. Eine Spielerin hat höchstens ein aktives
-- Fahrzeug. Kauf, Reparatur und Laden sind versteuerte Überweisungen an den
-- öffentlichen Akteur des Standorts (wie order_hospitality_item), idempotent je
-- request_id. Zustand und Akku sind Prozentwerte 0–100.
begin;

create table if not exists public.player_vehicles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  model_code text not null,
  model_label text not null,
  condition_pct integer not null default 100 check (condition_pct between 0 and 100),
  charge_pct integer not null default 100 check (charge_pct between 0 and 100),
  latitude_deg double precision,
  longitude_deg double precision,
  odometer_m bigint not null default 0,
  active boolean not null default true,
  purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_player_vehicles_active on public.player_vehicles(profile_id) where active;
alter table public.player_vehicles enable row level security;
drop policy if exists player_vehicles_own_read on public.player_vehicles;
create policy player_vehicles_own_read on public.player_vehicles for select using (auth.uid() = profile_id);

create table if not exists public.player_vehicle_services (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.player_vehicles(id) on delete set null,
  service_kind text not null check (service_kind in ('buy','repair','charge')),
  price_credits integer not null check (price_credits >= 0),
  transaction_tax_credits integer not null default 0,
  seller_actor_id uuid,
  tick bigint not null,
  created_at timestamptz not null default now()
);
alter table public.player_vehicle_services enable row level security;

-- Modelle: Code, Bezeichnung, Preis. Bewusst klein; später aus einer Tabelle.
create or replace function public.vehicle_model(p_code text)
returns table(model_code text, model_label text, price_credits integer)
language sql immutable as $$
  select * from (values
    ('kleinwagen','Kleinwagen (elektrisch)',1800),
    ('kombi','Kombi (elektrisch)',3200),
    ('transporter','Transporter (elektrisch)',5400)
  ) as m(model_code,model_label,price_credits) where m.model_code = p_code
$$;

create or replace function public.vehicle_service(
  p_profile_id uuid,
  p_request_id uuid,
  p_service_kind text,
  p_model_code text,
  p_tick bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_vehicle public.player_vehicles%rowtype;
  v_done public.player_vehicle_services%rowtype;
  v_location uuid;
  v_seller uuid;
  v_price integer;
  v_tax_rate numeric;
  v_tax integer;
  v_net integer;
  v_label text;
  v_ref text;
begin
  if p_profile_id is null or p_request_id is null or p_service_kind is null or p_tick is null then
    raise exception 'NOXIA_VEHICLE_REQUIRED_ARGUMENT_MISSING';
  end if;

  select credits into v_credits from public.profiles where id=p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;

  select * into v_done from public.player_vehicle_services where request_id=p_request_id;
  if found then
    if v_done.profile_id <> p_profile_id then raise exception 'NOXIA_VEHICLE_REQUEST_CONFLICT'; end if;
    select * into v_vehicle from public.player_vehicles where profile_id=p_profile_id and active limit 1;
    return jsonb_build_object('ok',true,'duplicate',true,'credits',v_credits,'price_credits',v_done.price_credits,'vehicle',to_jsonb(v_vehicle));
  end if;

  select id into v_location from public.locations where slug='earth' limit 1;
  if v_location is null then raise exception 'NOXIA_EARTH_LOCATION_MISSING'; end if;
  select actor_id into v_seller from public.location_public_actors where location_id=v_location limit 1;

  select * into v_vehicle from public.player_vehicles where profile_id=p_profile_id and active limit 1 for update;

  if p_service_kind='buy' then
    if found then raise exception 'NOXIA_VEHICLE_ALREADY_OWNED'; end if;
    select price_credits, model_label into v_price, v_label from public.vehicle_model(p_model_code);
    if v_price is null then raise exception 'NOXIA_VEHICLE_MODEL_UNKNOWN'; end if;
  elsif p_service_kind='repair' then
    if not found then raise exception 'NOXIA_VEHICLE_NONE'; end if;
    -- Reparatur kostet je fehlendem Prozentpunkt; ein neuwertiges Auto kostet nichts.
    v_price := (100 - v_vehicle.condition_pct) * 6;
    v_label := 'Reparatur';
  elsif p_service_kind='charge' then
    if not found then raise exception 'NOXIA_VEHICLE_NONE'; end if;
    v_price := (100 - v_vehicle.charge_pct);
    v_label := 'Laden';
  else
    raise exception 'NOXIA_VEHICLE_SERVICE_UNKNOWN';
  end if;

  if v_credits < v_price then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  select least(1,greatest(0,coalesce(cs.tax_transaction,0))) into v_tax_rate from public.colony_settings cs where cs.location_id=v_location;
  v_tax_rate := coalesce(v_tax_rate,0);
  v_tax := least(v_price, greatest(0, round(v_price*v_tax_rate)::integer));
  v_net := v_price - v_tax;

  if p_service_kind='buy' then
    insert into public.player_vehicles(profile_id,model_code,model_label) values (p_profile_id,p_model_code,v_label) returning * into v_vehicle;
  elsif p_service_kind='repair' then
    update public.player_vehicles set condition_pct=100, updated_at=now() where id=v_vehicle.id returning * into v_vehicle;
  else
    update public.player_vehicles set charge_pct=100, updated_at=now() where id=v_vehicle.id returning * into v_vehicle;
  end if;

  insert into public.player_vehicle_services(request_id,profile_id,vehicle_id,service_kind,price_credits,transaction_tax_credits,seller_actor_id,tick)
  values (p_request_id,p_profile_id,v_vehicle.id,p_service_kind,v_price,v_tax,v_seller,p_tick) returning * into v_done;
  v_ref := 'vehicle_service:' || v_done.id::text;

  if v_price > 0 then
    update public.profiles set credits = credits - v_price where id=p_profile_id;
    if v_net > 0 and v_seller is not null then
      insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
      values (v_seller,p_tick,'income',0,v_net,v_location,v_ref,'Fahrzeug: ' || v_label);
    end if;
    if v_tax > 0 then
      insert into public.colony_ledger(location_id,tick,entry_type,profile_id,resource_type,amount,note)
      values (v_location,p_tick,'tax_transaction',p_profile_id,null,v_tax,'Konsumsteuer (' || v_ref || ')');
    end if;
  end if;

  return jsonb_build_object('ok',true,'duplicate',false,'service',p_service_kind,'label',v_label,'price_credits',v_price,'tax_credits',v_tax,'credits',v_credits - v_price,'vehicle',to_jsonb(v_vehicle));
end;
$$;

-- Fahrt: Akku sinkt mit der Strecke (1 % je 2 km), Zustand langsam (1 % je 25 km). Keine Buchung.
create or replace function public.vehicle_drive(p_profile_id uuid, p_distance_m bigint, p_lat double precision, p_lon double precision)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.player_vehicles%rowtype;
  v_charge_cost integer;
  v_wear integer;
begin
  select * into v_vehicle from public.player_vehicles where profile_id=p_profile_id and active limit 1 for update;
  if not found then raise exception 'NOXIA_VEHICLE_NONE'; end if;
  if v_vehicle.condition_pct < 15 then raise exception 'NOXIA_VEHICLE_BROKEN'; end if;
  v_charge_cost := ceil(p_distance_m / 2000.0)::integer;
  if v_vehicle.charge_pct < v_charge_cost then raise exception 'NOXIA_VEHICLE_CHARGE_LOW'; end if;
  v_wear := floor((v_vehicle.odometer_m + p_distance_m) / 25000.0)::integer - floor(v_vehicle.odometer_m / 25000.0)::integer;
  update public.player_vehicles
    set charge_pct = charge_pct - v_charge_cost,
        condition_pct = greatest(0, condition_pct - v_wear),
        odometer_m = odometer_m + p_distance_m,
        latitude_deg = p_lat, longitude_deg = p_lon, updated_at = now()
    where id=v_vehicle.id returning * into v_vehicle;
  return jsonb_build_object('ok',true,'vehicle',to_jsonb(v_vehicle),'charge_cost',v_charge_cost,'wear',v_wear);
end;
$$;

revoke all on function public.vehicle_service(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.vehicle_service(uuid,uuid,text,text,bigint) to service_role;
revoke all on function public.vehicle_drive(uuid,bigint,double precision,double precision) from public,anon,authenticated;
grant execute on function public.vehicle_drive(uuid,bigint,double precision,double precision) to service_role;

commit;
