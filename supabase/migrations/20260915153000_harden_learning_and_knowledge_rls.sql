-- Harden learning and knowledge authorization.
-- Clients may read only their own progress/history; authoritative writes stay server-side.
--
-- Fresh-replay note: hosted production historically received the knowledge RPCs
-- outside the repository baseline. Therefore harden them here only when present;
-- the canonical current definitions are reconciled by a later migration.

alter table public.player_learning_progress enable row level security;

revoke all privileges on table public.player_learning_progress from anon, authenticated;
grant select on table public.player_learning_progress to authenticated;

drop policy if exists "player_learning_progress_select_own" on public.player_learning_progress;
create policy "player_learning_progress_select_own"
on public.player_learning_progress
for select
to authenticated
using ((select auth.uid()) = profile_id);

revoke all privileges on table public.knowledge_transactions from anon, authenticated;
grant select on table public.knowledge_transactions to authenticated;

drop policy if exists "Eigene Transaktionen lesen" on public.knowledge_transactions;
drop policy if exists "Service kann schreiben" on public.knowledge_transactions;
create policy "knowledge_transactions_select_own"
on public.knowledge_transactions
for select
to authenticated
using ((select auth.uid()) = profile_id);

revoke all privileges on table public.kurs_fortschritt from anon, authenticated;
grant select on table public.kurs_fortschritt to authenticated;

drop policy if exists "Eigener Fortschritt" on public.kurs_fortschritt;
drop policy if exists "Service schreibt" on public.kurs_fortschritt;
create policy "kurs_fortschritt_select_own"
on public.kurs_fortschritt
for select
to authenticated
using ((select auth.uid()) = profile_id);

-- Hosted production already had these RPCs when this migration originally ran.
-- A clean replay may not, because the old hosted rollout was not part of the
-- repository baseline. Do not make fresh schema construction depend on that
-- historical side effect.
do $hardening$
begin
  if to_regprocedure('public.award_knowledge(uuid,integer,text,text)') is not null then
    revoke execute on function public.award_knowledge(uuid, integer, text, text)
      from public, anon, authenticated;
    grant execute on function public.award_knowledge(uuid, integer, text, text)
      to service_role;
    alter function public.award_knowledge(uuid, integer, text, text)
      set search_path = public, pg_temp;
  end if;

  if to_regprocedure('public.get_knowledge_level(integer)') is not null then
    alter function public.get_knowledge_level(integer)
      set search_path = public, pg_temp;
  end if;
end
$hardening$;
