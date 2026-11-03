-- NOXIA-SCHIFF-ZURUECKLASSEN-0001 (Thomas, 03.11.2026): Linienflug mit eigenem Schiff.
-- Das Schiff bleibt am Abflugort geparkt; der Spieler hat einen eigenen Ort.
--
-- profiles.aboard_ship_id = das Schiff, auf dem der Spieler gerade ist (null: nicht an Bord).
-- profiles.current_location ist ab jetzt immer der Ort des Spielers: an Bord folgt er dem Schiff
-- (Trigger), sonst setzen ihn Linienflüge bei der Ankunft.
-- Schiffsbefehle (Abflug, Spothandel, Handelsauftrag, Schiffskauf) gelten nur für das Schiff, auf
-- dem der Spieler ist; ohne Schiff am Ort gilt der Spediteur-Pfad (profile_cargo).

set search_path to public;

alter table public.profiles
  add column if not exists aboard_ship_id uuid references public.ships(id) on delete set null;

create or replace function public.noxia_aboard_ship_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select s.id from public.profiles p join public.ships s on s.id = p.aboard_ship_id and s.profile_id = p.id where p.id = p_profile_id
$function$;
revoke all on function public.noxia_aboard_ship_id(uuid) from public, anon, authenticated;
grant execute on function public.noxia_aboard_ship_id(uuid) to service_role;

-- Bestandsspieler: an Bord ihres aktiven (sonst ältesten) Schiffs; ihr Ort ist der des Schiffs.
update public.profiles p
set aboard_ship_id = (select s.id from public.ships s where s.profile_id = p.id order by coalesce(s.is_active, false) desc, s.created_at, s.id limit 1)
where p.aboard_ship_id is null and exists (select 1 from public.ships s where s.profile_id = p.id);
update public.profiles p set current_location = s.location from public.ships s where s.id = p.aboard_ship_id and p.current_location is distinct from s.location;

-- An Bord folgt der Spieler dem Schiff.
create or replace function public.noxia_sync_profile_location_from_ship()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.profiles set current_location = new.location where aboard_ship_id = new.id and current_location is distinct from new.location;
  return null;
end;
$function$;
drop trigger if exists trg_noxia_sync_profile_location_from_ship on public.ships;
create trigger trg_noxia_sync_profile_location_from_ship
  after update of location on public.ships
  for each row when (old.location is distinct from new.location)
  execute function public.noxia_sync_profile_location_from_ship();

-- Ein neu gekauftes (aktives) Schiff besteigt, wer gerade auf keinem ist.
create or replace function public.noxia_board_new_ship()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.profile_id is not null and coalesce(new.is_active, false)
     and not exists (select 1 from public.profiles where id = new.profile_id and aboard_ship_id is not null) then
    update public.profiles set aboard_ship_id = new.id, current_location = new.location where id = new.profile_id;
  end if;
  return null;
end;
$function$;
drop trigger if exists trg_noxia_board_new_ship on public.ships;
create trigger trg_noxia_board_new_ship after insert on public.ships for each row execute function public.noxia_board_new_ship();

