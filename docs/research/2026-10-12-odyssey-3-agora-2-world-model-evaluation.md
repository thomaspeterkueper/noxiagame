# noχ¹ᐃ – Evaluation generativer Weltmodelle: Odyssey-3 und Agora-2

Status: **Evaluation aufgenommen; keine Integrationsfreigabe**
Datum: 2026-10-12
Bereich: Core / Architektur, Gebäude & Innenräume, NPC, Grafik & Assets, QA
Typ: Technologiebeobachtung und reproduzierbarer Proof-of-Concept-Plan

## Anlass und Quellen
- Odyssey-3: https://odyssey.systems/meet-odyssey-3 (Hersteller, 08.10.2026)
- Einordnung: https://the-decoder.de/odyssey-3-neues-ki-weltmodell-erzeugt-interaktive-welten-und-ist-jetzt-kostenlos-testbar/ (11.10.2026)
- Öffentliche Flash-Demo: https://experience.odyssey.systems/
- API-Zugang: https://developer.odyssey.ml/ (Zugang und Nutzungsbedingungen gesondert prüfen)
- Agora-2: als gesonderten Multi-Agenten-Forschungspfad beobachten; konkrete Funktionen, Verfügbarkeit und Integrationsrechte vor Bewertung primär belegen.

## Befund und Grenzen
Odyssey-3 ist laut Anbieter ein autoregressives Diffusions-Weltmodell. Die öffentliche Forschungsvorschau erlaubt promptbasierte interaktive Umgebungen mit Ego- und Third-Person-Navigation. Dies **belegt nicht**, dass exportierbare 3D-Geometrie, reproduzierbare Kollisionen, deterministische Weltzustände, eine stabile Streaming-API oder ein tragfähiges Preis-/Lizenzmodell verfügbar sind. Hersteller-Benchmarks zu visueller/physikalischer Plausibilität sind keine Garantie für geometrische oder physikalische Korrektheit. Der in Medien genannte Physics-IQ-Bestwert mit best-of-eight Auswahl ist methodisch gesondert vom Mehrfachlauf-Mittelwert zu betrachten.

## Verbindliche Architektur-Invarianten
1. Persistierte Datenbank und Domain-Logik bleiben **einzige Source of Truth** für Orte, Koordinaten, Besitz, NPC-Identitäten, Ressourcen, Zeit und Aktionen.
2. Ein Weltmodell liefert nur **Vorschläge, visuelle Prognosen oder verworfene Testepisoden**, niemals ungeprüfte persistente Mutationen.
3. Geometrie, Betretbarkeit, Türen, Navigation und Kollisionsprüfung bleiben zunächst Aufgabe der vorhandenen/geplanten klassischen Darstellung (SVG/Canvas, bei Bedarf Three.js).
4. Keine KI-generierte Innenraum- oder Gebäudeänderung darf persistierte Bauzustände, Zugangsrechte oder Eigentumsverhältnisse überschreiben.
5. Beobachtung, Vorhersage und kanonischer Zustand sind im Datenmodell und in Logs voneinander zu unterscheiden.
6. API-/Cloud-Ausfall darf den normalen Spielbetrieb nicht blockieren; Fallback auf klassische Ansicht.
7. Vor Übertragung von Spieler-/NPC-Daten: DSGVO, Datenverarbeitung, Hostingregion, Aufbewahrung und Trainingsnutzung prüfen. Keine produktiven personenbezogenen Daten im Test.

## PoC 1 – gebautes Café als Reproduzierbarkeitstest
Baseline: vorhandenes selbst gebautes Café in einer begehbaren lokalen Szene mit bekannter Lage, Eingang, Innenraumkonfiguration und NPC. **Keine Änderung am produktiven Café.**

Testmatrix (jeweils Wiederholungen, Ausgangszustand dokumentieren):
- T1: Gleicher Prompt / gleicher Ausgangszustand mehrfach: Eingang, Türen, Grundriss, Einrichtung konsistent?
- T2: Vom Eingang ins Café, Kamera drehen, Raum verlassen und erneut betreten: bleibt die Topologie identisch?
- T3: Sichtwechsel Ego/Third-Person: dieselben Türen, Möbel, Hindernisse?
- T4: NPC oder Objekt bewegt sich; danach Rückkehr zum Ausgangspunkt: konsistente, beobachtbare Folgen?
- T5: Handlung widerspricht dem persistierten Zustand (verschlossene Tür; nicht gebauter Raum): hält eine Adapterlogik die Grenze?
- T6: Netzunterbrechung, Zeitüberschreitung, Dienstlimit: Fallback ohne Beschädigung des Weltzustands?
- T7: Gleiche Szene klassisch und generativ: Verständlichkeit, Steuerbarkeit, Barrierefreiheit, visuelle Qualität und subjektive Immersion.

Erfassen je Lauf: Prompt, Datum/Modellvariante, Steuerungssequenz, Videobeleg/Screenshots (ohne private Daten), beobachtete Inkonsistenzen, Laufzeit, Antwortlatenz, Abbrüche, Kosten bzw. verbrauchte Kontingente und Reproduzierbarkeit. Vorab klare Pass/Fail-Kriterien festlegen; ohne exportierbare Geometrie ist echte Kollisionsvalidierung **nicht** behauptbar.

## Technische Erkundung vor Implementierung
- Kann eine offiziell dokumentierte API programmgesteuert Sitzungen starten, kontrollieren und Bilder/Video ausgeben?
- Unterstützt der Anbieter Seed/Determinismus, Szene-Referenzen, gesperrte Geometrie, Zustandsspeicherung, Koordinaten und Constraints?
- Sind kommerzielle Nutzung, Content-Rechte, Datenverbleib und Wiederverwendung erlaubt?
- Welche Auflösung, FPS, Latenz, parallelen Sitzungen, GPU-/API-Kosten, Ratenlimits und Ausfallmodi gelten tatsächlich?
- Unabhängiger Vergleich mit normalem Three.js-Innenraum und vorhandener 2.5D-Darstellung.

## Agora-2 – separater Forschungspfad
Mehragenten-Interaktion kann für autonome NPCs interessant sein. Vor belastbaren Aussagen zuerst Primärquelle, dokumentierte Mehragentenfähigkeit, Persistenz, NPC-Identität, Steuerungsmöglichkeiten, Kosten und Zugang klären. Nicht mit gesicherter Odyssey-3-API-Funktion gleichsetzen.

## Entscheidungstor
**Jetzt:** Technologie beobachten und den manuellen Demo-Test mit synthetischer Café-Szene durchführen, ohne produktive Datenübertragung. 
**Später nur bei positiven Tests:** isolierter optionaler Adapter, Feature Flag, feste Ausgabenbudgets, Telemetrie und harte Read-only-Grenze.
**Nicht beschlossen:** Austausch der 3D-Engine, Einbau in Produktivsystem, Providerbindung, kostenpflichtiger API-Zugang.

## Nächste Revisionsauslöser
- Dokumentierte API und Tarife veröffentlicht
- Export stabiler Szenengeometrie / persistenter Weltzustand möglich
- Neue unabhängige Benchmarks bzw. Mehragenten-Nachweise
- Spätestens **2027-04-12** erneut prüfen; bei erheblichem Fortschritt früher.

Verknüpfungen: `README.md` (Source-of-Truth-Prinzip); `docs/design/walkable-colony.md`; `docs/decisions/ADR-walkable-colony-architektur.md`; `docs/NOXIA-VISUAL-BIBLE.md`.
