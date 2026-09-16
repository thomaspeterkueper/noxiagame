-- Persist the resource affinities already applied to production on 2026-09-16.
-- Idempotent so production can safely replay this migration.

insert into public.geology_resource_affinity (lithology_class, resource_type, base_weight)
values
  ('ev', 'gypsum', 0.70),
  ('ev', 'lithium', 0.15),
  ('mt', 'lead', 0.15),
  ('mt', 'zinc', 0.20),
  ('pa', 'bauxite', 0.10),
  ('pa', 'lithium', 0.20),
  ('pb', 'cobalt', 0.30),
  ('pb', 'nickel', 0.50),
  ('pb', 'titanium', 0.30),
  ('pi', 'bauxite', 0.15),
  ('sc', 'lead', 0.25),
  ('sc', 'phosphate', 0.15),
  ('sc', 'zinc', 0.30),
  ('sm', 'phosphate', 0.10),
  ('su', 'bauxite', 0.15),
  ('su', 'titanium', 0.25),
  ('su', 'zirconium', 0.20),
  ('vb', 'bauxite', 0.15),
  ('vb', 'nickel', 0.20),
  ('vb', 'zinc', 0.20),
  ('vi', 'zinc', 0.25)
on conflict (lithology_class, resource_type)
do update set base_weight = excluded.base_weight;

-- The server-side derivation route reads this table via the service role.
grant select on public.geology_resource_affinity to service_role;
