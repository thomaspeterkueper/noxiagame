# NOXIA – Ontogenetischer Sprachlernversuch v0.1

Status: synthetisches, deterministisches Offline-Experiment; noch nicht mit NPC-Laufzeit oder Persistenz verbunden.

## Versuchsaufbau
Ein künstlicher Lernender startet mit leerem Lexikon. Pro Simulationstag
beobachtet er eine Szene, hört ein Wort und kann einen Gegenstand
aufmerksam betrachten. Koinzidenzen erzeugen gewichtete Assoziationen.
Mehrdeutige Gleichstände führen zu `null` statt erzwungenem Raten.

Der mitgelieferte synthetische Generator liefert vier Gegenstände
(ball, cup, book, water), zwei Bezugspersonen, Distraktoren und
wiederholte, absichtlich eindeutige Aufmerksamkeitsreize. Standardlauf:
120 Tage, Auswertung an Tagen 0, 3, 7, 29 und 119. Ein erfolgreicher
Test dieser Spielzeugdaten ist **kein** Nachweis menschlichen Spracherwerbs.

## Metriken
Pro Checkpoint: eindeutig zugeordnete Wörter, korrekte Zuordnungen,
Anzahl der Testwörter, Trefferquote und ein unveränderlicher
Assoziations-Snapshot. Zeitliche Reihenfolge ist zwingend.

## Methodische Grenzen
Kein akustisches Signal, keine Grammatik, kein visuelles Modell, keine
motorische Entwicklung, kein Gedächtnisabruf, keine sozialen Motive,
keine semantische Generalisierung. Derzeit sind Wörter und Objekte
bereits symbolisch segmentiert. Die Testdaten enthalten einen
starken Aufmerksamkeits-Hinweis und sind deshalb bewusst leicht.

## Nächste Stufen
1. Schwierigkeitskontrollen: keine Aufmerksamkeit, irrelevante Sprache,
   ungleiche Bezugspersonen, neue Objekte und ungleiche Häufigkeiten.
2. Feste Seeds, mehrere unabhängige Durchläufe, Konfidenzintervalle.
3. Perzeption, Bedürfniszustände und Interaktionen aus der NOXIA-Welt
   als Episoden einspeisen; Quelle und Kontext erhalten.
4. Episoden in ein dauerhaftes Auditprotokoll überführen und
   Vorhersage/Beobachtung mit Rückkopplungsintegrität verbinden.
5. Erst nach Tests mit bestehenden NPC- und Core-Verträgen integrieren.

Literatur:
- Vong & Lake (2026), On the Robustness of Modeling Grounded Word
  Learning Through a Child's Egocentric Input, DOI 10.1162/OPMI.a.377.
- Lin et al. (2026), EgoBabyVLM, arXiv:2605.19130.
