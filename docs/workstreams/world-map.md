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
| Ansicht | `app/world-lab/WorldLab.tsx` |

Wie es arbeitet:

- **Kacheln statt Szenen.** Um die Spielfigur sind immer 5 × 5 Kacheln geladen. Neue kommen am Rand dazu, entfernte fallen weg. Es wird nie die ganze Ansicht ersetzt.
- **Ein Koordinatensystem.** Die Position ist Web-Mercator; jede Kachel passt lückenlos an ihre Nachbarn. Es gibt keine Regionsanker und keine gemerkte Position je Szene.
- **Stark vereinfacht.** Straßen in drei Klassen (Hauptstraße, Straße, Weg), Flächen in vier Arten (Feld, bebaut, Wald, Wasser), Gewässerlinien, Gebäude als Blöcke: Lage, Größe, Drehung, Art (Haus, Zeile, Halle, Kirche, Schuppen), Geschosse. Eine Kachel ist rund 1 kB groß.
- **Jedes Gebäude einmal.** Es gehört zu der Kachel, in der seine Mitte liegt; doppelt importierte Objekte werden nur einmal gezählt.
- **NOXIA-Gebäude** stehen mit ihren bestehenden Bildern an ihrer echten Position.

## Geprüft und nicht geprüft

- Geprüft: Kachelmathematik und Vereinfachung mit Tests; die Ansicht im Browser mit einer künstlichen Stadt (Laden, Laufen über Kachelgrenzen, Zoomen, keine Fehler).
- **Nicht geprüft:** der Kachel-Abruf gegen die echte Datenbank und die Bildrate auf einer echten Grafikkarte. Der Testbrowser rechnet ohne Grafikkarte und kam nur auf wenige Bilder je Sekunde – das sagt nichts über einen normalen Rechner, belegt aber auch keine 60.

## Offene Aufgaben

1. Im Browser prüfen: `/world-lab` öffnen, durch Sundern laufen. Stimmt die Bildrate, laden die Kacheln, stehen Straßen und Blöcke an der richtigen Stelle?
2. Zeichenvorlage für den Baukasten: Blickwinkel (heute 2:1), Fußpunkt, Pixel je Meter und Geschosshöhe festlegen, bevor Blöcke gezeichnet werden. Dann `blocks.ts` von gezeichneten Quadern auf Bilder umstellen.
3. Kacheln vorab erzeugen und als Dateien ablegen statt bei jedem ersten Abruf aus der Datenbank zu rechnen.
4. Kollision und Wegenetz (im Prototyp läuft die Figur durch alles hindurch).
5. Personen, Ansprechen, „Gehe hin“, Betreten von Gebäuden – erst wenn die Darstellung trägt.
6. Weite Strecken: Der Zeichenanker liegt fest am Startpunkt; für Reisen über viele Kilometer muss er mitwandern.
7. Datenlücke: Echte Gebäudeumrisse gibt es bisher nur an einzelnen Stellen (Sundern Mitte und drei kleine Ausschnitte). Außerhalb zeigt die Karte Straßen und Flächen, aber keine Blöcke.

## Nicht in diesem Teilprojekt

- Innenräume (Teilprojekt Gastronomie für Café, Bar, Restaurant).
- Bevölkerung, Bedürfnisse, Geld.
