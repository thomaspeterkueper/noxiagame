# Teilprojekt Erdkarte – eine Welt

Ziel (Thomas, 13.10.2026): Die Kartendarstellung neu machen. Eine durchgehende Welt ohne Nachladen zwischendurch, flüssig im Browser. Reale Orte dürfen stark vereinfacht sein. Zeichentechnik: PixiJS. Gebäude als Baukasten aus Blöcken, die Thomas voraussichtlich selbst zeichnet.

Dieses Teilprojekt läuft als Prototyp **neben** der bestehenden begehbaren Erdszene (`app/earth/EarthWalkableSurface.tsx`) und ersetzt sie erst nach ausdrücklicher Entscheidung.

## Stand

Seite: `/world-lab` (nur angemeldet erreichbar, nicht aus dem Spiel verlinkt).

| Baustein | Ort |
|---|---|
| Koordinaten und Kachelraster (Web-Mercator, Stufe 17, rund 190 m je Kachel) | `lib/worldlab/mercator.ts` |
| Vereinfachung der Kartendaten zu einer Kachel | `lib/worldlab/simplify.ts`, Tests daneben |
| Baukasten: Aussehen je Blockart, Farben für Flächen und Straßen | `lib/worldlab/blocks.ts` |
| Kachel-Abruf | `GET /api/world-lab/tile?x=…&y=…` |
| NOXIA-Gebäude auf der Erde | `GET /api/world-lab/buildings` |
| Kartendaten für einen Ort nachladen (veraltete Regionen, Ortsdetail je Zelle von ≈ 667 m) | `POST /api/world-lab/refresh`, Raster in `lib/worldlab/detailCells.ts` |
| Ansicht (Bühne und Anzeige) | `app/world-lab/WorldLab.tsx` |
| Zeichenmaschine ohne React (Kacheln, Tiefe, Kamera, Messung) | `app/world-lab/worldEngine.ts` |
| Welche Kacheln der Bildschirm braucht, kleinster Zoom | `lib/worldlab/viewTiles.ts`, Tests daneben |
| Messung je Bild (Bildabstand, Logik, Zeichnen) | `lib/worldlab/frameStats.ts`, Tests daneben |
| Ansicht (2:1, Höhe √1,5) und Abbildung gezeichneter Bilder auf Wände und Dächer | `lib/worldlab/facade.ts`, Tests daneben |
| Zeichenvorlage (Maße, Regeln, Einbau) | `docs/workstreams/world-map-zeichenvorlage.md` |
| Vorlagen zum Übermalen | `public/worldlab/vorlagen/`, erzeugt von `scripts/worldlab-templates.py` |

Wie es arbeitet:

- **Kacheln statt Szenen.** Geladen ist, was der Bildschirm zeigt, plus ein schmaler Rand (und nach unten etwas mehr für hohe Gebäude). Beim Herauszoomen kommen Kacheln dazu; das Herauszoomen endet bei rund 60 Kacheln Bodenfläche (bei 1280 × 800 etwa Zoom 0,68). Neue Kacheln werden über mehrere Bilder verteilt aufgebaut, erst der Boden, dann die Blöcke in Portionen. Es wird nie die ganze Ansicht ersetzt.
- **Zeichengruppen.** Welt, Boden und jeder Tiefenstreifen der Objekte (32 m) sind eigene PixiJS-Zeichengruppen. Die Kamerabewegung rechnet die Grafikkarte; geht die Figur an einem Block vorbei, wird nur ihr Streifen neu sortiert.
- **Ein Koordinatensystem.** Die Position ist Web-Mercator; jede Kachel passt lückenlos an ihre Nachbarn. Es gibt keine Regionsanker und keine gemerkte Position je Szene.
- **Stark vereinfacht.** Straßen in drei Klassen (Hauptstraße, Straße, Weg), Flächen in 17 Arten (`AreaKind` in `simplify.ts`): Feld, Garten (Wohngebiet), bebaut (Gewerbe, Handel, Industrie), Wald, Wasser, Park, Spielplatz, Friedhof, Kleingärten, Parkplatz, Freibad, Sportanlage, Laufbahn, Rasenplatz, Sandplatz (Reiten), Hartplatz (Skaten, Basketball), Tennisplatz. Wald, Park, Friedhof, Kleingärten, Parkplatz und Acker tragen ein Muster (`lib/worldlab/areaPatterns.ts`, im Browser gezeichnet); Fußball- und Tennisplätze haben Linien. Naturschutzgebiete werden nicht gezeichnet (Gebietsgrenzen, keine Fläche), Gewässerlinien, Gebäude als Blöcke: Lage, Größe, Drehung, Art (Haus, Zeile, Halle, Kirche, Schuppen), Geschosse. Eine Kachel ist rund 1 kB groß.
- **Jedes Gebäude einmal.** Es gehört zu der Kachel, in der seine Mitte liegt; doppelt importierte Objekte werden nur einmal gezählt.
- **NOXIA-Gebäude** stehen mit ihren bestehenden Bildern an ihrer echten Position.

## Geprüft und nicht geprüft

