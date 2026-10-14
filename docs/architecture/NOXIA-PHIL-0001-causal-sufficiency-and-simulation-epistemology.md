# NOXIA-PHIL-0001 — Kausale Genügsamkeit und die Ununterscheidbarkeit adaptiver Welten

Version 1.0 · 2026-10-14 · Status: philosophische Architekturhypothese

## Ausgangspunkt

NOXIA verwendet Adaptive Detail Resolution: Nicht jede Ebene der Welt wird jederzeit
mit maximaler Granularität explizit simuliert. Ein Tisch kann als makroskopisches Objekt
mit Geometrie, Masse, Materialeigenschaften und Zustand funktionieren, ohne dass jedes
Molekül dieses Tisches in jedem Tick als einzelnes Simulationsobjekt geführt wird.

Das ist zunächst ein technisches Architekturprinzip.

Die weitergehende Frage lautet:

> Könnte eine Welt für ihre Bewohner vollständig real und konsistent erscheinen,
> obwohl tiefere Ebenen nur dann explizit aufgelöst werden, wenn kausale Prozesse,
> Beobachtung oder Forschung sie benötigen?

NOXIA behandelt diese Frage als **Modellhypothese**, nicht als Aussage darüber,
dass unsere reale Welt tatsächlich so funktioniert oder eine Simulation ist.

## Kausale Genügsamkeit

**Causal Sufficiency / Kausale Genügsamkeit:**

Eine Beschreibungsebene ist ausreichend, solange sie alle auf dieser Ebene möglichen
kausalen Folgen konsistent hervorbringen kann.

Beispiel:

Ein Tisch muss nicht als explizite Liste aller Moleküle existieren, damit:
- eine Tasse auf ihm stehen kann,
- sein Gewicht gemessen werden kann,
- er verschoben werden kann,
- er unter einer Last brechen kann.

Erst wenn eine Beobachtung oder ein Vorgang von tieferer Struktur abhängt,
muss die Simulation diese Struktur auflösen.

## Konsistenzbedingung beim Verfeinern

Feinere Zustände dürfen nicht beliebig erzeugt werden.

Wenn ein Objekt von einer groben auf eine feinere Ebene aufgelöst wird, muss die neue
Struktur mit allem vereinbar sein, was bereits kausal oder epistemisch über das Objekt
feststeht:

- Material und Herkunft,
- Herstellungs- und Schadensgeschichte,
- frühere Messungen,
- Temperatur und Umweltzustand,
- Erhaltungssätze und andere Naturgesetze,
- bereits persistierte Folgen.

Die feine Ebene ist damit durch die gröbere Vergangenheit eingeschränkt.

## Drei verschiedene Tiefen

NOXIA unterscheidet ausdrücklich:

### Ontologische Tiefe
Welche feineren Strukturen die Naturgesetze der Welt grundsätzlich zulassen.

### Simulierte Tiefe
Welche Strukturen im aktuellen Zustand explizit berechnet und persistiert werden müssen.

### Epistemische Tiefe
Welche Strukturen ein bestimmter Beobachter erkennen, messen oder verstehen kann.

Diese Ebenen dürfen nicht gleichgesetzt werden.

Insbesondere folgt aus
"die Engine kennt oder erzeugt einen feineren Zustand"
nicht
"ein NPC kennt diesen Zustand".

## Progressive Resolution Cost

Je tiefer eine Ebene aufgelöst werden soll, desto größer wird der dafür notwendige Aufwand.

Der Aufwand entsteht nicht primär aus einem abstrakten Spielpreis, sondern aus der Sache selbst:

- Instrumente,
- Messgenauigkeit,
- Kalibrierung,
- Probenvorbereitung,
- Messzeit,
- Fachwissen,
- Rechenkapazität,
- Energie,
- unabhängige Bestätigung.

Damit wird tiefere Erkenntnis zunehmend schwieriger, ohne dass jede tiefe Ebene
permanent simuliert werden muss.

## Epistemische Konsequenz für interne Beobachter

Ein Bewohner von NOXIA kann grundsätzlich nur Zustände beobachten, die über die
Naturgesetze seiner Welt kausal zugänglich sind.

