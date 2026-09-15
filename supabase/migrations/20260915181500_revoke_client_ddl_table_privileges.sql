-- Client roles must never own bulk/DDL-adjacent privileges on gameplay tables.
-- RLS does not protect TRUNCATE, and normal PostgREST gameplay does not require
-- TRIGGER or REFERENCES privileges.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT quote_ident(n.nspname) AS schema_name, quote_ident(c.relname) AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %s.%s FROM anon, authenticated',
      r.schema_name,
      r.table_name
    );
  END LOOP;
END $$;
