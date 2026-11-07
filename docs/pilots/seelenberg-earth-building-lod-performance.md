# Earth / Seelenberg: Gebäudedarstellung und Performance – Entscheidungsvorlage

Stand: 2026-10-27 · Status: experimentell; **nicht** in die Earth-Liveansicht integriert.

## Entscheidung
Reale OSM-Gebäude bleiben ausschließlich georeferenzierte Footprints. Für ihre grafische Darstellung verwenden wir neutrale, wiederverwendbare Darstellungen; individuelle Funktions-Assets aus `BUILDING_VISUALS` werden ausschließlich dann zugeordnet, wenn im separaten Simulationszustand eine entsprechende NOXIA-Gebäudeinstanz existiert. Keine mutmaßlichen Bewohner, Eigentümer oder Nutzungen aus OSM ableiten.

## Rendermodi
- Übersicht: vereinfachte Siedlungsflächen, einzelne Gebäude auslassen
- Footprint: einfache 2D-Grundrisse
- Portfolio: neutrales wiederverwendbares Erscheinungsbild für beobachtete Gebäude; typisierte Assets nur bei simulierter Funktion
- Detail: sichtbare/interaktive Objekte im nahen Ausschnitt
Zoom-Schwellwerte des isolierten Prototyps sind **keine** offiziellen Erd-Karten-Zoomstufen und müssen an deren Projektion angepasst werden.

## Performance-Budgets als Hypothesen, nicht als gemessene Werte
- Aus dem Sichtfenster und aus weit entfernten Kartenkacheln keine aufwendigen Sprites erzeugen.
- Viewport-Culling plus räumliche Indizes (statt linearem Scannen des gesamten Regionenbestands).
- Hartes Draw-Budget im Experiment (1200 Features); endgültig lieber tileweise budgetieren, sonst zufällige Auslassungen.
- Region-Cache und deduplizierte Abfragen pro Zoomstufe. Änderungen des Weltzustands separat invalidieren.
- Messwerte: Netzwerkantwort Größe und Dauer, Zahl aller/geladener/sichtbarer Features, Zeit GeoJSON->Features, React-Renderzeit, Speicher, Fehlermeldungen.
- Karte muss trotz fehlendem Portfolio-Asset Fußabdruck zeigen; Fehlermeldungen statt unbemerktem Weglassen.

## Diagnoseaufträge
1. Sundern: Netzwerkanfragen und Performanceprofil aus einem reproduzierbaren Besuch sichern; OSM-/DEM-Payload, Requests, Features, Renderzeiten und Cache-Treffer messen.
2. Frankfurt: abgleichen, ob Gebäude-Features von der Datenquelle geliefert, verarbeitet, gecullt oder gerendert werden. Keine Ursache ohne Messung behaupten.
3. Seelenberg: Import prüfen, Datenfenster mit echten Gebäudegeometrien verbinden und LOD-Prototyp an bestehende Earth-Komponenten anschließen.
4. Integrationstests: jeweils ein dichtes und ein ländliches Gebiet; Kartenpan, Zoom, Cache-Miss/Hit, fehlende Assets; später Sichtbarkeit bei gleichbleibender Weltgeometrie.
5. Priorisierte Karte: bei großen Ortsausschnitten nur sichtbare Features laden, per Zoom gestaffelt nachladen.

## Implementation Notes
Das isolierte Modul `experiments/seelenberg/building-presentation.mjs` dient als Test der Daten-/Darstellungstrennung. Es ist noch **kein** belastbarer räumlicher Index, keine korrekte Behandlung aller möglichen Polygonüberschneidungen und keine fertige Earth-Rendering-Integration.
