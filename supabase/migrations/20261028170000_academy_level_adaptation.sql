-- R-17 (Erdkarte): Einstiegsquiz – Ergebnis je Fachgebiet speichern, Akademie-Stufe
-- passt sich an (Thomas, 27.10.2026: „Ja mache das“; 28.10.2026: „bitte requests umsetzen“).
--
--   * onboarding_quiz_attempts.domain_scores: richtig/gesamt je Fachgebiet, nicht die
--     einzelnen Antworten.
--   * academy_task_results: ein Eintrag je beantworteter Akademie-Aufgabe (Stufe,
--     richtig, Thema). Die Regel für die Stufe steht in lib/knowledge/academyLevel.ts.
--   Diagnostisch: keine Freischaltungen, kein Alter.

set search_path to public;

alter table public.onboarding_quiz_attempts
  add column if not exists domain_scores jsonb;

create table if not exists public.academy_task_results (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  level      smallint not null check (level between 1 and 6),
  correct    boolean not null,
  topic      text,
  created_at timestamptz not null default now()
);
create index if not exists academy_task_results_profile_idx on public.academy_task_results (profile_id, created_at desc);

alter table public.academy_task_results enable row level security;
revoke all on public.academy_task_results from anon, authenticated;
