-- Gold als seltener geologischer Rohstoff fuer die spaetere NOXIA-/chi-Technologiekette.
-- Niedrige Basisgewichte: Ohne reale Fund-Evidenz bleibt Gold selten; MRDS AU/GOLD
-- darf lokal ueber den derive-resources-Pfad deutlich boosten.

insert into public.geology_resource_affinity (lithology_class, resource_type, base_weight) values
  ('mt','gold',0.08),
  ('vi','gold',0.06),
  ('pi','gold',0.05),
  ('pa','gold',0.04),
  ('vb','gold',0.03)
on conflict (lithology_class, resource_type)
do update set base_weight = excluded.base_weight;
