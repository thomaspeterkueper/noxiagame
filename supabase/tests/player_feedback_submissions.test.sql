-- Read-only metadata assertions AFTER applying 20261031080000 in an isolated
-- Supabase test database. Not run against production. This is NOT a substitute
-- for two-user JWT/RLS integration tests or a reviewed moderation API.
do $feedback_test$
declare
  t oid := to_regclass('public.player_feedback_submissions');
begin
  if t is null then raise exception 'NOXIA_FEEDBACK_TABLE_MISSING'; end if;

  if not exists (select 1 from pg_class where oid = t and relrowsecurity) then
    raise exception 'NOXIA_FEEDBACK_RLS_DISABLED';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public'
        and tablename = 'player_feedback_submissions') <> 1 then
    raise exception 'NOXIA_FEEDBACK_UNEXPECTED_POLICY_COUNT';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_feedback_submissions'
      and policyname = 'player_feedback_owner_receipts_select'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
      and qual like '%owner_user_id%'
      and qual like '%auth.uid()%'
  ) then
    raise exception 'NOXIA_FEEDBACK_OWNER_POLICY_MISSING';
  end if;

  if has_table_privilege('anon', t, 'SELECT')
     or has_table_privilege('anon', t, 'INSERT')
     or has_table_privilege('authenticated', t, 'INSERT')
     or has_table_privilege('authenticated', t, 'UPDATE')
     or has_table_privilege('authenticated', t, 'DELETE') then
    raise exception 'NOXIA_FEEDBACK_CLIENT_WRITE_OR_ANON_READ_GRANT';
  end if;

  if not has_column_privilege('authenticated', t, 'id', 'SELECT')
     or not has_column_privilege('authenticated', t, 'title', 'SELECT')
     or not has_column_privilege('authenticated', t, 'status', 'SELECT')
     or not has_column_privilege('authenticated', t, 'created_at', 'SELECT') then
    raise exception 'NOXIA_FEEDBACK_RECEIPT_COLUMNS_NOT_READABLE';
  end if;

  if has_column_privilege('authenticated', t, 'private_source_ref', 'SELECT')
     or has_column_privilege('authenticated', t, 'description', 'SELECT')
     or has_column_privilege('authenticated', t, 'owner_user_id', 'SELECT')
     or has_column_privilege('authenticated', t, 'payload_fingerprint', 'SELECT') then
    raise exception 'NOXIA_FEEDBACK_PRIVATE_COLUMN_EXPOSED';
  end if;

  if not has_table_privilege('service_role', t, 'INSERT') then
    raise exception 'NOXIA_FEEDBACK_SERVICE_INSERT_NOT_GRANTED';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = t and conname = 'player_feedback_owner_idempotency_unique' and contype = 'u'
  ) then
    raise exception 'NOXIA_FEEDBACK_OWNER_IDEMPOTENCY_MISSING';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = t and conname = 'player_feedback_source_ref_consistency' and contype = 'c'
  ) then
    raise exception 'NOXIA_FEEDBACK_SOURCE_CHECK_MISSING';
  end if;

  -- PostgreSQL CHECK constraints accept UNKNOWN: a conversation source with
  -- NULL private_source_ref must be explicitly forbidden, not just regex-tested.
  if not exists (
    select 1 from pg_constraint
    where conrelid = t and conname = 'player_feedback_source_ref_consistency'
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%private_source_ref IS NOT NULL%'
  ) then
    raise exception 'NOXIA_FEEDBACK_CONVERSATION_SOURCE_NONNULL_MISSING';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = t
      and tgname = 'player_feedback_insert_rate_guard'
      and tgenabled = 'O'
      and not tgisinternal
  ) then
    raise exception 'NOXIA_FEEDBACK_ATOMIC_RATE_TRIGGER_MISSING';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = 'public.enforce_player_feedback_insert_rate()'::regprocedure
      and prosecdef
      and 'search_path=' = any(proconfig)
  ) then
    raise exception 'NOXIA_FEEDBACK_RATE_FUNCTION_NOT_HARDENED';
  end if;

  if has_function_privilege(
    'authenticated', 'public.enforce_player_feedback_insert_rate()'::regprocedure, 'EXECUTE'
  ) then
    raise exception 'NOXIA_FEEDBACK_RATE_FUNCTION_PUBLICLY_EXECUTABLE';
  end if;

  raise notice 'NOXIA_FEEDBACK_RLS_METADATA_OK';
end $feedback_test$;
