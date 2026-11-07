# Earth Building LOD – Seelenberg, Sundern, Frankfurt

Status: Experimental / nicht in Runtime integriert (2026-10-29).

## Verbindliche Trennung
1. Realität: OSM-Polygone/-Wege mit Quellenzeitpunkt und Lizenz.
2. Darstellung: neutrale Footprints oder generische Baukörper je Zoom, kein Schluss aus Architektur auf reale Nutzung.
3. Spiel: aufgesetzte Instanzen mit Building-ID, Capability und eigenem Core-Zustand. Nur diese dürfen eine funktionale Portfolio-Grafik bekommen.

## Neuer Viewport-Versuch
`experiments/seelenberg/building-viewport.mjs` berücksichtigt überlappende Gebäude-Bounding-Boxes auch dann, wenn kein Eckpunkt im Viewport liegt; sortiert selektierte und simulierte Objekte vor neutralen und legt ein stabiles Draw-Budget an. Dieser konservative Filter kann Nichttreffer enthalten; geometrisch exakte Schnittprüfung sowie räumlicher Index stehen noch aus. Für große Ballungsräume lineares Scannen ersetzen durch Tile-/R-Tree-Abfrage.

## Performance-Diagnose zuerst, Optimierung danach
Je Karten-Request oder Render-Phase zählen und messen: `location`, `zoom`, `bbox`, Provider-Antwortzeit, Bytes, Featurezahl vor/nach Parsing, Fehlerrate/Timeout, sichtbare Gebäude nach Culling, gezeichnete Objekte, JS-Main-Thread-Dauer, Memory/Cache-Hit. Keine Roh-Identifikationsdaten von Spielern loggen.

Hypothesen:
- **Frankfurt:** Daten fehlen möglicherweise bereits in Query, Begrenzung oder Parser; als Erstes Source-Response vs. Renderer vergleichen, Null-Ergebnis explizit kennzeichnen.
- **Sundern:** Größe/Häufigkeit von Provider-Requests, übermäßige Asset-Instanzen oder Terrain-Parsing könnten belasten; zunächst messen.
- **Seelenberg:** Erst Quell-Snapshot mit Provenienz, dann gleiche Pipeline wie Großstadt, nicht eigens entworfene Spielwelt.

## Freigabekriterien
- Stadtgebiet groß und Dorf klein: sichtbare Gebäude nachvollziehbar, ohne unbemerkten Datenausfall.
- Fehlende Kartenantwort und vorhandene aber ausgeblendete Gebäude bekommen unterschiedliche Diagnosesignale.
- Wiederverwendete Assets werden gecacht und nach Zoom aktiviert.
- Kollision realer Footprints mit neu gebauten Spielobjekten wird explizit geprüft.
- Portfolio-/Game-Overlay darf niemals die OSM-Daten überschreiben.
- CI/Testresultat separat prüfen; kein Aussage über produktive Performance ohne echte Browser-Messung.
