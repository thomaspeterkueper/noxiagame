# Admin-Ansicht: NPC-Kognition A/B (Read-only Pilot)

Status: reiner Auswertungsadapter implementiert; UI/geschützte Route/Produktiv-DB noch **nicht** angeschlossen.
Datum: 2026-10-29

## Datenvertrag
`npcSymbolicSnapshotBridge.ts` verarbeitet die vorhandenen kanonischen `PersonNeed`-, `PersonRelationship`- und optionalen `AffectState`-Modelle. Der bestehende `npcSymbolicExperiment.ts` bleibt die gemeinsame A/B-Fixture. Kein zweiter NPC-Zustand, keine Schreiboperation und keine zweite Speicherung. Der Adapter markiert fehlende Beziehungen bzw. Affekte und zeigt numerische Basiswerte plus offene Symbolannotation.

## Geplante Admin-Einbindung
Eine geschützte administrative Oberfläche liest nach geprüfter Rollenautorisierung ausgewählte Personen und relevante eigene Beziehungen/Bedürfnisse sowie abgeklungenes Affect-Snapshot. Die Oberfläche zeigt je NPC die Eingaben, Baseline, Symbolframe, Quellen, Unsicherheit, fehlende Daten und eine Vergleichshistorie. Historische Szenarien werden separat gekennzeichnet.

Die in dieser Phase noch künstliche `observedDistress`-Größe muss künftig aus tatsächlichen **beobachtbaren** Ereignissen kommen; sie darf nie aus fremden vertraulichen inneren Zuständen abgeleitet werden. `rememberedConflict` muss aus dem zugänglichen relationalen NPC-Gedächtnis stammen. Solange das nicht verfügbar ist, trägt die Admin-UI ausdrücklich `hypothetischer Vergleich`.

## Messplan
- Gruppeninteraktion und Kontaktsuche, Konflikt, Hilfeleistung, Schlafmangel.
- Verhalten vs. Kontrollgruppe ohne Symbolannotation vergleichen. Der Symbolrahmen darf noch keinen Entscheidungs-Score verändern, deshalb sind **keine Wirkungsgewinne** behauptbar; gemessen wird zunächst Interpretierbarkeit/Provenienz.
- Regression: gleiche Snapshots ergeben gleiche Ausgaben, anderer NPC erhält keine privaten Gedächtnisinhalte, Fehlwerte bleiben sichtbar, keine Änderungen an regulären Ticks.
- Erst danach: administrativ geschütztes Read-only-Backend und UI mit Berechtigungsprüfung sowie Datenminimierung.
