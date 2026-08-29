---
id: SSF-NOX-REQ-20260829-GRAVITATIONSBRUNNEN-MAPPING
requester: SYS:KUEPER:ssf
target: SYS:KUEPER:noxia
priority: high
type: integration-mapping
created: 2026-08-29
status: open
affects: [NOXIA, SSF]
---

# Kanonische SSF-Modul-/Pfadzuordnung für `gravitationsbrunnen` bereitstellen

## Anlass

SSF bearbeitet `NOX-SSF-REQ-20260829-GRAVITATIONSBRUNNEN`. Die gewünschte interaktive Lerneinheit soll über den bestehenden strukturierten SSF→NOXIA-Modulvertrag ausgeliefert werden.

Die Prüfung des aktuellen NOXIA-Codes zeigt jedoch: Der Platzhalter `animation_id: gravitationsbrunnen` gehört zu einem lokalen, DB-basierten Akademiekurs **„Energie & Arbeit“**. NOXIA fällt für Kurse ohne SSF-Modulzuordnung bewusst auf `KursRenderer` zurück. Die vorhandene archivierte `kg_path_id`-Migration ordnet nur `kurs_00_einheiten` und `kurs_01_prozentrechnung` dem Pfad `PATH:SSF:MAT-FOUNDATIONS-0001` zu; eine kanonische Zuordnung für „Energie & Arbeit“ ist im Repository nicht festgelegt.

SSF darf keine Modul- oder Pfadidentität für einen NOXIA-Kurs erfinden.

## NOXIA-Prüfung 2026-08-29

NOXIA bestätigt den Befund:

- `foundation_kurse` besitzt `kurs_id` und `kg_path_id` als getrennte Felder.
- Für **„Energie & Arbeit“** ist im Repository keine belastbare kanonische `PATH:SSF:*`-/`LRN:SSF:*`-Zuordnung vorhanden.
- Die konkrete produktive `kurs_id` des DB-Kurses ist ebenfalls nicht als Seed im Repository dokumentiert und wird daher nicht geraten.
- Die lokale Interactive-ID bleibt stabil: `gravitationsbrunnen`.

Gemäß Source-of-Truth-Regel wurde die fehlende kanonische Lernidentität an den Knowledge Graph geroutet:

`kueper-knowledge-graph/external-tasks/open/EXT-NOX-KG-20260829-energy-work-gravitational-well-module.md`

KG soll eine bestehende oder neue kanonische `LRN:SSF:*`-Identität und die zugehörige `PATH:SSF:*`-Zuordnung für **Energie & Arbeit** bereitstellen und im Learning-Modules-KXF exportieren.

## Nächster Schritt

Nach KG-Rückgabe:

1. NOXIA bindet den produktiven lokalen `foundation_kurse`-Datensatz über `kg_path_id` an den gelieferten Pfad. Die lokale `kurs_id` bleibt NOXIA-intern.
2. SSF verwendet die kanonische Modulidentität für den strukturierten `interactive`-Abschnitt `gravitationsbrunnen`.
3. NOXIA rendert die SSF-Interaktion im bestehenden Akademiefenster.

## Akzeptanz

- Eindeutige, repository-seitig dokumentierte Modul-/Pfadzuordnung liegt vor.
- SSF kann die Interaktion ohne erfundene Identität einem kanonischen Modul zuordnen.
- NOXIA bleibt Source of Truth für den lokalen Kurs und dessen In-Game-Bindung; KG bleibt Source of Truth für kanonische Lernidentität; SSF bleibt Source of Truth für Inhalt und Didaktik.

## Rückmeldung an SSF

Der NOXIA-Anteil ist bis zur KG-Rückgabe vollständig geklärt und korrekt weitergeroutet. Nach Festlegung der kanonischen IDs wird die lokale Bindung abgeschlossen.