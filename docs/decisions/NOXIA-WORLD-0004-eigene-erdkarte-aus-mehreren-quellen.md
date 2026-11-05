# NOXIA-WORLD-0004 – Eigene Erdkarte aus mehreren Quellen

**Datum:** 05.11.2026
**Status:** Angenommen (Thomas, 05.11.2026) – Reihenfolge und Quellenregel entschieden
**Version:** 0.2.0
**Teilprojekt:** Erdkarte – eine Welt (`docs/workstreams/world-map.md`)

---

## Anlass

Thomas, 05.11.2026 (Chat):

> „ich denke wir sollten generell nur einmal eine karte holen, alternativ eine chronofunktion einbauen, die kartendaten die wir tatsächlich für das spiel nutzen sollten dann aufbereitet und vereinfacht gespeichert werden. zukünftig dann nur noch unsere eigenen daten verwenden. langfristig vielleicht einen karteneditor integrieren, wo wir aktualisieren mit neusten karten und auch anpassungen von strassen flüssen häusern usw machen können“

> „wir haben ja nicht nur openstreetmap, sondern auch katasterdaten, höhendaten und je nach möglichkeit und land auch noch andere ressourcen, höhenkarten, historische daten, usw, wir sollten das alles vielleicht in einer täglichen aufgabe ergänzen und einbauen und daraus unsere eigene karte entwickeln, zur zeit sieht zb das sauerland flach aus, obwohl es das nicht ist“

Auslöser: Jeder Seitenaufruf in Sundern versuchte, die Region Sauerland neu aus OpenStreetMap aufzubauen (Importprofil 4 → 6), und scheiterte nach rund 37 s (Behelf vom 05.11.2026: höchstens alle sechs Stunden, Commit de6b11e3).

## Stand (05.11.2026, geprüft in Code und Datenbank)

| Quelle | Was wir haben | Wo | Genutzt in der Karte |
|---|---|---|---|
| OpenStreetMap (Overpass) | Regionen (Straßen, Flächen, Gewässer, Gebäude) und Ortsdetail-Zellen ≈ 667 m; nur das **eingeordnete Ergebnis** wird gespeichert, keine Rohdaten | `celestial_regions`, `region_features`; `lib/world/spatial/earthPlaceMaterializer.server.ts`, `earthLocalEnrichment.server.ts` | ja (Kacheln ≈ 1 kB, `lib/worldlab/simplify.ts`) |
| Liegenschaftskataster (ALKIS vereinfacht, je Land) | 4.550 Flurstücke in 24 Zellen | `earth_parcels`, `earth_parcel_cells`; `lib/worldlab/alkis.ts` | ja (Kaufen, Bauen) |
| Höhe (Open-Meteo, Copernicus-DEM 90 m) | **nur zwei Raster**: Sauerland und Erongo, je 18 × 18 Punkte (≈ 1,6 km), seit 16.09.2026 unverändert | `region_elevation`; `lib/world/spatial/openMeteoElevationSource.ts`, `/api/admin/import-elevation` | **nein** – die Weltkarte zeichnet flach; Höhe nur in Bebaubarkeit und Standortprüfung |
| Overture Maps, GlobalBuildingAtlas | nur einmal für Dwarka abgeglichen, nicht übernommen (Lizenz offen) | `world-map.md`, 02.11.2026 | nein |
| Historische Daten | Gebäudechronik mit belegten Abrissen, Zeitregler | `app/world-lab/TimeSlider.tsx`, Issue #541 | ja, nur Abrisse |

Was heute gegen den Grundsatz „unsere Daten“ läuft:

1. **Automatisches Nachholen beim Profilwechsel.** Wird `EARTH_GEOGRAPHY_IMPORT_VERSION` hochgezählt, holt das Spiel jede ältere Region mit wartendem Spieler neu aus OSM.
2. **Keine Rohdaten.** Eine bessere Einordnung (z. B. Sportflächen seit Profil 4) geht nur über einen neuen Abruf.
3. **Höhe ist keine Kartenschicht.** Sie liegt nur punktuell vor und wird nicht gezeichnet – deshalb sieht das Sauerland flach aus.

