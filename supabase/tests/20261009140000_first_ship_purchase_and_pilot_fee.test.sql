-- supabase/tests/20261009140000_first_ship_purchase_and_pilot_fee.test.sql
-- Erstellt: 09.10.2026
--
-- Funktionstest zur Migration 20261009140000 (Erstkauf, Ladungsuebernahme,
-- Pilotenhonorar, fehlgeschlagene Zahlungen).
--
-- DER BLOCK ENDET IMMER MIT EINEM FEHLER – das ist beabsichtigt:
--   ERROR: ROLLBACK_TESTRESULT { ... }
-- Die Ausnahme am Ende rollt saemtliche Aenderungen zurueck (ein DO-Block ist
-- eine einzige Anweisung und damit atomar). In der Datenbank bleibt nichts
-- zurueck. Das JSON in der Fehlermeldung ist das Testergebnis.
--
-- Testprofile: zwei bestehende Profile mit Schiff (P wird im Test voruebergehend
-- schifflos gemacht). Erwartungen stehen jeweils am Fall.

do $test$
declare
  p uuid := '50669d8a-3c52-4ed4-accd-f4c52001cef5';
  q uuid := '2bebaa83-1b2e-4217-8959-6953e863aa8c';
  r jsonb := '{}'::jsonb;
  v jsonb;
  v_ship uuid;
  v_before integer;
  v_after integer;
  v_qship uuid;
