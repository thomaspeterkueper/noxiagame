-- Sicherheitsberater (function_search_path_mutable): feste search_path für die Kompetenzformeln.
alter function public.noxia_skill_level(numeric) set search_path = public;
alter function public.noxia_skill_experience_for_level(numeric) set search_path = public;
alter function public.noxia_skill_decayed_level(numeric, numeric, bigint, bigint) set search_path = public;