- Geprüft: Kachelmathematik und Vereinfachung mit Tests; die Ansicht im Browser mit einer künstlichen Stadt (Laden, Laufen über Kachelgrenzen, Zoomen, keine Fehler).
- Seit dem ersten Lauf belegt: der Kachel-Abruf gegen die echte Datenbank. Noch offen: ob 60 Bilder je Sekunde erreichbar sind.

## Erster Lauf mit echten Daten (Thomas, 13.10.2026)

- Der Kachel-Abruf gegen die Datenbank funktioniert: Sundern erscheint mit Straßen, Flächen, Gewässern und 451 Gebäudeblöcken in 36 Kacheln; die NOXIA-Gebäude (Landeplätze, Solarfelder) stehen an ihrem Ort.
- Bildrate: schwankt zwischen etwa 22 und 60 Bildern je Sekunde, im Mittel um 30. Der Bildschirm begrenzt also nicht – die Zeichenleistung reicht nicht durchgehend. Verdächtig im Prototyp: Jeder Gebäudeblock ist ein eigenes Zeichenobjekt (hier 451), die Reihenfolge aller Objekte wird in jedem Bild neu sortiert, und beim Nachladen wird eine ganze Kachel in einem Bild aufgebaut (Einbrüche beim Laufen). Erst messen, dann ändern.
- Sichtbar wurde: Weit herausgezoomt reicht der geladene Bereich von 5 × 5 Kacheln nicht bis zum Bildrand. Der Ladebereich muss sich nach dem Zoom richten, oder der Zoom wird begrenzt.

## Leistung: Messung und Umbau (13.10.2026)

Messanzeige in `/world-lab`: Bilder je Sekunde, langsamstes Bild, Ruckler (Bilder über 25 ms), Zeit in der eigenen Logik, Zeit, die PixiJS zum Zeichnen auf dem Prozessor braucht, und wie oft je Sekunde eine Zeichenliste ganz neu aufgebaut wird. Lesart: Ist das Bild langsam, Logik und Zeichnen aber klein, wartet es auf die Grafikkarte. Dann helfen die Messschalter `?aa=0` (ohne Kantenglättung) und `?res=1` (ohne doppelte Pixeldichte), etwa `/world-lab?aa=0&res=1`.

Gemessen im Prüfaufbau (Chromium ohne Grafikkarte, künstliche Kacheln in Sundern-Dichte, bis 90 Blöcke je Kachel, 730 Blöcke geladen). Die Bildrate dort sagt nichts über einen echten Rechner, weil die Grafikkarte in Software läuft; aussagekräftig ist die Zeit auf dem Prozessor:

- Vorher: Beim Laufen wurden in **jedem Bild alle Ecken** aller Kacheln und Blöcke neu verpackt und hochgeladen (Kamera bewegt die ganze Welt auf dem Prozessor; die Tiefe der Figur ändert sich und erzwingt eine neue Sortierung und einen Neuaufbau aller Objekte). Im Profil: rund 6 ms je Bild allein dafür. Dazu ein Einbruch von über 100 ms, wenn Kacheln in einem Bild aufgebaut werden.
- Nachher: Kamerabewegung kostet auf dem Prozessor fast nichts; ein Neuaufbau betrifft nur noch den Tiefenstreifen der Figur (wenige Dutzend Blöcke). Im Profil beim Laufen gut 20 ms Rechenzeit in 6 Sekunden statt rund 180 ms. Der Kachelaufbau ist auf mehrere Bilder verteilt.

Auf Thomas' Rechner mit echten Daten (13.10.2026): je nach Zoom 11 bis 50 Bilder je Sekunde, für Thomas ausreichend. Lage geprüft: Das Metallwerk Sundern (MESU) steht an der richtigen Stelle, das Röhrtalstadion davor ebenfalls – es fehlt aber als Fläche (siehe Aufgabe 8).

## Rückmeldung an der Bogenstraße (Thomas, 13.10.2026 abends)

- Wohnstraßen erschienen beim Laden kurz und verschwanden dann: Jede Kachel zeichnete große Flächen (Wohngebiet, Wald) ungeschnitten und deckte damit die Straßen früher geladener Nachbarn zu. Behoben – Flächen werden auf ihre Kachel zugeschnitten, Straßen und Gewässer liegen in einer eigenen Ebene darüber. Nebenbei zeichnet die Grafikkarte weniger übereinander.
- Die blauen Blöcke waren Straßenstücke aus dem alten Bausystem (`tile_entities` mit `entity_id = 'road'`). `/world-lab` zeigt sie nicht mehr.
- Ein NOXIA-Gebäude, das auf einem echten Gebäude steht, übernimmt dessen Grundriss und Drehung und bekommt sein eigenes Dach (`NOXIA_LOOKS` in `lib/worldlab/blocks.ts`). Bogenstraße 15 (`ssf_headquarters_sundern`): eingeschossig, dunkelblaues Walmdach. Ohne echtes Gegenstück bleibt das bisherige Bild, ein Ersatzblock folgt jetzt `rotation_deg`.

