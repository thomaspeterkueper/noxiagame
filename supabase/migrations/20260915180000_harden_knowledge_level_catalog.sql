-- knowledge_levels is static gameplay reference data: authenticated-read-only.
ALTER TABLE public.knowledge_levels ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.knowledge_levels FROM anon, authenticated;
GRANT SELECT ON TABLE public.knowledge_levels TO authenticated;

DROP POLICY IF EXISTS knowledge_levels_select_authenticated ON public.knowledge_levels;
CREATE POLICY knowledge_levels_select_authenticated
  ON public.knowledge_levels
  FOR SELECT
  TO authenticated
  USING (true);