## Vorschlag

### 1. Einmal holen, dann gehört die Karte uns

- Jeder Abruf aus einer fremden Quelle ist ein **Rohimport**: Antwort unverändert speichern (komprimiert), mit Quelle, Abrufdatum, Ausschnitt und Lizenzvermerk.
- Aus den Rohimporten **leiten wir** unsere Karte ab (Einordnung, Vereinfachung, Zusammenführen). Eine neue Einordnungsregel wird aus dem Bestand neu berechnet – ohne neuen Abruf.
- Das Spiel fragt mit wartendem Spieler **nur**, wenn es an einer Stelle noch gar nichts gibt (erster Besuch). Kein Nachholen wegen Versionswechsel.

### 2. Schichten statt einer einzigen Quelle

Die eigene Karte setzt sich aus Schichten zusammen; jede hat eine bevorzugte Quelle je Land und eine Rangfolge, wenn zwei Quellen sich widersprechen.

| Schicht | Quellen (Rangfolge zu prüfen) |
|---|---|
| Gelände (Höhe) | amtliche Geländemodelle der Länder (z. B. DGM1 NRW, offen), sonst Copernicus-DEM 30 m bzw. 90 m |
| Grenzen und Flurstücke | ALKIS je Land; außerhalb Deutschlands: zu prüfen |
| Gebäude | amtliche Hausumringe/LoD, wo offen; sonst OSM; Overture nur nach Lizenzklärung |
| Straßen, Wege, Bahn, Gewässer, Flächen | OSM |
| Geschichte | belegte Spielereignisse; historische Karten und Daten je Land, wo die Lizenz es erlaubt (zu prüfen) |
| Eigene Änderungen | Spielgeschehen und Editor (siehe 4) – gehen immer vor |

Welche Dienste je Land offen, erreichbar und lizenzrechtlich nutzbar sind, wird vor dem Einbau geprüft und hier nachgetragen.

### 3. Tägliche Aufgabe statt Abrufen beim Spielen

- Ein Lauf einmal am Tag (zusätzlich zum stündlichen `cron/world-places`) ergänzt Schicht für Schicht: zuerst die Orte, an denen Spieler oder Bewohner tatsächlich sind, und Reiseziele, dann die Ringe rundum.
- Je Lauf nur so viel, wie die öffentlichen Dienste vertragen; Fehlversuche frühestens am nächsten Tag erneut.
- Jeder Lauf schreibt ein kurzes Protokoll (was geholt, was gescheitert, wie viel), damit sichtbar bleibt, wie die Karte wächst.

### 4. Chronofunktion

- Jedes Objekt (Straße, Fluss, Haus, Fläche, Flurstück) ist eine Folge von **Fassungen** mit *gültig ab*, *gültig bis* und *Herkunft* (Rohimport vom Datum X, Spielereignis, Bearbeitung durch Thomas).
- Ein neuer Rohimport überschreibt nichts; er erzeugt neue Fassungen nur dort, wo sich etwas geändert hat.
- Der vorhandene Zeitregler wird von Abrissen auf alle Fassungen erweitert. Passt zur Chronomap (Dvaraka: Grabung und Rekonstruktion am selben Ort).

### 5. Karteneditor (später)

- Straßen, Flüsse, Häuser, Flächen im Spiel anpassen; jede Änderung ist eine Fassung mit Herkunft „Editor“.
- „Aktualisieren“ holt einen neuen Rohimport und zeigt nur die **Unterschiede** als Vorschlag; übernommen wird Stück für Stück. Eigene Änderungen bleiben stehen.

### 6. Gelände sichtbar machen (erster spürbarer Schritt)

