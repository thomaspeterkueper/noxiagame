# SSF/KG Learning Path — Robotikmodul-Fertigung

## Zweck
Dieser Pfad verbindet Lernfortschritt mit realen Fertigungsfähigkeiten in NOXIA. Er definiert **keine automatische Freischaltung**: KG/SSF darf die unten genannten `player_unlocks` erst nach erfolgreicher Lern-/Praxisleistung vergeben.

## Kanonische Unlocks
- `UNL:NOX:ENG:ROBOT-FABRICATION` — mechanische Robotikfertigung, Montage, Lastpfade, Werkzeugschnittstellen und mikrogravitationsgeeignete Arbeitsmodule.
- `UNL:NOX:ENG:PRECISION-INSTRUMENTATION` — Präzisionsinstrumentierung, Kalibrierung, Messketten, Sensorintegration und qualitätsgesicherter Instrumentenbau.
- Bestehend: `UNL:NOX:SENSOR:SPECTRAL` — fachliche Freigabe für Spektralsensorik.

## Lernpfad A — Robotikfertigung
1. Chassis, Aktuatorik und modulare Schnittstellen verstehen.
2. Kräfte, Gegenmomente und Verankerung in Mikrogravitation beurteilen.
3. Material- und Komponentenbedarf eines Moduls planen.
4. Montagefolge, elektrische/Datenschnittstellen und Funktionsprüfung durchführen.
5. Fehlerbild erkennen und Reparatur versus Austausch entscheiden.
6. Praktische Abschlussaufgabe: ein mechanisches Arbeitsmodul spezifizieren, montieren und prüfen.

Ergebnis-Gate: `UNL:NOX:ENG:ROBOT-FABRICATION`.

## Lernpfad B — Präzisionsinstrumentierung
1. Messgröße, Messbereich, Auflösung und Unsicherheit unterscheiden.
2. Sensor, Frontend, Kalibrierung und Datenpfad als Messkette modellieren.
3. Störgrößen, Temperaturdrift und mechanische Kopplung bewerten.
4. Referenz-/Kalibriermessung planen.
5. Instrument nach Montage gegen definierte Akzeptanzkriterien prüfen.
6. Praktische Abschlussaufgabe: Instrumentenmodul integrieren und eine dokumentierte Kalibrierung bestehen.

Ergebnis-Gate: `UNL:NOX:ENG:PRECISION-INSTRUMENTATION`.

## Rezeptzuordnung
### Robotikfertigung
- Regolithschaufel
- reaktionskompensierter Bohrer
- geschlossener Materialhopper
- Werkzeugwechsler
- Ersatzteilrack

### Präzisionsinstrumentierung
- Bodenradar
- Massenmesszelle
- Inspektionskamera

### Kombiniertes Fach-Gate
Das Spektrometerpaket verlangt:
- `UNL:NOX:ENG:PRECISION-INSTRUMENTATION`
- `UNL:NOX:SENSOR:SPECTRAL`

## Spielinvariante
Ein bekanntes Rezept ist nicht automatisch ausführbar. Serverautoritativ müssen gleichzeitig gelten:
1. erforderliche aktive `player_unlocks`,
2. physisch vorhandene Surface-Workshop-Infrastruktur,
3. ausreichender lokaler Bestand an Metall, Komponenten und Energie,
4. laufender zeitgebundener Fertigungsauftrag,
5. erst nach Ablauf entsteht ein neues serialisiertes `equipment_item`.

## KG-Trennung
- **Knowledge/skill:** Was der Akteur verstanden und nachgewiesen hat.
- **Recipe:** Welche Fertigungsfolge technisch definiert ist.
- **Resources:** Was physisch am Ort vorhanden ist.
- **Equipment item:** Das konkrete gefertigte Einzelobjekt mit Seriennummer und Zustand.

Diese Ebenen dürfen nicht zusammenfallen: Wissen erzeugt keine Materie, und vorhandene Materie ersetzt keine Kompetenz.
