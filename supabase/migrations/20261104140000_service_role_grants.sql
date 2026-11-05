-- 20261104140000_service_role_grants.sql
-- Fix 04.11.2026: „Buchung fehlgeschlagen“ im Reisebüro.
-- Ursache: Die Server-Wege sprechen die Datenbank als service_role an. Neue Tabellen
-- und Funktionen bekamen in diesem Projekt keine Rechte für service_role (keine
-- Standardrechte). Bei Funktionen hat ein `revoke … from public` das allgemeine
-- Ausführungsrecht entzogen, über das service_role sie sonst nutzt.
-- Betroffen waren u. a.:
--   * das Reisebüro (earth_trips, noxia_book_earth_trip, noxia_arrive_earth_trip);
--   * bezahlte Schichten (player_shifts, noxia_*_player_shift*);
--   * echte Lokale (noxia_real_venue).
-- Hier: Rechte für service_role nachtragen und als Standard für neue Objekte setzen.
-- anon und authenticated bekommen nichts.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
