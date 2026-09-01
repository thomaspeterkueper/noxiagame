-- supabase/migrations/20260901134500_modular_facilities_rls.sql
-- RLS für die modularen Anlagen-Tabellen.

ALTER TABLE public.facility_module_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facility_module_definitions_read" ON public.facility_module_definitions;
CREATE POLICY "facility_module_definitions_read"
  ON public.facility_module_definitions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "facility_instances_read" ON public.facility_instances;
CREATE POLICY "facility_instances_read"
  ON public.facility_instances FOR SELECT
  TO authenticated
  USING (public_access = true OR owner_id = auth.uid() OR operator_id = auth.uid());

DROP POLICY IF EXISTS "facility_modules_read" ON public.facility_modules;
CREATE POLICY "facility_modules_read"
  ON public.facility_modules FOR SELECT
  TO authenticated
  USING (
    public_access = true
    OR occupant_id = auth.uid()
    OR operator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.facility_instances fi
      WHERE fi.id = facility_modules.facility_id
        AND (fi.public_access = true OR fi.owner_id = auth.uid() OR fi.operator_id = auth.uid())
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.facility_module_definitions, public.facility_instances, public.facility_modules
  FROM authenticated;
GRANT SELECT ON public.facility_module_definitions, public.facility_instances, public.facility_modules TO authenticated;
GRANT ALL ON public.facility_module_definitions, public.facility_instances, public.facility_modules TO service_role;