-- An Bord gehen: nur am Ort des Schiffs, Schiff am Boden, Spieler nicht unterwegs.
create or replace function public.noxia_board_ship(p_profile_id uuid, p_ship_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile public.profiles%rowtype;
  v_ship public.ships%rowtype;
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_profile.transit_destination is not null and v_profile.transit_arrives_at > now() then
    raise exception 'NOXIA_TRANSIT_ALREADY_ACTIVE:%', v_profile.transit_destination using errcode = 'P0001';
  end if;
  select * into v_ship from public.ships
  where profile_id = p_profile_id and (p_ship_id is null or id = p_ship_id)
  order by (location = v_profile.current_location) desc, coalesce(is_active, false) desc, created_at, id
  limit 1 for update;
  if not found then raise exception 'NOXIA_SHIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_profile.aboard_ship_id = v_ship.id then
    return jsonb_build_object('ok', true, 'ship_id', v_ship.id, 'location', v_ship.location, 'already_aboard', true);
  end if;
  if v_ship.status = 'transit'::public.ship_status then raise exception 'NOXIA_SHIP_IN_TRANSIT' using errcode = 'P0001'; end if;
  if v_ship.location is distinct from v_profile.current_location then
    raise exception 'NOXIA_SHIP_NOT_HERE:%', v_ship.location using errcode = 'P0001';
  end if;
  update public.profiles set aboard_ship_id = v_ship.id where id = p_profile_id;
  return jsonb_build_object('ok', true, 'ship_id', v_ship.id, 'location', v_ship.location, 'already_aboard', false);
end;
$function$;
revoke all on function public.noxia_board_ship(uuid, uuid) from public, anon, authenticated;
grant execute on function public.noxia_board_ship(uuid, uuid) to service_role;

-- Schiffsbefehle: das Schiff ist das, auf dem der Spieler ist. Die Funktionen werden an den
-- Stellen umgeschrieben, an denen sie „das Schiff des Profils“ wählen; jede Ersetzung muss treffen.
do $patch$
declare
  v_def text;
  v_new text;
  v_item record;
  v_oid oid;
begin
  for v_item in
    select * from (values
      ('noxia_spot_trade',
       'select * into v_ship from public.ships where profile_id=p_profile_id and coalesce(is_active,false)=true order by created_at,id limit 1 for update;',
       'select * into v_ship from public.ships where id=public.noxia_aboard_ship_id(p_profile_id) order by created_at,id limit 1 for update;'),
      ('noxia_spot_trade',
       'select * into v_ship from public.ships where profile_id=p_profile_id order by created_at,id limit 1 for update;',
       'select * into v_ship from public.ships where id=public.noxia_aboard_ship_id(p_profile_id) order by created_at,id limit 1 for update;'),
      ('noxia_fulfill_trade_order',
       'select * into v_ship from public.ships where profile_id = p_profile_id and coalesce(is_active, false) = true order by created_at, id limit 1 for update;',
       'select * into v_ship from public.ships where id = public.noxia_aboard_ship_id(p_profile_id) order by created_at, id limit 1 for update;'),
      ('noxia_fulfill_trade_order',
       'select * into v_ship from public.ships where profile_id = p_profile_id order by created_at, id limit 1 for update;',
       'select * into v_ship from public.ships where id = public.noxia_aboard_ship_id(p_profile_id) order by created_at, id limit 1 for update;'),
      ('noxia_start_transit',
       'where profile_id = p_profile_id and coalesce(is_active, false) = true',
       'where id = public.noxia_aboard_ship_id(p_profile_id)'),
      ('noxia_start_transit',
       'select * into v_ship from public.ships where profile_id = p_profile_id order by created_at, id limit 1 for update;',
       'select * into v_ship from public.ships where id = public.noxia_aboard_ship_id(p_profile_id) order by created_at, id limit 1 for update;'),
      ('noxia_buy_ship_type',
       'select * into v_ship from public.ships where profile_id=p_profile_id and coalesce(is_active,false)=true order by created_at,id limit 1;',
       'select * into v_ship from public.ships where id=public.noxia_aboard_ship_id(p_profile_id) order by created_at,id limit 1;'),
      ('noxia_buy_ship_type',
       'select * into v_ship from public.ships where profile_id=p_profile_id order by created_at,id limit 1;',
       'select * into v_ship from public.ships where id=public.noxia_aboard_ship_id(p_profile_id) order by created_at,id limit 1;'),
      -- Linienflug: auch mit eigenem Schiff. Wer an Bord ist und das Schiff am Boden hat, geht von Bord.
      ('noxia_start_passenger_transit',
       E'select exists(select 1 from public.ships where profile_id=p_profile_id) into v_has_ship;\n  if v_has_ship then raise exception ''NOXIA_PASSENGER_HAS_SHIP'' using errcode=''P0001''; end if;',
       E'v_has_ship := public.noxia_aboard_ship_id(p_profile_id) is not null;\n  if v_has_ship and exists (select 1 from public.ships where id=public.noxia_aboard_ship_id(p_profile_id) and status=''transit''::public.ship_status) then raise exception ''NOXIA_TRANSIT_ALREADY_ACTIVE:ship'' using errcode=''P0001''; end if;'),
      ('noxia_start_passenger_transit',
       E'update public.profiles set\n    credits = v_new_credits,',
       E'update public.profiles set\n    aboard_ship_id = null,\n    credits = v_new_credits,')
    ) as t(fname, old_text, new_text)
  loop
    select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = v_item.fname;
    v_def := pg_get_functiondef(v_oid);
    if position(v_item.old_text in v_def) = 0 then
      raise exception 'NOXIA_PATCH_NOT_FOUND:%:%', v_item.fname, left(v_item.old_text, 60);
    end if;
    v_new := replace(v_def, v_item.old_text, v_item.new_text);
    execute v_new;
  end loop;
end
$patch$;