Wenn die Simulation beim Übergang zwischen Auflösungsebenen perfekt konsistent bleibt,
kann ein interner Beobachter möglicherweise nicht feststellen, ob:

1. alle tieferen Zustände seit Beginn vollständig explizit berechnet wurden, oder
2. tiefere Zustände erst dann explizit aufgelöst wurden, als sie kausal benötigt wurden.

Beide Welten können für den Beobachter dieselben Messresultate liefern.

## Was wäre überhaupt nachweisbar?

Nicht "fehlende Berechnung" an sich.

Nachweisbar wären nur beobachtbare Abweichungen wie:
- Inkonsistenzen zwischen Auflösungsebenen,
- reproduzierbare Artefakte,
- Verletzungen von Erhaltungssätzen,
- harte Auflösungsgrenzen ohne physikalische Erklärung,
- zeitliche oder kausale Widersprüche,
- Messresultate, die nicht mit der bisherigen Weltgeschichte vereinbar sind.

Wenn solche Unterschiede fehlen, kann die zugrunde liegende Implementierungsweise
innerhalb der Welt empirisch unterbestimmt sein.

## Bezug zur realen Welt

Dieses Dokument behauptet **nicht**, dass unsere reale Welt eine Simulation ist.

Es hält nur fest:

- Makroskopische Stabilität erfordert nicht automatisch, dass ein Simulationsmodell
  jedes Mikrodetaill jederzeit explizit berechnet.
- Damit verliert das Argument
  "eine Universumssimulation wäre unmöglich, weil jedes Teilchen ständig berechnet werden müsste"
  einen Teil seiner Kraft.
- Ob unsere reale Welt tatsächlich adaptiv, fundamental vollständig bestimmt oder ganz anders
  strukturiert ist, folgt daraus nicht.

Quantenmechanik darf nicht als einfacher Beleg für "Rendering bei Beobachtung" verwendet werden.
Sie zeigt jedoch, dass klassische Vorstellungen jederzeit vollständig bestimmter klassischer
Eigenschaften nicht ohne Weiteres auf fundamentale Physik übertragbar sind.

## NOXIA als Experiment

NOXIA kann diese Frage praktisch untersuchen:

- NPCs betreiben Wissenschaft.
- Ihre epistemische Tiefe wächst mit Instrumenten, Wissen und Aufwand.
- Die Engine löst tiefere Ebenen nur dort auf, wo sie kausal nötig werden.
- Alle neu erzeugten Details müssen rückwärts mit der bisherigen Weltgeschichte konsistent sein.
- NPCs dürfen keine privilegierte Sicht auf Engine- oder Datenbankzustände besitzen.

Dadurch kann innerhalb von NOXIA dieselbe Frage entstehen:

> "Leben wir in einer Simulation?"

Und die Schwierigkeit, diese Frage zu beantworten, ergibt sich nicht aus Lore,
sondern aus der Architektur der Welt selbst.

## Verbindung zu bestehenden Prinzipien

Siehe:
- `docs/cross-cutting/integrity-timescale-engineering.md`
- Integrity of Observation
- Timescale Engineering
- Adaptive Detail Resolution

Zusammen:

- Integrity of Observation: Was darf als Wissen gelten?
- Timescale Engineering: Wie oft muss etwas berechnet werden?
- Adaptive Detail Resolution: Wie tief muss etwas explizit werden?
- Causal Sufficiency: Wann ist eine gröbere Ebene für die Weltwirkung bereits ausreichend?
- Progressive Resolution Cost: Warum wird tiefere Erkenntnis zunehmend aufwendig?



## Minimal implementation contract

The first code-level expression is intentionally small:
`lib/game/simulation/resolution.ts`.

It only compares ontological, simulated, requested and epistemic depth. It does not
materialize atoms, components or other fine state; it does not add persistence; and it
does not define a universal cost formula. Domain systems remain responsible for deciding
what a refinement actually means and what evidence/resources it requires.

This preserves Adaptive Detail Resolution as a constraint instead of turning it into a
second simulation engine.