## Offene Aufgaben

1. ~~Messen, wo die Zeit bleibt; Zeichenleistung umbauen; Ladebereich an den Zoom koppeln.~~ Erledigt (siehe „Leistung“). Offen: Thomas misst in `/world-lab` beim Laufen durch Sundern (Bildrate, langsamstes Bild, Ruckler; bei Bedarf mit `?aa=0` und `?res=1`) und prüft dabei, ob Straßen und Blöcke an der richtigen Stelle stehen. Reicht es nicht für stabile 60, zeigt die Anzeige, ob Prozessor oder Grafikkarte die Grenze ist.
2. ~~Zeichenvorlage festlegen, Blöcke auf Bilder umstellen.~~ Erledigt: Fassaden von vorn, 2:1 geometrisch richtig, 16 px je Meter (siehe `world-map-zeichenvorlage.md`). Wände und Dächer nehmen gezeichnete Bilder an; bis Thomas' eigene Zeichnungen da sind, zeigt die Karte die Vorlagen (`?art=farbe` für einfarbige Quader). Offen: Thomas zeichnet die ersten Bilder.
3. Kacheln vorab erzeugen und als Dateien ablegen statt bei jedem ersten Abruf aus der Datenbank zu rechnen.
4. Kollision und Wegenetz (im Prototyp läuft die Figur durch alles hindurch).
5. Personen, Ansprechen, „Gehe hin“, Betreten von Gebäuden – erst wenn die Darstellung trägt.
6. Weite Strecken: Der Zeichenanker liegt fest am Startpunkt; für Reisen über viele Kilometer muss er mitwandern.
7. ~~Datenlücke~~ Teilweise erledigt: `/world-lab` holt Ortsdetail (Gebäude, Wohnstraßen, Wege) selbst nach – beim Start für die Zelle um die Figur, in bebauten Kacheln ohne Gebäude selbsttätig, sonst mit „Kartendaten hier nachladen“. Offen: prüfen, ob Overpass zuverlässig antwortet; Zellen ohne Bebauung werden nicht geholt.
8. Sportplätze: Import und Darstellung gebaut (Sportanlage, Laufbahn, Spielfeld; Importprofil 4). Die veraltete Region Sauerland erneuert `/world-lab` beim Start selbst. Offen: prüfen, ob das Röhrtalstadion erscheint (`internal-tasks/open/REQ-NOXIA-20261013-world-map-sport-reimport.md`).
9. Kirchen haben jetzt einen Turm an der Stirnseite (geschätzt, OSM sagt nicht, wo er steht), Höhen aus OSM `height` werden genutzt. Einzelbilder für besondere Gebäude (Kirche, Bahnhof, Café, NOXIA-Gebäude): ganzes Bild in derselben Ansicht mit Fußpunkt, statt aus Wandstücken zusammengesetzt. Maße stehen in der Zeichenvorlage.
10. Häuser vor der Figur durchscheinend machen, damit sie in engen Gassen sichtbar bleibt (die richtige Höhe verdeckt mehr Straße).
11. Gescheiterte Kartenabrufe nachholen: gebaut als stündlicher Lauf `/api/cron/world-places` (vercel.json, Minute 25). Er nimmt je Lauf höchstens zwei leere Orte aus `celestial_regions` und versucht sie über die bestehenden Importwege erneut, jeden frühestens drei Stunden nach dem letzten Versuch. Betroffen beim Start: Frankfurt (50,1106 / 8,6821), Darmstadt (49,9915 / 8,6667), Datong (40,0923 / 113,2953) und fünf leere Ortsdetail-Zellen in Sundern, u. a. die Innenstadt (51,327 / 8,0032). Offen: nach einigen Läufen prüfen, ob alle gefüllt sind; Ergebnis steht im Vercel-Log unter `[world-places]`.
12. ~~Fabriken und Sportplatz~~ Erledigt (13.10.2026): Industriebauten als Fabrik mit Wellblech, Fensterband, Rolltor und Sheddach; verwinkelte Hallen und Fabriken mit echtem Grundriss (das Rechteck um das Metallwerk deckte vorher den Sportplatz zu). Fußballplätze bekommen Mittellinie, Anstoßkreis, Straf- und Torräume. Offen: Laufbahnen und andere Sportarten (Tennis, Reitplatz) ohne Markierung.
13. ~~Andere Plätze und Parks~~ Erledigt (14.10.2026): Importprofil 5 holt Spielplätze, Gärten, Freibäder, Friedhöfe, Kleingärten, Rasen, Festplätze und Parkplätze (`feature_type = 'place_area'`); jede Sportart hat ihre Fläche. Regionen mit Profil 4 werden beim Öffnen von `/world-lab` neu aufgebaut. Offen: Laufbahn als Oval um ein Spielfeld (OSM liefert sie meist als Ring), Bäume auch außerhalb des Waldes (Alleen, Einzelbäume).

## Nicht in diesem Teilprojekt

- Innenräume (Teilprojekt Gastronomie für Café, Bar, Restaurant).
- Bevölkerung, Bedürfnisse, Geld.
