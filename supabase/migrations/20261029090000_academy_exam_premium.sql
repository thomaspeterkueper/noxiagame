-- Akademie: Prämie in Credits für bestandene Prüfungen, Abschluss nur mit Prüfung.
-- Entschieden (Thomas, 28.10.2026): „credits für erfolgreich bestandene Prüfungen, als
-- zusätzlichen Ansporn. Nur anschauen des lernmoduls bringt kein geld, man muss auch die
-- Prüfung bestehen sowohl für Prämie als auch für freischaltung.“
--
-- Bisher prüfte nur der Browser, ob 70 % der Fragen richtig waren; der Server schrieb
-- den Abschluss und die Freischaltungen ohne Nachweis. Neu bewertet der Server die
-- Antworten gegen die Prüfung der SSF (app/api/game/knowledge, complete_module).
--
-- Geld (NOXIA-FIN-0001): Die Prämie ist eine ausgewiesene Emission.
--   Emittent:     Solar Science Foundation (Bildungsprämie)
--   Ursache:      bestandene Modulprüfung
--   Obergrenze:   einmal je Spieler und Modul (Primärschlüssel), Betrag je Stufe
--                 L0 30 Cr, L1 60 Cr, L2 120 Cr (app/api/game/knowledge)
--   Audit:        academy_exam_premiums.ref = 'emission:academy_exam:<profil>:<modul>'
-- Jeder Versuch steht in academy_exam_attempts (auch die nicht bestandenen).

set search_path to public;

create table if not exists public.academy_exam_attempts (
  id          bigserial primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  module_id   text not null,
  correct     integer not null,
  total       integer not null,
  passed      boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists academy_exam_attempts_profile_module_idx
  on public.academy_exam_attempts(profile_id, module_id, created_at desc);

create table if not exists public.academy_exam_premiums (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  module_id   text not null,
  amount      integer not null check (amount > 0),
  ref         text not null unique,
  paid_at     timestamptz not null default now(),
  primary key (profile_id, module_id)
);

alter table public.academy_exam_attempts enable row level security;
alter table public.academy_exam_premiums enable row level security;
revoke all on public.academy_exam_attempts, public.academy_exam_premiums from anon, authenticated;
grant select, insert, update, delete on public.academy_exam_attempts, public.academy_exam_premiums to service_role;
grant usage, select on sequence public.academy_exam_attempts_id_seq to service_role;

-- Zahlt die Prämie höchstens einmal je Spieler und Modul. Gibt den gezahlten Betrag
-- zurück, 0 wenn sie schon gezahlt war.
create or replace function public.pay_academy_exam_premium(p_profile_id uuid, p_module_id text, p_amount integer)
returns integer
language plpgsql
security definer
set search_path to public
as $$
declare
  v_ref text := 'emission:academy_exam:' || p_profile_id::text || ':' || p_module_id;
  v_rows integer;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;
  insert into public.academy_exam_premiums(profile_id, module_id, amount, ref)
  values (p_profile_id, p_module_id, p_amount, v_ref)
  on conflict (profile_id, module_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return 0; end if;
  update public.profiles set credits = coalesce(credits, 0) + p_amount where id = p_profile_id;
  return p_amount;
end;
$$;

revoke all on function public.pay_academy_exam_premium(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.pay_academy_exam_premium(uuid, text, integer) to service_role;

-- Auswertung: Versuche und Prämien je Modul.
create or replace view public.academy_exam_stats as
select a.module_id,
       count(*)                                   as attempts,
       count(*) filter (where a.passed)           as passed,
       count(distinct a.profile_id)               as players,
       round(avg(a.correct::numeric / nullif(a.total, 0)) * 100, 1) as avg_percent,
       (select coalesce(sum(p.amount), 0) from public.academy_exam_premiums p where p.module_id = a.module_id) as premiums_paid
from public.academy_exam_attempts a
group by a.module_id;

revoke all on public.academy_exam_stats from anon, authenticated;
grant select on public.academy_exam_stats to service_role;
