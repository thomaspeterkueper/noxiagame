# Seelenberg – OSM-Import und Integration (Pilot 01)

Status 2026-10-27: Offline-Importer und Unit-Testdatei im Feature-Branch angelegt. Noch **kein echter OSM-Snapshot importiert**, keine CI-Ausführung belegt, keine Supabase-Migration und keine Live-Ausspielung.

## Datengrundlage und Provenienz
- Test-Bounding-Box (WGS84, south/west/north/east): 50.25418, 8.40432, 50.26766, 8.42540. Das ist ein experimenteller Ausschnitt, keine Stadtteil- oder Grundstücksgrenze.
- Quelle: OpenStreetMap, Overpass JSON, mit Rohdatenzeitstempel. Attribution: © OpenStreetMap contributors, ODbL.
- Gebäude, Straßen und Landnutzung bleiben Beobachtungen, während Betriebe und NPCs ausschließlich markierte Spielobjekte sind.
- Vor Lizenzfreigabe für produktive Veröffentlichung ODbL- und etwaige Datenbankrechte sowie Attributionsanzeige prüfen.
- Aktuelle Koordinaten sind ein vorläufiges Pilotfenster und müssen gegen reale Dorfgrenzen und Kartendaten validiert werden.

## Reproduzierbarer Import
1. Anfrage mit `overpassQuery()` aus `experiments/seelenberg/import-osm.mjs` erzeugen.
2. Query gegen einen zulässigen Overpass-Endpunkt ausführen, Ergebnis als `snapshot.overpass.json` archivieren und Hash, Zeitpunkt, URL, Lizenz dokumentieren. Keine automatischen Massenabfragen.
3. `node experiments/seelenberg/import-osm.mjs snapshot.overpass.json > seelenberg.geojson`
4. `node --test experiments/seelenberg/import-osm.test.mjs experiments/seelenberg/simulation.test.mjs`
5. Anzahl fehlender Nodes im Output prüfen; fehlende Geometrien dürfen nicht stillschweigend ergänzt werden.
6. Erst nach der fachlichen Prüfung auf die bestehende Earth-Region-Pipeline abbilden; **keine neue Runtime-Quelle** schaffen.

## Integrationsorte (vor Live-Änderung prüfen)
- Earth: bestehende OSM-Region-Geometrie und `lib/world/spatial/earthMapInteraction.ts`.
- Routenpolitik: `lib/game/earthSurfaceLogistics.ts` einschließlich Access-Tags, Vehicle Envelope und Straßenklassifikation.
- Core: vorhandene Inventar-, Tick- und Transportjobs. Keine zweite Wirtschaftssimulation.
- Darstellung: strategische Ansicht und Walkable-Layer als Projektion desselben Zustandes.

## Sperrkriterien
- tatsächliche OSM-Geometrie nicht validiert
- unvollständige Knoten oder unvollständige Wege
- Straßentags als öffentliche Befahrbarkeit missverstanden (Zugang und rechtliche Nutzbarkeit separat prüfen)
- fiktive Einrichtung an reales privates Gebäude gekoppelt
- fehlender deterministischer Integrationstest gegen Core-Tick und Logistik
- fehlende Provenienz und ODbL-Attribution

## Folgeaufgabe
Stufe 2: Realen OSM-Snapshot mit dokumentiertem Zeitpunkt einspielen, Gebäudepolygone/Wege prüfen, zwei fiktive Piloteinrichtungen an zulässige Standorte binden, eine Route auf realem Wegenetz berechnen und Simulation mit Core-Frachtbuchung testen.
