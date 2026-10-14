-- Hotel: baubare Gebäudeart mit Gästezimmern, Zimmer als Posten der Karte,
-- Belegungsprüfung im Server (Teilprojekt Gastronomie, 14.10.2026; R-7).
--   * building_definitions: hotel, Stufe 2, 3 600 Credits, 3 Ticks.
--   * Neue Hotels bekommen 6 Gästeplätze (transient_capacity), wenn nichts gesetzt ist.
--   * hospitality_menu: hotel / room_night, 40 Credits je Nacht.
--   * Eine Nacht ist eine Buchung je Gast je 24 Stunden Echtzeit (Platzhalter,
--     bis Koloniezeit und Spielzeit verknüpft sind); belegte Zimmer zählen
--     gegen transient_capacity. Geprüft vor dem Einfügen in player_hospitality_orders,
--     damit order_hospitality_item unverändert bleibt und nichts bucht, wenn
--     kein Zimmer frei ist.
set search_path to public;

begin;

insert into public.building_definitions(
  key,name,description,tier,category,is_active,production,sort_order,consumption,
  cost_credits,build_time_ticks,population_bonus,allowed_locations
) values (
  'hotel','Hotel','Lobby mit Empfang, Gästezimmer im Obergeschoss. Reisende mieten ein Zimmer für eine Nacht.',2,'life',true,'[]'::jsonb,71,'[]'::jsonb,
  3600,3,0,null
) on conflict (key) do update set is_active=true, cost_credits=excluded.cost_credits, build_time_ticks=excluded.build_time_ticks, tier=excluded.tier, description=excluded.description;

insert into public.hospitality_menu(entity_id,item_code,label,price_credits) values
  ('hotel','room_night','Zimmer für eine Nacht',40)
on conflict (entity_id,item_code) do nothing;

create or replace function public.hotel_default_rooms() returns trigger
language plpgsql as $$
begin
  if new.entity_type='building' and new.entity_id='hotel' and coalesce(new.transient_capacity,0)=0 then
    new.transient_capacity := 6;
  end if;
  return new;
end $$;
drop trigger if exists trg_hotel_default_rooms on public.tile_entities;
create trigger trg_hotel_default_rooms before insert on public.tile_entities
  for each row execute function public.hotel_default_rooms();

create or replace function public.check_room_booking() returns trigger
language plpgsql as $$
declare
  v_capacity integer;
  v_taken integer;
begin
  if new.item_code <> 'room_night' then return new; end if;
  select coalesce(transient_capacity,0) into v_capacity from public.tile_entities where id=new.tile_entity_id;
  if v_capacity <= 0 then raise exception 'NOXIA_ROOM_NONE_HERE'; end if;
  if exists (
    select 1 from public.player_hospitality_orders o
    where o.tile_entity_id=new.tile_entity_id and o.item_code='room_night'
      and o.profile_id=new.profile_id and o.created_at > now() - interval '24 hours'
  ) then raise exception 'NOXIA_ROOM_ALREADY_BOOKED'; end if;
  select count(distinct o.profile_id) into v_taken from public.player_hospitality_orders o
  where o.tile_entity_id=new.tile_entity_id and o.item_code='room_night'
    and o.created_at > now() - interval '24 hours';
  if v_taken >= v_capacity then raise exception 'NOXIA_ROOM_NONE_FREE'; end if;
  return new;
end $$;
drop trigger if exists trg_check_room_booking on public.player_hospitality_orders;
create trigger trg_check_room_booking before insert on public.player_hospitality_orders
  for each row execute function public.check_room_booking();

commit;
