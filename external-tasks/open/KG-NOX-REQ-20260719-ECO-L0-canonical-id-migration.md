---
id: KG-NOX-REQ-20260719-ECO-L0
requester: SYS:KUEPER:kg
target: SYS:KUEPER:noxia
priority: high
type: migration
created: 2026-07-19
status: open
affects: [NOXIA, SSF]
source_context: SSF-NOXIA-REQ-20260719-ECO-L0
canonical_modules: [ECO-L0-000001, ECO-L0-000002]
blocking: [KG-SSF-REQ-20260719-ECO-L0]
---

# KG-NOX-REQ-20260719-ECO-L0 — NOXIA auf kanonische Kredit-/Zins-Module migrieren

## Anlass

Der Knowledge Graph hat die von NOXIA zuvor lokal erfundenen wirtschaftlichen Lernmodule jetzt kanonisch registriert:

- `ECO-L0-000001` — Was ist ein Kredit?
- `ECO-L0-000002` — Zins und Zinseszins

Historische NOXIA-Platzhalter:

- `LRN:SSF:ECO-L0-0001`
- `LRN:SSF:ECO-L0-0002`

Die Platzhalter dürfen nicht länger als eigenständig definierte SSF-Objekte behandelt werden. Der KG führt sie nur noch als `legacyId` zur Rückverfolgbarkeit.

## Voraussetzung

SSF muss die Lernreisen für `ECO-L0-000001` und `ECO-L0-000002` bereitstellen (`KG-SSF-REQ-20260719-ECO-L0`).

## Gewünschte Änderung in NOXIA

1. Alle lokalen/hardcodierten Definitionen der alten `LRN:SSF:ECO-L0-*`-Platzhalter entfernen.
2. Bank-, School- und Foundation-Gates auf die kanonischen Module umstellen.
3. Kredit-bezogene Gates auf `ECO-L0-000001` abbilden.
4. Zins-/Zinseszins-bezogene Gates auf `ECO-L0-000002` abbilden.
5. Die Abhängigkeit `ECO-L0-000001 → ECO-L0-000002` respektieren.
6. Keine fachlichen SSF-Objekte im NOXIA-Repo neu definieren.

## Akzeptanzkriterien

- Keine aktive NOXIA-Logik verwendet die alten Platzhalter-IDs als kanonische IDs.
- Die kanonischen KG-IDs werden über die bestehende SSF/KG-Integration referenziert.
- Bestehende gespeicherte Fortschrittsdaten mit Legacy-IDs werden, falls vorhanden, migrationssicher behandelt.
- Bank-/School-Funktionen zeigen bei fehlendem SSF-Inhalt einen nachvollziehbaren Zustand statt eines erfundenen lokalen Moduls.
- Nach SSF-Bereitstellung funktionieren die Gates Ende-zu-Ende.

## Priorität

**High**, aber Umsetzung erst nach Bereitstellung der SSF-Lernreisen abschließen.
