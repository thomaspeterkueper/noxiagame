-- NOXIA docking helper search-path hardening
-- 2026-09-15
--
-- These helpers are server-only and immutable. Pin their search_path explicitly
-- so the hosted Supabase database linter does not report mutable lookup context.

set search_path to public;

alter function public.noxia_canonical_station_slug(text)
  set search_path = public;

alter function public.noxia_docking_compatible(text,text)
  set search_path = public;
