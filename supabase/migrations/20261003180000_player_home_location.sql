-- Jeder Spieler hat einen Heimatort (profiles.home_location), getrennt von
-- profiles.current_location (wo man sich GERADE befindet). Der Heimatort
-- wird beim Onboarding festgelegt (= Startort, aktuell immer 'earth'), kann
-- aber spaeter geaendert werden -- dafuer muss man sich an der Verwaltung
-- (AdminOverlay.tsx / app/api/game/admin/route.ts) des NEUEN Ortes
-- registrieren lassen, waehrend man sich dort tatsaechlich aufhaelt
-- (current_location === Zielort).
--
-- Was der Heimatort spaeter bewirken soll (Steuerpflicht, Wahlrecht,
-- Startpunkt nach Reset o.ae.) ist bewusst noch nicht Teil dieses Patches --
-- hier geht es nur darum, den Wert ueberhaupt zu haben und aenderbar zu
-- machen.

set search_path to public;

alter table profiles
  add column if not exists home_location text not null default 'earth';

comment on column profiles.home_location is 'Heimatort des Spielers (slug). Wird beim Onboarding auf den Startort gesetzt; Aenderung nur ueber Registrierung an der Verwaltung des neuen Ortes (app/api/game/admin/route.ts, action=registerHome), waehrend man sich dort befindet.';
