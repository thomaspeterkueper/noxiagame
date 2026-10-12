-- 20261012130000_npc_shipments_grant_and_carrier.sql
-- Erstellt: 12.10.2026
-- Version:  1.0.0
--
-- Bereits in Produktion ausgeführt am 12.10.2026 (nachgetragen, damit Repo und DB übereinstimmen).
-- 1) Der Server durfte npc_shipments nicht lesen (42501) – die Handelsfirma lief deshalb drei Ticks leer.
-- 2) Erste Spedition als Empfänger der Fracht.

grant select, insert on public.npc_shipments to service_role;

insert into public.actors (kind, display_name, decision_weights)
select 'npc_firm', 'Epona Fracht', '{"role":"carrier"}'::jsonb
where not exists (select 1 from public.actors where decision_weights->>'role' = 'carrier');
