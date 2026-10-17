---
title: "Kurzer, eindeutiger Auftrag"
source_area: moon
target_area: core
status: open
priority: normal
created: 2026-09-10
claimed_by: null
depends_on: []
touches: []
# Nachweisfelder nach NOXIA-AGENT-INFRA-0001 (Pflicht für Agenten-Aufträge, für menschliche Aufträge empfohlen)
input_sha: null            # exakter Commit, von dem aus gearbeitet wird
write_scope: []            # Dateien/Verzeichnisse, die geändert werden dürfen
read_scope: []             # Code und Daten, die für den Auftrag gelesen werden
risk_class: code           # doc | code | migration | runtime-data | production
max_commits: 15            # Umfangsgrenze; bei Überschreitung neu planen statt weitermachen
excluded_actions:          # ausdrücklich verboten
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Was soll der Zielbereich konkret liefern oder ändern?

## Kontext

Warum wird die Änderung benötigt? Welche Entscheidung oder welches Problem aus dem Quellbereich führt zu dieser Aufgabe?

## Abgrenzung

Was gehört ausdrücklich **nicht** zu dieser Aufgabe? Der Zielbereich bleibt Source of Truth für seine eigene Domäne.

## Arbeitsweise

- Vor jedem Push die betroffenen Test-Scripts lokal ausführen; die CI ist Bestätigung, kein Debugger.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit wie der Code.
- Wird `max_commits` erreicht oder ändert sich der Umfang: anhalten, Status `blocked` setzen, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Fachliches Ergebnis ist eindeutig umgesetzt.
- [ ] Bestehende Funktionen des Zielbereichs wurden nicht unnötig dupliziert.
- [ ] Schnittstellen zum Quellbereich sind dokumentiert.
- [ ] Relevante Tests/Builds sind erfolgreich.
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

Nach Abschluss eintragen. „Fehlend", „übersprungen", „fehlgeschlagen" und „bestanden" sind vier verschiedene Zustände – nicht zusammenfassen.

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration: Dateien, Umgebung, Rückweg, Freigabe durch – oder „keine"
- Deployment: Umgebung, SHA, Status, Health-Check – oder „keins"
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
- Hinweise für den Quellbereich:

## Blocker / Entscheidung

Nur verwenden, wenn `status: blocked` ist. Konkreten fehlenden Input oder die notwendige Entscheidung benennen.
