---
title: "Externe Anfrage an Knowledge Graph / SSF: L0-Inhalte für Grundschule (Grundlagen, Handwerk, Alltag)"
source_area: core
target_area: external:kueper-knowledge-graph
status: open
priority: normal
created: 2026-10-27
claimed_by: null
depends_on: []
touches: []
input_sha: 840755e
write_scope: []
read_scope:
  - docs/decisions/NOXIA-SCHOOL-0001-grundschule-als-lernort.md
  - docs/SSF-INTEGRATION.md
risk_class: doc
max_commits: 1
excluded_actions:
  - Module in noxiagame selbst definieren (Regel aus NOX-0007)
---

# Auftrag

Diese Anfrage ist im Knowledge Graph als `entity_request` einzureichen. Benötigt werden L0-Lernmodule mit kanonischen IDs, jeweils mit Erklärung, Übung und Prüfungsthemen, und für Handwerk/Alltag zusätzlich die fachliche Grundlage für Übungsrezepte (Material, Schritte, typische Fehler):

- **Grundlagen:** Lesen und Textverständnis, Schreiben, Grundrechenarten, Maße und Einheiten, erste Fremdsprache.
- **Handwerk:** Werkzeuge sicher benutzen, Holz verbinden, Schrauben/Dübeln, einfache Stromkreise und Löten, Reparieren statt Wegwerfen.
- **Alltag:** Kochen (Grundtechniken, Hygiene, Vorrat), Gärtnern (Aussaat, Wasser, Jahreszeiten), Haushaltsgeld und Einkaufen, Erste Hilfe.

Jedes Modul nennt den `skill_code` aus NOXIA-SCHOOL-0001, auf den es wirkt.

## Hinweis

Grundlagen können sofort mit vorhandenen Mathematik-Modulen starten; Handwerk und Alltag haben heute keine Inhalte.
