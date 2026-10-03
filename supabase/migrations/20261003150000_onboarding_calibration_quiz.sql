-- Onboarding-Kalibrierungsquiz: 6-7 von Claude generierte, fachlich
-- gemischte Allgemeinwissensfragen direkt nach der Registrierung
-- (WelcomeSetup.tsx), um die Akademie-Schwierigkeitsstufe
-- (app/api/game/school/route.ts's DIFFICULTY 1-6) individuell zu
-- kalibrieren statt sie fuer jeden Spieler fest auf 1 zu lassen
-- (SchoolOverlay.tsx generateTask() schickte bisher immer level: '1').
--
-- Bewusst getrennt vom Wissens-/Unlock-Graphen (lib/knowledge/unlockRegistry.ts):
-- das hier beeinflusst nur den Schwierigkeitsgrad spaeterer Akademie-Aufgaben,
-- nicht welche UNL:NOX:*-Knoten ein Spieler freischalten kann.

set search_path to public;

alter table profiles
  add column if not exists knowledge_level smallint,
  add column if not exists age_range text;

comment on column profiles.knowledge_level is 'Kalibrierte Akademie-Einstiegsstufe 1-6 aus dem Onboarding-Quiz; NULL = nicht kalibriert (Fallback: Stufe 1).';
comment on column profiles.age_range is 'Selbst gewaehlte, grobe Altersspanne aus dem Onboarding-Quiz (z.B. "16-18"); optional, keine exakten Geburtsdaten.';

-- Ein Versuch pro Aufruf des Quiz: die generierten Fragen samt richtiger
-- Antwort liegen serverseitig, damit der Client beim GET nur die Fragen
-- ohne Loesung bekommt und die Auswertung beim POST nicht clientseitig
-- faelschbar ist.
create table if not exists onboarding_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  score smallint,
  derived_level smallint
);

create index if not exists onboarding_quiz_attempts_profile_idx
  on onboarding_quiz_attempts(profile_id);
