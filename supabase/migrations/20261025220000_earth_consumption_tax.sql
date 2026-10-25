-- supabase/migrations/20261025220000_earth_consumption_tax.sql
-- Konsumsteuer auf der Erde: 19 % (Thomas, 25.10.2026). Startwert – die Politik
-- (Gouverneur, /api/game/admin setTaxRates, 0–50 %) kann ihn später ändern.
-- Wirkung: Bestellungen im Lokal, Käufe der Bewohner, Handel und Gebäudekäufe
-- führen den Anteil an die Koloniekasse ab; sync_employer_economy überweist ihn
-- als Fiskaltransfer an den öffentlichen Akteur der Erde (NOXIA-FIN-0001).
-- Wie bisher ist die Steuer im Preis enthalten (Anteil am gezahlten Preis).
-- Länder mit eigenen Sätzen: später, wenn die Erde nach Staaten aufgeteilt ist.

set search_path to public;

insert into public.colony_settings(location_id, tax_transaction, updated_at)
select id, 0.19, now() from public.locations where slug = 'earth'
on conflict (location_id) do update set tax_transaction = excluded.tax_transaction, updated_at = now();