- Höhe als Schicht für jede Kachel (Raster passend zum Kachelraster), aus der besten verfügbaren Quelle.
- In der Weltkarte zuerst als **Geländeschattierung und Höhenstufen** auf dem Boden (Hänge, Täler, Kuppen sichtbar), Gebäude auf ihrer Geländehöhe; echte Höhenverschiebung der Kacheln in der 2:1-Ansicht erst danach (größerer Umbau der Zeichenmaschine).
- Steigung später auch spielwirksam (Laufen, Bebaubarkeit – dort ist sie schon angelegt).

## Erste Aufgaben (Reihenfolge)

1. Automatisches Nachholen wegen Versionswechsel abschalten (`/api/world-lab/refresh`): mit wartendem Spieler nur noch erster Besuch.
2. Rohimporte speichern (Tabelle, Quelle, Datum, Lizenz) – zuerst für OSM-Abrufe.
3. Neuableitung aus Rohimporten statt neuem Abruf; das Sauerland einmal neu holen und danach nur noch ableiten.
4. Höhenschicht je Kachel für Sundern/Sauerland aus einem amtlichen Geländemodell, Geländeschattierung in der Weltkarte.
5. Täglicher Ergänzungslauf mit Protokoll (zunächst Höhe und Flurstücke um besuchte Orte).
6. Quellenübersicht je Land (offen, erreichbar, Lizenz) – Deutschland zuerst.
7. Fassungen mit *gültig ab/bis* (Chronofunktion), dann Zeitregler erweitern.
8. Karteneditor – eigenes Vorhaben nach 1–7.

## Entscheidungen von Thomas (05.11.2026)

1. **Gelände zuerst.** Schritt 4 kommt vor den Rohimporten (2–3).
2. **Jede Quelle im Einzelfall prüfen** (Lizenz, Erreichbarkeit, Nutzungsbedingungen) – keine pauschale Beschränkung auf offene Lizenzen. Ergebnis je Quelle unten in „Quellenprüfung“.
3. **Historische Daten** für Deutschland und ausgewählte Gegenden, z. B. Istanbul/Konstantinopel und Malta.

## Quellenprüfung

| Quelle | Schicht | Ergebnis | Stand |
|---|---|---|---|
| Open-Meteo Elevation API (Copernicus DEM GLO-90) | Gelände | Daten unter Copernicus-Lizenz mit Quellenvermerk, Open-Meteo CC BY 4.0; kostenloser Zugang nur nicht-kommerziell, bis 10.000 Anfragen/Tag. Für die Alpha in Ordnung; vor kommerzieller Nutzung ablösen (Copernicus direkt oder amtliche Modelle). | 05.11.2026 |
| DGM1 NRW (Geobasis NRW) | Gelände | als nächste Quelle für Sundern vorgesehen; Lizenz und Abrufweg (WCS/Kacheln) noch zu prüfen | offen |

## Umsetzung Schritt 4, erster Teil (05.11.2026)

- Höhenzellen: Kachelstufe 15 (≈ 760 m), 9 × 9 Punkte (≈ 95 m), Tabelle `earth_terrain_cells` (Rohwerte mit Quelle, Datensatz, Lizenz), Fehlversuche in `earth_terrain_misses` (frühestens nach einem Tag erneut). Migration `20261105120000_earth_terrain_cells.sql`.
- Holen: beim ersten Besuch 3 × 3 Zellen um den Spieler (`/api/world-lab/refresh`), sonst täglich (`/api/cron/world-terrain`, 03:17 UTC): Spielerwege der letzten 14 Tage, NOXIA-Gebäude, benannte Orte; höchstens 300 Zellen je Lauf.
- Karte: jede Kachel bekommt 9 × 9 Eckhöhen (`lib/worldlab/terrain.ts`, nicht Teil von `world_tiles`); gezeichnet als Hangschattierung (Licht aus Nordwesten, zweifach überhöht) und Höhenlinien alle 10 m, jede 50-m-Linie kräftiger. Kacheln bleiben flach.
- Noch nicht: Gebäude auf Geländehöhe, echte Höhenverschiebung in der 2:1-Ansicht, Steigung beim Laufen.
