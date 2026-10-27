---
title: "Kompetenzen wachsen: Übungen, Spieler-Kompetenzen, Bescheinigungen, Schulpersonal"
source_area: core
target_area: core
status: open
priority: normal
created: 2026-10-27
claimed_by: null
depends_on: []
touches: [person_skills, person_assignments, role_wage_rates, noxia_taxed_purchase]
input_sha: 840755e
write_scope:
  - supabase/migrations/ (neue Dateien)
  - lib/game/skills/ (neu)
  - app/api/game/school/ 
  - lib/game/population/
read_scope:
  - docs/decisions/NOXIA-SCHOOL-0001-grundschule-als-lernort.md
  - docs/decisions/NOXIA-LIVING-0001-living-population-v0.1.md
  - docs/decisions/NOXIA-LIVING-0010-housing-and-job-market.md
  - docs/decisions/NOXIA-LIVING-0012-hunger-and-thirst.md
risk_class: migration
max_commits: 15
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

1. **Kompetenz-Schreibweg:** eine Funktion `gain_skill_experience(subject, skill_code, amount, source)` für Personen (`person_skills`) und – nach Thomas' Entscheidung – Spieler (`profile_skills`, gleiches Schema). Stufe folgt aus Erfahrung mit abnehmendem Zuwachs; langsames Verblassen bis zu einem Sockel.
2. **Übungsmodell:** Übungsrezept als Daten (`practice_recipes`: skill_code, Raum-Capability, Material-Güter, Ergebnis-Güter, Dauer in Spielminuten, Mindeststufe, Lehrkraft nötig). `start_practice`/`complete_practice` verbrauchen Güter aus dem Schulvorrat, erzeugen Ergebnis-Güter, schreiben Erfahrung; Misslingen abhängig von der Stufe.
3. **Bescheinigungen:** `skill_certificates` (Aussteller-Akteur, Inhaber, skill_code, Stufe, Datum); `employerDecision` darf sie lesen.
4. **Schulpersonal und Öffnung:** `educator`-Stellen am öffentlichen Akteur je Schulgebäude, Besetzung analog `run_venue_staffing`; Schulzeiten nach Ortszeit.
5. **Learning by Doing:** Arbeit am Arbeitsplatz gibt Erfahrung auf die Kompetenz der Rolle.
6. **Finanzierung je Lernendem:** Pauschale pro Spieltag je aktiv Lernendem vom öffentlichen Akteur (Erde: Ort, sonst Kolonie) an die Schule. Unterschreitet die Zahl der Lernenden eine Schwelle über einen Zeitraum: erst Personal abbauen, dann Schule schließen; Wiederöffnung, wenn wieder gelernt wird.
7. **Anleiten durch Kompetenz:** Eine Übung, die eine Lehrkraft braucht, darf auch jede anwesende Person (Spieler oder NPC) mit Kompetenz über einer Schwelle anleiten. Anleiten gibt der anleitenden Person selbst etwas Erfahrung.
8. **Spieler-Kompetenzen:** `profile_skills`, gleiches Schema wie `person_skills` (entschieden).
9. **Kinder:** Schule als Tagesziel für Kinder-NPCs im Tagesrhythmus.

## Abgrenzung

Keine Inhalte (Module, Rezepttexte) definieren – nur Mechanik und Schema; fachliche Inhalte kommen aus KG/SSF. Keine Gebühren – Lernen ist immer kostenlos. Keine Geldschöpfung: Lohn und Material kommen aus der Pauschale je Lernendem vom öffentlichen Akteur.

## Akzeptanzkriterien

- [ ] Eine Übung im Forschungslauf verbraucht Güter, erzeugt Güter, erhöht eine Kompetenz – nachvollziehbar in `population_events`.
- [ ] Ohne Vorrat oder (wo nötig) ohne Lehrkraft lässt sich keine Übung starten; der Grund wird zurückgegeben.
- [ ] Bestehende Seeds von `person_skills` bleiben gültig.
- [ ] Tests im selben Commit wie der Code.
