# Akademie ↔ Knowledge Graph: Integrationsstand 2026-10-21

Status: **Analyse / nicht produktiv angebunden**, NOXIA Issue #510 und KG Issue #238.

## Bereits verfügbar
- KG `exports/kxf-learning-modules-0.1.json`: Wissensdomänen und Lernmodule, KXF-LEARNING-MODULES-0.2 (v0.2.14; Exportstand 19.10.2026).
- KG `exports/kxf-learning-paths-0.1.json`: Lernpfad-Projektion (62 Records im Export).
- KG GET `/api/query/relations/[id]`, `/api/query/modules-by-competency/[cmpId]`, `/api/query/prerequisites/[documentId]`, `/api/query/learning-path/[documentId]`.
- NOXIA: `app/dashboard/SchoolOverlay.tsx` konsumiert SSF-Module via `/api/ssf/modules` und Abschlüsse aus `academy_completions`.
- Akademie PR #511 zeigt zunächst nur SSF-Fachgebiete und echte Abschlüsse. Fachgebiets-Zugehörigkeit wird nicht als semantische KG-Kante behauptet.

## Noch nicht nachgewiesen
- Eine paginierbare, versionierte KG-Graphprojektion für NOXIA (Knoten und Kanten mit Quellen).
- Belastbare end-to-end-Relationen von Spielhandlung zu Wissensobjekt, Lernpfad, Assessment und normativem Unlock.
- Korrektheit aller exportierten Lernpfad-Titel. Beispielsweise widersprechen sich bei `PATH:SSF:MAT-ERROR-0001` Titel und Untertitel.

## Integrationsvertrag / Safety
1. Der KG bleibt für kanonische IDs, Wissensbeziehungen, Wissensdomänen und normative Unlocks zuständig.
2. SSF bleibt für Lerninhalte und Prüfungen zuständig; NOXIA hält pro Nutzer Lernstatus und geprüfte Freischaltungen.
3. NOXIA zeigt eine Relation nur, wenn sie durch KG-ID/Typ, eindeutigen Endknoten, Herkunft und Schema validiert wurde.
4. Bei KG-Ausfall wird weiter eine reduzierte Fachgebiets-/Modulübersicht angezeigt, ohne künstlich erzeugte Kanten oder Kompetenzen.
5. Empfehlungen aus ungeprüften Prototyp-Records und widersprüchlichen Lernpfaden unterdrücken bzw. kenntlich machen.
6. Kompetenzprüfung muss für freischaltende Funktionen erfolgreich absolviert und serverseitig bestätigt werden; Lesen allein reicht nicht.

## Next Steps
- KG Issue #238: Mapping und Qualitätssicherung.
- NOXIA: versionierten KG-Consumer mit Schema-Validierung und gezielten Contract Tests implementieren.
- NOXIA: persönlichen Wissensbaum auf validierte KG-Kanten umstellen.
- Freischaltprüfungen anschließend mit SSF Assessment und verifizierten normativen KG Unlock-IDs verbinden.
