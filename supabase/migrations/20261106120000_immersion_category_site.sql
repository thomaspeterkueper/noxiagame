-- 20261106120000_immersion_category_site.sql
-- Erlebnis-Studio: neue Kategorie „site“ (begehbarer Ort der Gegenwart, z. B. die Grabung Dvārakā).
-- Rücknahme: Constraint wieder auf ('chronotrip','game','abstract') setzen (vorher offene site-Sitzungen beenden).
set search_path to public;
alter table public.immersion_sessions drop constraint if exists immersion_sessions_category_check;
alter table public.immersion_sessions add constraint immersion_sessions_category_check check (category in ('chronotrip', 'site', 'game', 'abstract'));
