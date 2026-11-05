-- 20261104170000_family_menu.sql
-- Familien im Lokal (04.11.2026, vorbereitend zu R-24): Kakao und Kinderteller.
insert into public.hospitality_menu (entity_id, item_code, label, price_credits, active) values
  ('cafe', 'cocoa', 'Kakao', 2, true),
  ('cafe', 'kids_meal', 'Kinderteller', 5, true),
  ('restaurant', 'kids_meal', 'Kinderteller', 6, true)
on conflict do nothing;
