-- "Kein eigenes Schiff" wird ein eigenstaendiger, dauerhafter Spielweg
-- (Spielerentscheidung 03.10.2026) -- wie Handel ohne eigenes Flugzeug: man
-- nutzt einen Transporteur und verdient dafuer weniger, statt besitzen zu
-- muessen. Neue Profile sollen deshalb NICHT mehr automatisch ein Schiff
-- bekommen; der Startort liegt stattdessen auf profiles.current_location
-- (siehe app/api/game/profile/route.ts, action=setup).
--
-- Der Trigger on_profile_created -> handle_new_profile() legte bisher bei
-- JEDER neuen Zeile in public.profiles automatisch ein Schiff an
-- (urspruenglich: Startort 'moon', siehe supabase/migrations/_archive/
-- 001b_noxia_rls.sql). Dieser Trigger wird hier entfernt.
--
-- WICHTIG -- noch NICHT sicher fuer main: noxia_spot_trade() (SQL) wirft
-- aktuell NOXIA_SHIP_NOT_FOUND fuer Profile ohne Schiff. Handel ist fuer
-- schifflose Spieler also erst spielbar, sobald die Spediteur/Transport-
-- schicht-Mechanik (naechster Schritt) steht. Bis dahin: neue Spieler haben
-- kein Schiff, koennen aber noch nicht handeln.
--
-- Die Funktion handle_new_profile() selbst bleibt bestehen (nur der Trigger
-- wird entfernt) -- so ist die Aenderung mit einem einzigen CREATE TRIGGER
-- reversibel, falls doch wieder ein automatisches Startschiff gewuenscht ist.

set search_path to public;

-- profiles.current_location existierte noch nicht, obwohl app/api/game/
-- missions/route.ts und app/api/game/journeys/route.ts es bereits lesen
-- (voraussichtlich vorbereitet fuer genau diesen schifflosen Pfad, aber nie
-- nachgezogen) -- ohne diese Spalte wuerden die SELECTs dort fehlschlagen.
alter table profiles
  add column if not exists current_location text not null default 'earth';

comment on column profiles.current_location is 'Aktueller Standort des Spielers, unabhaengig von einem Schiff (slug, z.B. earth, moon, mars). Massgeblich fuer schifflose Spieler; ein Schiff, falls vorhanden, kann einen eigenen (abweichenden) location-Wert tragen.';

drop trigger if exists on_profile_created on public.profiles;
