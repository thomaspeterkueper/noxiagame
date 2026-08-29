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

## Benötigte NOXIA-Entscheidung / Daten

Bitte die bereits kanonische Zuordnung des lokalen Kurses **„Energie & Arbeit“** zu einer SSF-/KG-Lernidentität angeben bzw. im NOXIA-eigenen Mapping hinterlegen:

- lokale `kurs_id` des Kurses,
- kanonische `PATH:SSF:*`-ID, sofern vorhanden,
- kanonische `LRN:SSF:*`-/SSF-Modul-ID, über deren `/api/noxia/modules/{moduleId}`-Payload die Interaktion ausgeliefert werden soll,
- falls noch keine Identität existiert: als NOXIA-Anforderung an den Knowledge Graph routen, statt in SSF eine lokale Konkurrenzidentität anzulegen.

Die Interactive-ID selbst bleibt gemäß Quellauftrag stabil: `gravitationsbrunnen`.

## Akzeptanz

- Eindeutige, repository-seitig dokumentierte Modul-/Pfadzuordnung liegt vor.
- SSF kann die Interaktion ohne erfundene Identität einem kanonischen Modul zuordnen.
- NOXIA bleibt Source of Truth für den lokalen Kurs und dessen In-Game-Bindung; KG bleibt Source of Truth für kanonische Lernidentität; SSF bleibt Source of Truth für Inhalt und Didaktik.

## Rückmeldung an SSF

Nach Festlegung/Bestätigung der Zuordnung kann SSF den strukturierten `interactive`-Abschnitt implementieren und den ursprünglichen Auftrag abschließen.