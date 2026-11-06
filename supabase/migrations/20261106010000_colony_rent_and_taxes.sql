-- NOXIA-FIN-0002 Teil A2/A3 und Mietsteuer.
-- Entschieden (Thomas, 06.11.2026): „ja, auch auf Miete sollte es Steuern geben“ – Antwort
-- auf Frage 2 (Miete in staatlichen Wohnungen und Konsumsteuer in den Kolonien).
--
-- * Konsumsteuer 19 % wie auf der Erde für Mond, Mars, Phobos, Deimos (colony_settings.tax_transaction).
-- * Mietsteuer 10 % auf jede abgerechnete Miete, auch auf der Erde (colony_settings.rent_tax_rate).
--   Die Steuer bucht run_npc_rent_settlement als tax_rent in colony_ledger; sync_employer_economy
--   gibt sie als public_service_transfer an die öffentliche Kasse des Ortes (Transfer, kein neues Geld).
--   Bei staatlichen Vermietern fließt sie in dieselbe Kasse zurück; sie wirkt bei privaten Vermietern.
-- * Staatliche Habitate in den Kolonien werden vermietet: 200 Cr je 30 Tage an die öffentliche Kasse,
--   wie auf der Erde. Bisher wohnten dort alle kostenfrei (status 'provided'). Erste Miete nach einer
--   Woche Vorlauf. Wer nicht genug hat, zahlt in diesem Zyklus nicht (wie bisher bei Mieten).
-- Die kostenfreien Wohnungen auf der Erde bleiben, bis Thomas anders entscheidet.

set search_path to public;

update public.colony_settings cs
   set tax_transaction = 0.19, updated_at = now()
  from public.locations l
 where l.id = cs.location_id and l.slug in ('moon', 'mars', 'phobos', 'deimos')
   and coalesce(cs.tax_transaction, 0) = 0;

update public.colony_settings cs
   set rent_tax_rate = 0.10, updated_at = now()
  from public.locations l
 where l.id = cs.location_id and l.slug in ('earth', 'moon', 'mars', 'phobos', 'deimos')
   and coalesce(cs.rent_tax_rate, 0) = 0;

update public.person_tenancies t
   set origin = 'market', tenure = 'rented', status = 'active',
       rent_per_billing = 200, billing_interval_ticks = 720,
       next_due_tick = (select coalesce(max(tick_number), 0) from public.tick_log) + 168
  from public.locations l, public.location_public_actors lpa, public.tile_entities te
 where l.id = t.location_id and l.slug in ('moon', 'mars', 'phobos', 'deimos')
   and lpa.location_id = t.location_id and t.landlord_actor_id = lpa.actor_id
   and te.id = t.tile_entity_id and te.is_state_owned
   and t.status = 'provided';
