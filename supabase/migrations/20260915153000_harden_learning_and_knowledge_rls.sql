-- Harden learning and knowledge authorization.
-- Clients may read only their own progress/history; authoritative writes stay server-side.

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

-- This SECURITY DEFINER RPC changes authoritative knowledge state. It must not
-- be callable from public/authenticated clients.
revoke execute on function public.award_knowledge(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.award_knowledge(uuid, integer, text, text) to service_role;
alter function public.award_knowledge(uuid, integer, text, text)
  set search_path = public, pg_temp;

-- Keep the related read helper deterministic with an explicit search_path.
alter function public.get_knowledge_level(integer)
  set search_path = public, pg_temp;
