# Relational World Runtime v0.1 — Forschungs- und Architekturanker

Stand: 2026-10-06

## Zweck

NOXIA soll keine vollständig materialisierte Welt zu jedem globalen Tick berechnen. Die Runtime behandelt Weltzustand als lokal entstehende Relationen und fortwirkende Spuren. Detail wird erst dort materialisiert, wo eine Wechselwirkung es benötigt. Das ist zunächst eine Spiel- und Simulationsarchitektur, keine Behauptung einer fundamentalen Physik.

## Entscheidungen aus der Diskussion

- **Werden vor Zustand:** Ein Zustand ist eine für eine konkrete Beziehung hinreichend verdichtete Rekonstruktion, kein vorausgesetzter vollständiger Weltzustand.
- **Keine verborgene Ground Truth:** Ein offenes Detail ist nicht bloß unbekannt. Wenn keine wirksame Relation es bestimmt, bleibt es offen.
- **Drei epistemische Zustände:** bestimmt / offen / ausgeschlossen.
- **Spuren statt vollständiger Vergangenheit:** Vergangenes bleibt durch gegenwärtig wirksame Folgen erreichbar. Ein Foto, eine Erinnerung oder ein Protokoll ist ein neues Ereignis mit Provenienz, keine Rückkehr zum vergangenen Ereignis.
- **Retro-Referenz ohne Retro-Kausalität:** Spätere Bestimmung darf auf Vergangenes referieren, aber bereits erzeugte Folgen nicht umschreiben (Monotonie der Wirkung).
- **Vergessen ist real:** Wenn alle relevanten Spuren und Folgen verschwinden, kann Bestimmtheit wieder abnehmen. Es gibt für die Runtime kein privilegiertes Archiv.
- **Verankerung A=(B,H):** Breite B meint genealogisch unabhängige Provenienzpfade. Haltbarkeit H entsteht durch Persistenz vorhandener Spuren oder erneute Hervorbringung entsprechender Spuren. Kein globaler Skalar ist vorgeschrieben.
- **Gegenwart lokal:** Gegenwart ist der aktive Wechselwirkungsrand. Eine globale Newtonsche Gegenwart ist für die Runtime nicht erforderlich.
- **Zeitordnung als Wachstum:** Vektoruhren bilden nur die bereits entstandene partielle Kausalordnung ab; sie ersetzen den globalen Tick für relationale Ereignisse.
- **Kontingenz:** Ein Seed ist in NOXIA ein Reproduzierbarkeitswerkzeug, keine ontologische Erklärung.

## NPC-Folgen

NPC-Erinnerung soll künftig Inhalt, subjektive Gewissheit und Provenienz trennen. Zwei NPCs dürfen dasselbe Ereignis ehrlich verschieden rekonstruieren. Kopierte Gerüchte erzeugen keine künstliche Evidenzbreite. Schlaf/Konsolidierung darf Spuren verstärken, zusammenfassen oder verlieren; kreative Verarbeitung darf neue Hypothesen erzeugen, aber keine nicht vorhandene Evidenz vortäuschen.

Institutionen wie Archive, Gerichte, Wissenschaft und Journalismus können unterschiedliche Rekonstruktionsregeln verwenden, ohne die zugrunde liegenden Spuren zu verändern.

## Physikalische Grenze

Die makroskopische Runtime verwendet Lazy Resolution und darf lokal deterministisch oder pseudokontingent arbeiten. Das ist **kein** fundamentales Quantenmodell. Ein lokales Seed-/Spurenmodell ist eine lokale Hidden-Variable-Struktur und bleibt im CHSH-Test bei 2.

Der separate AVI-Prüfstand hält deshalb die Grenzen sichtbar:
- lokal/klassisch: CHSH 2,
- Quantenreferenz bzw. Q1 im CHSH-Szenario: 2 sqrt(2),
- No-Signalling/PR: 4.
CHSH trennt Q1 nicht von der echten Quantenmenge. Für die nächste Forschungsstufe ist ein Szenario wie I3322 nötig, in dem Q1 und Q auseinanderlaufen können.

Keine Quantenkorrelation wird in die Gameplay-Runtime hineinerklärt. Forschungsmodelle und Produktionssimulation bleiben getrennt.

## v0.1 Implementierung

`lib/game/cognition/relationalWorldRuntime.ts` liefert zunächst:
- Vektoruhren und partielle Ordnung,
- RelationalTrace mit Eltern-/Provenienzbeziehungen,
- genealogische Unabhängigkeitsprüfung,
- Rekonstruktion als bestimmt/offen/ausgeschlossen,
- Lazy Resolution ausschließlich aus kompatiblen Kandidaten,
- expliziten Spurzerfall.

v0.1 schreibt nichts in Supabase und erzeugt keine LLM-Aufrufe. Persistenz, NPC-Integration, Schlaf/Konsolidierung und institutionelle Merge-Policies folgen erst nach Tests gegen die vorhandene Cognition-Runtime.

## Forschungsfragen

1. Wie entstehen stabile Regeln als Gewohnheiten aus wiederholtem Werden, ohne eine externe Meta-Regel einzuschmuggeln?
2. Welche Merge-Regeln sind lokal, perspektivisch und dennoch konsistent?
3. Wie modellieren wir Haltbarkeit ohne einen externen globalen Score?
4. Welche Eigenschaft trennt in geeigneten Bell-Szenarien Q1 von Q, ohne Hilbertraumstruktur nur umzubenennen?
5. Wo endet die produktive Analogie zwischen NOXIA-Simulation und Ontologie/Physik?

Leitlinie: **Philosophie -> Modell -> Spiel -> Experiment -> neue Fragen.**
