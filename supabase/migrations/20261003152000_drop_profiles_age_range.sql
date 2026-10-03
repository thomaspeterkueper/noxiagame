-- Entfernt profiles.age_range: die Altersspannen-Abfrage im Onboarding-Quiz
-- wurde aus Datenschutzgruenden gestrichen (Code bereits in 4cf6c26 entfernt).
-- Die Spalte ist live leer (0 befuellte Zeilen). profiles.knowledge_level bleibt.

set search_path to public;

alter table profiles
  drop column if exists age_range;