begin
  -- Vorbereitung: P wird schifflos, steht auf der Erde, hat Spediteur-Ladung.
  delete from public.ships where profile_id = p;
  delete from public.profile_cargo where profile_id = p;
  update public.profiles set current_location='earth', credits=20000, transit_destination=null where id = p;
  insert into public.profile_cargo(profile_id, resource, amount) values (p, 'water', 10), (p, 'metal', 4);

  -- F1: falscher Standort  -> erwartet NOXIA_SHIP_TYPE_WRONG_LOCATION:moon
  begin v := public.noxia_buy_ship_type(p, 'fast_courier'); r := r || jsonb_build_object('F1_wrong_location', 'KEIN FEHLER');
  exception when others then r := r || jsonb_build_object('F1_wrong_location', sqlerrm); end;

  update public.profiles set current_location='moon' where id = p;

  -- F2: Startschiff nicht kaeuflich  -> erwartet NOXIA_SHIP_TYPE_NOT_FOR_SALE:freighter_mk1
  begin v := public.noxia_buy_ship_type(p, 'freighter_mk1'); r := r || jsonb_build_object('F2_not_for_sale', 'KEIN FEHLER');
  exception when others then r := r || jsonb_build_object('F2_not_for_sale', sqlerrm); end;

  -- F3: zu wenig Guthaben  -> erwartet NOXIA_SHIP_PURCHASE_CREDITS_INSUFFICIENT,
  --     danach credits 7999, 0 Schiffe, 2 Ladungszeilen
  update public.profiles set credits=7999 where id = p;
  begin v := public.noxia_buy_ship_type(p, 'fast_courier'); r := r || jsonb_build_object('F3_insufficient', 'KEIN FEHLER');
  exception when others then r := r || jsonb_build_object('F3_insufficient', sqlerrm); end;
  r := r || jsonb_build_object('F3_state_unchanged', jsonb_build_object(
    'credits', (select credits from public.profiles where id=p),
    'ships', (select count(*) from public.ships where profile_id=p),
    'profile_cargo_rows', (select count(*) from public.profile_cargo where profile_id=p)));

  -- F4: waehrend Linienflug gesperrt  -> erwartet NOXIA_TRANSIT_SHIP_MUTATION_FORBIDDEN
  update public.profiles set credits=20000, transit_destination='earth' where id = p;
  begin v := public.noxia_buy_ship_type(p, 'fast_courier'); r := r || jsonb_build_object('F4_in_passenger_transit', 'KEIN FEHLER');
  exception when others then r := r || jsonb_build_object('F4_in_passenger_transit', sqlerrm); end;
  update public.profiles set transit_destination=null where id = p;

  -- T1: Erstkauf mit Ladungsuebernahme  -> erwartet first_ship true, credits 12000,
  --     Schiff auf dem Mond (cargo_max 60, aktiv, docked), ship_cargo {water:10, metal:4},
  --     0 Zeilen in profile_cargo, genau 1 Schiff
  v := public.noxia_buy_ship_type(p, 'fast_courier');
  v_ship := (v->>'ship_id')::uuid;
  r := r || jsonb_build_object('T1_first_purchase', jsonb_build_object(
    'result', v,
    'credits', (select credits from public.profiles where id=p),
    'active_ship_matches', (select active_ship_id = v_ship from public.profiles where id=p),
    'ship', (select jsonb_build_object('location',location,'cargo_max',cargo_max,'type',ship_type_id,'active',is_active,'status',status::text,'name',name) from public.ships where id=v_ship),
    'ship_count', (select count(*) from public.ships where profile_id=p),
    'ship_cargo', (select jsonb_object_agg(resource::text, amount) from public.ship_cargo where ship_id=v_ship),
    'profile_cargo_rows', (select count(*) from public.profile_cargo where profile_id=p)));

  -- T2: derselbe Typ noch einmal  -> erwartet NOXIA_SHIP_TYPE_ALREADY_OWNED (bestehender Pfad)
  begin v := public.noxia_buy_ship_type(p, 'fast_courier'); r := r || jsonb_build_object('T2_already_owned', 'KEIN FEHLER');
  exception when others then r := r || jsonb_build_object('T2_already_owned', sqlerrm); end;

  -- T3: Typwechsel  -> erwartet first_ship false, weiterhin genau 1 Schiff, dasselbe Schiff
  v := public.noxia_buy_ship_type(p, 'heavy_hauler');
  r := r || jsonb_build_object('T3_type_change', jsonb_build_object('first_ship', v->'first_ship', 'new_credits', v->'new_credits', 'ship_count', (select count(*) from public.ships where profile_id=p), 'same_ship', (v->>'ship_id')::uuid = v_ship));

  -- T4: Flug mit Pilotenhonorar 80  -> erwartet pilot_fee 80,
  --     credits_after = credits_before - 80 - landing_fee, Schiff im Transit,
  --     Energie 45, genau 1 Ledger-Zeile ueber 80
  insert into public.ship_cargo(ship_id, resource, amount) values (v_ship, 'energy', 50)
    on conflict (ship_id, resource) do update set amount = 50;
  select credits into v_before from public.profiles where id=p;
  v := public.noxia_start_transit_with_pilot(p, 'earth', 10, 5, 24, 80);
  select credits into v_after from public.profiles where id=p;
  r := r || jsonb_build_object('T4_pilot_fee', jsonb_build_object(
    'pilot_fee', v->'pilot_fee', 'landing_fee', v->'landing_fee', 'result_credits', v->'credits',
    'credits_before', v_before, 'credits_after', v_after, 'idempotent', v->'idempotent',
    'ship_status', (select status::text from public.ships where id=v_ship),
    'energy_left', (select amount from public.ship_cargo where ship_id=v_ship and resource='energy'),
    'ledger', (select jsonb_agg(jsonb_build_object('amount',amount,'type',entry_type,'note',note)) from public.colony_ledger where profile_id=p and note like 'Pilotenhonorar%')));

  -- T5: derselbe Start noch einmal  -> erwartet idempotent true, pilot_fee 0,
  --     Guthaben unveraendert, weiterhin 1 Ledger-Zeile
  v := public.noxia_start_transit_with_pilot(p, 'earth', 10, 5, 24, 80);
  r := r || jsonb_build_object('T5_idempotent', jsonb_build_object('pilot_fee', v->'pilot_fee', 'idempotent', v->'idempotent',
    'credits_after', (select credits from public.profiles where id=p),
    'ledger_rows', (select count(*) from public.colony_ledger where profile_id=p and note like 'Pilotenhonorar%')));

  -- T6: unbezahlbares Honorar  -> erwartet NOXIA_TRANSIT_PILOT_FEE_INSUFFICIENT,
  --     danach Guthaben unveraendert, Schiff docked, Energie 50, 0 Ledger-Zeilen
  select id into v_qship from public.ships where profile_id=q and coalesce(is_active,false) order by created_at limit 1;
  insert into public.ship_cargo(ship_id, resource, amount) values (v_qship, 'energy', 50)
    on conflict (ship_id, resource) do update set amount = 50;
  select credits into v_before from public.profiles where id=q;
  begin v := public.noxia_start_transit_with_pilot(q, 'moon', 10, 5, 24, 1000000); r := r || jsonb_build_object('T6_fee_unpayable', 'KEIN FEHLER');
  exception when others then r := r || jsonb_build_object('T6_fee_unpayable', sqlerrm); end;
  r := r || jsonb_build_object('T6_state_unchanged', jsonb_build_object(
    'credits_before', v_before, 'credits_after', (select credits from public.profiles where id=q),
    'ship_status', (select status::text from public.ships where id=v_qship),
    'energy', (select amount from public.ship_cargo where ship_id=v_qship and resource='energy'),
    'ledger_rows', (select count(*) from public.colony_ledger where profile_id=q and note like 'Pilotenhonorar%')));

  -- T7: Honorar 0  -> erwartet pilot_fee 0, Verhalten wie noxia_start_transit:
  --     credits_after = credits_before - landing_fee, Schiff im Transit, Energie 45
  v := public.noxia_start_transit_with_pilot(q, 'moon', 10, 5, 24, 0);
  r := r || jsonb_build_object('T7_no_fee', jsonb_build_object('pilot_fee', v->'pilot_fee', 'landing_fee', v->'landing_fee',
    'credits_after', (select credits from public.profiles where id=q), 'credits_before', v_before,
    'ship_status', (select status::text from public.ships where id=v_qship), 'energy_left', v->'energy_left'));

  raise exception 'ROLLBACK_TESTRESULT %', r::text;
end
$test$;
