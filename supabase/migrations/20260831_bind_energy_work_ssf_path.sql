-- 2026-08-31
-- Kanonische KG-Rueckgabe fuer Energie & Arbeit / Gravitationsbrunnen:
-- module PHY-L2-000005
-- legacy LRN:SSF:PHY-ENERGIE-ARBEIT-0001
-- path   PATH:SSF:PHY-ENERGIE-ARBEIT-0001
--
-- Die produktive lokale kurs_id ist nicht repository-kanonisch dokumentiert.
-- Daher wird der bestehende NOXIA-Kurs ueber seinen etablierten Titel gebunden,
-- ohne eine lokale kurs_id zu erfinden.

update public.foundation_kurse
set kg_path_id = 'PATH:SSF:PHY-ENERGIE-ARBEIT-0001'
where lower(trim(titel)) = lower('Energie & Arbeit')
  and (kg_path_id is null or kg_path_id <> 'PATH:SSF:PHY-ENERGIE-ARBEIT-0001');
