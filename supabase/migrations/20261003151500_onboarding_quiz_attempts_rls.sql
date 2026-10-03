-- onboarding_quiz_attempts: RLS aktivieren und service_role-Rechte nachziehen.
--
-- Die Tabelle (20261003150000_onboarding_calibration_quiz.sql) enthaelt pro
-- Versuch die generierten Fragen INKLUSIVE richtiger Antwort. Sie wird
-- ausschliesslich von app/api/game/onboarding-quiz/route.ts ueber den
-- service_role-Client gelesen und geschrieben.
--
-- 1) RLS aktivieren, bewusst OHNE Policies: anon/authenticated duerfen die
--    Tabelle nie direkt abfragen, sonst waeren die Loesungen auslesbar.
--    service_role umgeht RLS (rolbypassrls).
-- 2) Rechte explizit setzen. In diesem Projekt bekommen neue Tabellen keine
--    automatischen Grants (vgl. grant_service_role_* Migrationen), die Tabelle
--    gehoerte bisher nur postgres -- die API-Route scheiterte deshalb mit
--    "permission denied". Daher service_role-Grant hier nachgezogen und
--    Client-Rollen explizit entzogen.
--
-- Idempotent: mehrfaches Ausfuehren aendert nichts.

set search_path to public;

alter table onboarding_quiz_attempts enable row level security;

revoke all on onboarding_quiz_attempts from anon, authenticated;
grant all on onboarding_quiz_attempts to service_role;
