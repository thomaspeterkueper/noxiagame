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
| Ansicht (Bühne und Anzeige) | `app/world-lab/WorldLab.tsx` |
| Zeichenmaschine ohne React (Kacheln, Tiefe, Kamera, Messung) | `app/world-lab/worldEngine.ts` |
| Welche Kacheln der Bildschirm braucht, kleinster Zoom | `lib/worldlab/viewTiles.ts`, Tests daneben |
| Messung je Bild (Bildabstand, Logik, Zeichnen) | `lib/worldlab/frameStats.ts`, Tests daneben |

Wie es arbeitet:

- **Kacheln statt Szenen.** Geladen ist, was der Bildschirm zeigt, plus ein schmaler Rand (und nach unten etwas mehr für hohe Gebäude). Beim Herauszoomen kommen Kacheln dazu; das Herauszoomen endet bei rund 60 Kacheln Bodenfläche (bei 1280 × 800 etwa Zoom 0,68). Neue Kacheln werden über mehrere Bilder verteilt aufgebaut, erst der Boden, dann die Blöcke in Portionen. Es wird nie die ganze Ansicht ersetzt.
- **Zeichengruppen.** Welt, Boden und jeder Tiefenstreifen der Objekte (32 m) sind eigene PixiJS-Zeichengruppen. Die Kamerabewegung rechnet die Grafikkarte; geht die Figur an einem Block vorbei, wird nur ihr Streifen neu sortiert.
- **Ein Koordinatensystem.** Die Position ist Web-Mercator; jede Kachel passt lückenlos an ihre Nachbarn. Es gibt keine Regionsanker und keine gemerkte Position je Szene.
- **Stark vereinfacht.** Straßen in drei Klassen (Hauptstraße, Straße, Weg), Flächen in vier Arten (Feld, bebaut, Wald, Wasser), Gewässerlinien, Gebäude als Blöcke: Lage, Größe, Drehung, Art (Haus, Zeile, Halle, Kirche, Schuppen), Geschosse. Eine Kachel ist rund 1 kB groß.
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

## Offene Aufgaben

1. ~~Messen, wo die Zeit bleibt; Zeichenleistung umbauen; Ladebereich an den Zoom koppeln.~~ Erledigt (siehe „Leistung“). Offen: Thomas misst in `/world-lab` beim Laufen durch Sundern (Bildrate, langsamstes Bild, Ruckler; bei Bedarf mit `?aa=0` und `?res=1`) und prüft dabei, ob Straßen und Blöcke an der richtigen Stelle stehen. Reicht es nicht für stabile 60, zeigt die Anzeige, ob Prozessor oder Grafikkarte die Grenze ist.
2. Zeichenvorlage für den Baukasten: Blickwinkel (heute 2:1), Fußpunkt, Pixel je Meter und Geschosshöhe festlegen, bevor Blöcke gezeichnet werden. Dann `blocks.ts` von gezeichneten Quadern auf Bilder umstellen.
3. Kacheln vorab erzeugen und als Dateien ablegen statt bei jedem ersten Abruf aus der Datenbank zu rechnen.
4. Kollision und Wegenetz (im Prototyp läuft die Figur durch alles hindurch).
5. Personen, Ansprechen, „Gehe hin“, Betreten von Gebäuden – erst wenn die Darstellung trägt.
6. Weite Strecken: Der Zeichenanker liegt fest am Startpunkt; für Reisen über viele Kilometer muss er mitwandern.
7. Datenlücke: Echte Gebäudeumrisse gibt es bisher nur an einzelnen Stellen (Sundern Mitte und drei kleine Ausschnitte). Außerhalb zeigt die Karte Straßen und Flächen, aber keine Blöcke.
8. Sportplätze fehlen: Der Import (`scripts/import-earth-region.mjs`) übernimmt keine Sportflächen (`leisure=pitch|stadium|track|sports_centre`). Das Röhrtalstadion erscheint deshalb als beige Wohnfläche. Vorschlag: fünfte Flächenart „Sportplatz“ (Rasen mit hellen Linien, Laufbahn rotbraun) in `simplify.ts` und `blocks.ts`, danach Sundern neu importieren. Der Import braucht Zugang zu Overpass und läuft deshalb nicht aus der Claude-Umgebung.

## Nicht in diesem Teilprojekt

- Innenräume (Teilprojekt Gastronomie für Café, Bar, Restaurant).
- Bevölkerung, Bedürfnisse, Geld.
