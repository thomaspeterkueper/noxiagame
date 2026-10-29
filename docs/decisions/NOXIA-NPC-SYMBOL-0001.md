# NOXIA-NPC-SYMBOL-0001 — Offene symbolische Kommunikationsschicht

Status: experimenteller isolierter Prototyp, nicht in die Laufzeit verdrahtet
Datum: 2026-10-29

## Referenz
Omnizedenz / *Zeichen für das Unsagbare* ist eine **offene** poetisch-philosophische Symbolik. Für den technischen Versuch werden vorläufig vorhandene Zeichen verwendet: ∅ Avi (Möglichkeitsraum), ⇌ Reso (Wechselwirkung), ⟴ Ira (Rückkopplung), ⊕ Kora (Integration), ∇ Val (Entfaltung). Dies ist **keine** neue verbindliche Symbolgrammatik. Vor kanonischer Verwendung mit dem eigentlichen Werk abgleichen, insbesondere wegen historisch unterschiedlicher Symbolnamen und Lesarten.

## Architektur
Kleine autonome MiniNodes-artige Module (Wahrnehmung, Gedächtnis, Affekt, Physiologie, Motivation) dürfen ihre **eigenen intern begründeten** Signale als symbolische Annotationen veröffentlichen. Ein reiner Aggregator erhält Mehrdeutigkeit, Confidence und Provenienz; er entscheidet weder Handlungen noch schreibt er Weltwahrheit. Es handelt sich um eine interne Metapher für vorsprachliche Zustandsrepräsentation, **nicht** um einen wissenschaftlich nachgewiesenen Mechanismus des Unbewussten oder einen geheimen Kanal zwischen NPCs.

Gespräche und Beziehungen bleiben über vorhandene Wahrnehmungs- und Gedächtnissysteme vermittelt. NPC-zu-NPC-Kommunikation braucht ein beobachtbares Ereignis und darf keine privaten internen Zustände telepathisch übermitteln.

## Erster Versuch
`lib/game/cognition/npcSymbolicResonance.ts` implementiert reine Typen und `composeSymbolicFrame`, mit Deduplizierung, Unsicherheit und Quellenreferenzen. Keine DB-Migration, keine LLM-Abhängigkeit, keine automatischen biochemischen Behauptungen.

## Anschluss und Prüfung
1. Bestehende Module und ihr Ownership-Modell analysieren, nur beobachtete Signale adaptieren.
2. Symbolische Annotationen gegen sprachfreie numerische Baseline vergleichen: bessere Kausalität, interpretierbare Entscheidungen, Robustheit unter Ausfällen? Fehlende Verbesserung beendet das Experiment.
3. Tests mit NPC-Paaren und Gruppen: dieselbe Situation, andere Erinnerungen und Körperzustände; kein unbegründetes geteiltes Wissen.
4. Chronimaps strikt von historischen Tatsachen trennen, symbolische Deutungen als Modellannahme markieren.
5. Kein Produktivbetrieb und keine automatische Figurenmanipulation ohne Review.
