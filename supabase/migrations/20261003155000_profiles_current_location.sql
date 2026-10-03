-- profiles.current_location: Standort des Spielers, unabhaengig von einem Schiff.
-- Live bereits angelegt (add_current_location_column); hier nur nachgezogen,
-- damit die Folge-Migrationen (carrier_trade_without_ship, player_home_location)
-- aus dem Repo reproduzierbar sind. Bewusst OHNE den DROP TRIGGER aus
-- 20261003160000 (der bleibt im Branch feat/no-auto-ship-step1).

set search_path to public;

alter table profiles
  add column if not exists current_location text not null default 'earth';

comment on column profiles.current_location is 'Aktueller Standort des Spielers, unabhaengig von einem Schiff (slug, z.B. earth, moon, mars).';
