-- supabase/migrations/032_kg_path_id.sql
-- NOX-0008: kg_path_id auf foundation_kurse
-- Verbindet lokale Kurse mit kanonischen KG-Lernpfad-IDs
-- Erstellt: 11.07.2026

-- kg_path_id Spalte hinzufügen (nullable, idempotent)
ALTER TABLE public.foundation_kurse
  ADD COLUMN IF NOT EXISTS kg_path_id text;

-- Mapping: lokale kurs_id → kanonische PATH:SSF:* / PATH:NOXIA:* IDs
-- kurs_00_einheiten + kurs_01_prozentrechnung → Mathematische Grundlagen
UPDATE public.foundation_kurse
  SET kg_path_id = 'PATH:SSF:MAT-FOUNDATIONS-0001'
  WHERE kurs_id IN ('kurs_00_einheiten', 'kurs_01_prozentrechnung');

-- Kontrolle
SELECT kurs_id, titel, kg_path_id
FROM public.foundation_kurse
ORDER BY sort_order;
