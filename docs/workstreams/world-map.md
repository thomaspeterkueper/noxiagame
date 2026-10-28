# Teilprojekt Erdkarte – eine Welt

Ziel (Thomas, 13.10.2026): Die Kartendarstellung neu machen. Eine durchgehende Welt ohne Nachladen zwischendurch, flüssig im Browser. Reale Orte dürfen stark vereinfacht sein. Zeichentechnik: PixiJS. Gebäude als Baukasten aus Blöcken, die Thomas voraussichtlich selbst zeichnet.

Dieses Teilprojekt läuft als Prototyp **neben** der bestehenden begehbaren Erdszene (`app/earth/EarthWalkableSurface.tsx`) und ersetzt sie erst nach ausdrücklicher Entscheidung.

## Stand

Seite: `/world-lab` (nur angemeldet erreichbar).

Im Spiel (Thomas, 18.10.2026: „daneben als Weltkarte“): Auf der Erde zeigt das Dashboard weiter die bisherige begehbare Erdszene; ein Knopf „◇ Neue Weltkarte“ oben in der Mitte schaltet auf die neue Karte, „← Bisherige Erdszene“ im Feld der Karte zurück. Die Wahl bleibt im Browser gespeichert (`noxia-earth-view-v1`). Eingebaut in `app/dashboard/DashboardPrimaryColony.tsx`; `EarthWalkableSurface.tsx` ist unverändert. Die alte Szene wird erst ersetzt, wenn die neue Karte Bewohner, Ansprechen und Betreten kann (Aufgabe 5).

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
3. ~~Kacheln vorab erzeugen~~ Gebaut (27.10.2026): Die Grundkachel (Straßen, Flächen, Gebäude, Orte) liegt fertig in der Tabelle `world_tiles`; Flurstücke werden je Abruf frisch dazugelesen, weil Spieler sie ändern. `loadTile` in `lib/worldlab/tileSource.server.ts` nimmt die abgelegte Kachel, solange sie gültig ist, sonst rechnet es sie und legt sie ab. Gültig heißt:
   - gleiches Kachelformat (`TILE_FORMAT` in `lib/worldlab/tileFormat.ts`). **Wer `simplify.ts`, `lineDetails.server.ts` oder `mercator.ts` ändert, muss `TILE_FORMAT` erhöhen** – `tileFormat.test.ts` schlägt sonst fehl und nennt den neuen Fingerabdruck;
   - dieselben Regionen, keine davon mit geänderten Objekten: Trigger auf `region_features` zählen `world_tile_region_revs` je Region hoch (jeder Schreibweg: Import, Ortsdetail, Nachladen, Cron);
   - keine neue genaue Linie im Ausschnitt: ein Trigger auf `earth_line_details` löscht die betroffenen Kacheln.
   - Vorab erzeugt: `/api/cron/world-tiles` (stündlich, Minute 40) legt 5 × 5 Kacheln um jedes NOXIA-Gebäude der Erde ab, je Lauf höchstens 60 neue. Ergebnis im Vercel-Log unter `[world-tiles]`.
   - Als Tabelle statt als Dateien, weil die Gültigkeit je Kachel geprüft werden muss; das CDN vor `/api/world-lab/tile` bleibt.
   - Geprüft: Trigger in der Datenbank (Probezeile, zurückgerollt), Gültigkeitsregeln mit Tests. Noch nicht geprüft: Ablegen und Lesen gegen die echte Datenbank – nach dem nächsten Deploy `select count(*) from world_tiles` ansehen.
4. ~~Kollision und Wegenetz~~ Gebaut (25.10.2026), `lib/worldlab/walking.ts` (mit Tests):
   - Häuser der geladenen Kacheln sind Hindernisse (echter Grundriss oder Rechteck mit 0,5 m Abstand); die Figur gleitet an Wänden entlang, mit Tasten wie mit „Gehe hin“.
   - „Gehe hin“ geht bis 30 m gerade, weiter entlang der Straßen (Straßennetz der geladenen Kacheln, Suche A*); bewegt sich das Ziel (Person) mehr als 12 m, wird neu geplant. Hängt die Figur fest, nimmt sie den nächsten Wegpunkt; liegt das Ziel hinter einer Wand, gilt „so nah wie möglich“ als angekommen.
   - Personen, die ein Gespräch irgendwohin schickt, gehen ebenfalls die Straßen entlang (Dauer wächst mit dem Umweg, höchstens dreifach).
   - Offen: Fußwege ohne Straße (Wiesen, Plätze) kennt das Netz nicht – dort geht man gerade.
5. ~~Personen, Ansprechen, „Gehe hin“, Betreten~~ Gebaut (25.10.2026), `app/world-lab/WorldPanels.tsx`:
   - Bewohner (bis 18, wie in der alten Szene) stehen vor ihrem NOXIA-Zuhause oder ihrer Arbeit, die anderen gehen die Straßen der geladenen Kacheln entlang. Beschriftung wie in der alten Szene (`personSceneLabel`).
   - Klick auf Person: Tafel mit Tätigkeit und Gespräch; ansprechen ab 8 m (`/api/game/npc-conversation`, dieselben Felder wie die alte Szene), sonst „Gehe hin“. Antworten mit `visit_place` schicken die Person zum Gebäude; wer mitgeht, ist beim Betreten Begleitung.
   - Klick auf Gebäude: Name, Anschrift (OSM `addr:*`), bei NOXIA-Gebäuden „Betreten“ ab 8 m (oder F/Enter), sonst „Gehe hin“. Betreten öffnet `EarthBuildingAccessLayer` wie in der alten Szene.
   - **Immer nur eine Tafel** (Thomas, 25.10.2026: in der alten Karte lagen Tafeln übereinander): jede neue ersetzt die vorige und beendet ein laufendes Hingehen; Klick auf den Boden oder Esc schließt; der Innenraum ersetzt alles und sperrt solange Tasten und Klicks der Karte.
   - Spielfigur teilt ihre Position (WGS84) mit der alten Szene (`earthPlayerPositionStore`).
   - Wahrzeichen (25.10.2026): benannte Orte aus den Kartendaten stehen als Schild mit Namen auf der Karte. Schild oder Gebäude darum (bis 12 m) öffnet die Tafel „Realer Ort“ mit Steckbrief (Adresse, Öffnungszeiten, Konfession, Baujahr, Träger). Bibliothek und Gotteshaus kann man bis 14 m vom Schild betreten – derselbe Innenraum wie in der alten Szene (`LandmarkWalkableInterior`). Bezeichnungen in `lib/worldlab/landmarks.ts`.
6. ~~Weite Strecken~~ Gebaut (27.10.2026): Der Zeichenanker wandert mit (`lib/worldlab/reanchor.ts`, mit Tests). Grund: Kacheln haben den Maßstab ihrer eigenen Breite, die Welt den des Ankers – nach einem Sprung von Sundern nach Frankfurt lagen die Kacheln 2,6 % zu dicht (rund 5 m Überlappung je Kachel). Steht die Figur mehr als 5 km vom Anker, startet die Ansicht die Zeichenmaschine an ihrer Position neu, mit dem bisherigen Zoom: nach „Hinspringen“ sofort, beim Laufen erst, wenn die Figur 1,5 s stillsteht und nicht „Gehe hin“ läuft. Innerhalb von 5 km bleibt der Fehler unter 0,25 m je Kachel. Beim Neustart gehen laufende Begleitungen (Person geht voraus) verloren.
7. ~~Datenlücke~~ Teilweise erledigt: `/world-lab` holt Ortsdetail (Gebäude, Wohnstraßen, Wege) selbst nach – beim Start für die Zelle um die Figur, in bebauten Kacheln ohne Gebäude selbsttätig, sonst mit „Kartendaten hier nachladen“. Offen: prüfen, ob Overpass zuverlässig antwortet; Zellen ohne Bebauung werden nicht geholt.
8. ~~Sportplätze~~ Erledigt: Import und Darstellung gebaut (Importprofil 4). Datenbank geprüft am 25.10.2026: 24 Sportflächen in Sundern, darunter Röhrtalstadion und Sportplatz Sundern (Request nach `internal-tasks/done/`).
9. Kirchen haben jetzt einen Turm an der Stirnseite (geschätzt, OSM sagt nicht, wo er steht), Höhen aus OSM `height` werden genutzt. Einzelbilder für besondere Gebäude (Kirche, Bahnhof, Café, NOXIA-Gebäude): ganzes Bild in derselben Ansicht mit Fußpunkt, statt aus Wandstücken zusammengesetzt. Maße stehen in der Zeichenvorlage.
10. ~~Häuser vor der Figur durchscheinend~~ Erledigt (25.10.2026): Ein Haus, das vor der Figur gezeichnet wird und sie überdeckt, wird durchscheinend (Deckkraft 0,4); geprüft alle 120 ms in den Kacheln um die Figur (`updateSeeThrough`).
11. ~~Gescheiterte Kartenabrufe nachholen~~ Erledigt – geprüft am 25.10.2026: keine leere Erdregion mehr; Frankfurt 5 267 Objekte, Darmstadt (als „Langen“ benannt, der Punkt liegt nördlich der Stadt) 1 456, Datong 842, Sunderner Innenstadt 1 285. Gebaut als gebaut als stündlicher Lauf `/api/cron/world-places` (vercel.json, Minute 25). Er nimmt je Lauf höchstens zwei leere Orte aus `celestial_regions` und versucht sie über die bestehenden Importwege erneut, jeden frühestens drei Stunden nach dem letzten Versuch. Betroffen beim Start: Frankfurt (50,1106 / 8,6821), Darmstadt (49,9915 / 8,6667), Datong (40,0923 / 113,2953) und fünf leere Ortsdetail-Zellen in Sundern, u. a. die Innenstadt (51,327 / 8,0032). Offen: nach einigen Läufen prüfen, ob alle gefüllt sind; Ergebnis steht im Vercel-Log unter `[world-places]`.
    - **Geduldiger Modus (27.10.2026):** Am 27.10. scheiterten alle Abrufe (Overpass überlastet, Antworten nach 9–20 s abgebrochen). Der stündliche Lauf ruft jetzt geduldig ab: alle Spiegel gleichzeitig, bis 50–55 s Wartezeit, 45–50 s Rechenzeit auf dem Server (`patient: true` in `materializeEarthPlace` und `enrichEarthLocalScene`); ein zweiter Ort je Lauf nur, wenn noch Zeit ist. Spieler in der Karte bekommen weiter den schnellen Abruf.
    - **Neue Orte eingereiht (27.10.2026, Thomas):** Seelenberg (Schmitten im Taunus, 50,2609 / 8,4149, Mitte des Testausschnitts aus PR #526) und Dvārakā (Dwarka, Gujarat, 22,2379 / 68,9675, Dwarkadhish-Tempel); Vuiteboeuf in der Warteschlange nach vorn gesetzt.
    - **Prüfung 28.10.2026 (Thomas: „Prüfen der anderen Standorte?“):** Vuiteboeuf (242 Objekte), Seelenberg (160) und Dvārakā (223) sind da, aber nur mit dem Notprofil `compact-v2` (Orte, Straßen, Flüsse, Wald, Wohngebiet – ohne Wahrzeichen wie den Dwarkadhish-Tempel, ohne Sport, ohne Bahn). Der geduldige Abruf fragte das Notprofil zuerst, und der Lauf hielt nicht leere Orte für fertig. Ortsdetail (Gebäude) fehlt bei allen dreien: die Zelle in Vuiteboeuf ist leer, Seelenberg und Dvārakā haben keine. Leer sind außerdem Sankt Petersburg, drei Frankfurter Zellen und sechs Zellen im Süden Sunderns (Gewerbegebiet, gebraucht für den Lageplan der Basis).
    - **Umgebaut (28.10.2026, `lib/worldlab/worldPlaceQueue.ts`, mit Tests):** Der geduldige Abruf fragt zuerst das volle Profil, das Notprofil nur als letzte Rettung. Der Lauf nimmt leere Orte zuerst, danach Orte mit Notprofil (nur volles Profil; scheitert es, bleibt der alte Stand). Benannte Orte bekommen eine Ortsdetail-Zelle an ihrer Mitte, die der Lauf dann füllt. Weiter zwei Orte je Lauf und drei Stunden Abstand – rund 20 offene Aufgaben brauchen also ein bis zwei Tage.
12. ~~Fabriken und Sportplatz~~ Erledigt (13.10.2026): Industriebauten als Fabrik mit Wellblech, Fensterband, Rolltor und Sheddach; verwinkelte Hallen und Fabriken mit echtem Grundriss (das Rechteck um das Metallwerk deckte vorher den Sportplatz zu). Fußballplätze bekommen Mittellinie, Anstoßkreis, Straf- und Torräume. Offen: Laufbahnen und andere Sportarten (Tennis, Reitplatz) ohne Markierung.
13. ~~Andere Plätze und Parks~~ Erledigt (14.10.2026): Importprofil 5 holt Spielplätze, Gärten, Freibäder, Friedhöfe, Kleingärten, Rasen, Festplätze und Parkplätze (`feature_type = 'place_area'`); jede Sportart hat ihre Fläche. Regionen mit Profil 4 werden beim Öffnen von `/world-lab` neu aufgebaut.
14. ~~Laufbahnen, Einzelbäume, Alleen~~ Erledigt (14.10.2026): Laufbahnen als Fläche mit heller Kante oder, wenn OSM sie als Linie führt, als rotes Band mit Bahnlinie. Importprofil 6 holt Einzelbäume (`natural=tree`) und Alleen (`natural=tree_row`, alle 8 m ein Baum); Bäume stehen als Objekte mit Tiefe vor und hinter Häusern, Laub- oder Nadelbaum fest je Ort (`lib/worldlab/treeSprites.ts`).

## Was der Weltkarte zur alten Erdszene fehlt (Vergleich 25.10.2026)

Ziel: Die alte Szene (`EarthWalkableSurface.tsx`) kann gehen, wenn die Weltkarte alles kann, was ein Spieler dort tut. Bauen, Verkaufen, Minikarte, Tag/Nacht, Fahrzeuge, Ton und Touch-Steuerung hat auch die alte Szene nicht – sie blockieren nichts. Café, Bank, Schule usw. laufen in beiden über `EarthBuildingAccessLayer`.

| # | Was fehlt | Alt | Stand |
|---|---|---|---|
| 1 | „← Karte“ zur Planungskarte | EWS:648 | erledigt 25.10. (`onPlanning`) |
| 2 | Gesprächskontext: Ortsname, Straße, Wasser/Wald, NOXIA-Gebäude, Wahrzeichen und Baustellen in 45 m um die Person | EWS:337–347, 450–493 | erledigt 25.10. (`engine.surroundings`) |
| 3 | Name über der eigenen Figur, „Du bist hier“ mit Ort und Straße | EWS:174, 735 | erledigt 25.10. (Ortsname aus `/api/world-lab/where`) |
| 4 | Hinweis beim Überfahren (Name, Eigentümer bzw. Art, Abstand) | EWS:764 | erledigt 25.10. (`onHover`) |
| 5 | Wahrzeichen ohne Innenraum: Beschreibung, Symbol je Art, Quelle | EWS:47–67, 750 | erledigt 25.10. (Symbol in der Tafel; auf der Karte weiter ein einheitliches Schild) |
| 6 | `visit_place` auch zu Wahrzeichen | EWS:486, 595 | erledigt 25.10. (Begleitung beim Betreten nur bei NOXIA-Gebäuden – der Wahrzeichen-Innenraum kennt keine) |
| 7 | Baustellen: gestrichelte Fläche mit Fortschritt, Tafel mit Bauphase | EWS:276, 666 | erledigt 25.10. (eigene Bauten aus `/api/game/build/spatial`) |
| 8 | Zielliste mit Weglänge und gezeichneter Route | EWS:264–295, 711, 737 | erledigt 25.10.: eigene und andere NOXIA-Gebäude bis 6 km, Baustellen, Wahrzeichen der geladenen Kacheln; Weg als gestrichelte Linie zu jeder Tafel mit Ort ab 25 m; ab 1,5 km „Hinspringen“ |
| 9 | `lead_walk`: die Person geht voraus | EWS:545, 616 | erledigt 25.10. (`leadPerson`: entlang der nächsten Straße, vom Spieler weg; danach geht sie wieder ihrer Wege) |
| 10 | Personen nach Tätigkeit: Tempo, Pausen, drinnen | EWS:355–390 | erledigt 25.10. (unterwegs 1,45 m/s, untätig 0,35 m/s mit Pausen; wer in einem betretbaren Gebäude arbeitet, ist drinnen) |
| 11 | Mitgehörte Gespräche zweier Personen | EWS:199–216, 495 | erledigt 25.10. (zwei Personen bis 6 m auseinander, du bis 10 m daneben; reale Meldungen und NOXIA-Neuigkeiten) |
| 12 | Läden und Lokale als Ziele | EWS:264 | erledigt 25.10.: Ortsdetail-Import `local-scene-v3` holt benannte Läden, Cafés, Restaurants, Banken, Apotheken, Hotels, Handwerk und Büros als `poi`; kleines blaugrünes Schild, Namen ab Zoom 2,4; Zielliste „Läden und Lokale“; Gesprächsziel für `visit_place`; im Haus eines Ladens zeigt die Gebäudetafel „Hier: …“. Alte Zellen holen die Läden beim nächsten Besuch nach. |
| 13 | Schienen und Zug | EWS:289, 663, 715 | erledigt 25.10.: Gleise mit Schotter, Schwellen und Schienen in den Kacheln; `/api/world-lab/rail` verbindet die Hauptgleise zu Linien und lässt sie am Bahnhof beginnen – die Röhrtalbahn (Strecke 9283) am alten Bahnhof Sundern (Sauerland), Richtung Neheim. Ein Zug (Triebwagen + 2 Wagen, 40 km/h, 2 min Aufenthalt an beiden Enden) fährt nach Uhrzeit, alle sehen ihn gleich; die Tafel des Bahnhofs zeigt den nächsten Zug. Die gespeicherte Strecke endet bei 51,400 / 7,997 am Rand der Region Sauerland – bis Neheim fehlt das Stück.|
| 14 | Startort | EWS:220–246 | erledigt: die Position ist gespeichert (`earthPlayerPositionStore`); „⌂“ springt zum eigenen Gebäude |
| 15 | Linke Tafel auf schmalen Bildschirmen | EWS:787 | erledigt 25.10. |

Dazu: Pfeiltasten laufen wie WASD (hatte keine der beiden Ansichten).

## Gebäude kaufen (Thomas, 25.10.2026)

Entschieden: Reale Gebäude, die noch niemandem gehören, kann man **kaufen**; das Geld geht an die Gemeinde. Bewohner bleiben und zahlen Miete an den neuen Eigentümer; Mieteinnahmen erhöhen den Kaufpreis. **Abreißen nur selbst gekaufte Gebäude**, danach an der Stelle bauen.

- Buchung, Preis, Eigentum und Miete gehören zu Bevölkerung und Ökonomie: Request R-12 in `population-economy.md` (mit Vorschlag für die Schnittstelle `/api/game/building-offer`).
- Gebaut in der Karte: Jedes Gebäude trägt seine OSM-Kennung (`i` in den Kacheldaten), Grundfläche und Geschosse. Die Gebäudetafel fragt das Angebot ab und zeigt Eigentümer, Bewohner, Miete, Preis und „Kaufen“, sobald die Schnittstelle antwortet; bis dahin nichts. Nach dem Kauf holt die Karte die NOXIA-Gebäude neu (`reloadNoxia`), das Haus erscheint als eigenes.
- **Gebaut 25.10.2026 (auf Wunsch von Thomas hier statt bei Bevölkerung und Ökonomie, siehe R-12):** Kaufen, Abreißen, Bauen auf der freien Fläche.
  - Gekaufte Gebäude behalten ihr Aussehen (`acquired_building`, Zuordnung über die OSM-Kennung `source_ref`), Tafel zeigt „Eigentümer: du“ und „Abreißen …“ (mit Rückfrage; „und neu bauen“ öffnet gleich die Fläche).
  - Abgerissene Gebäude zeichnet die Karte nicht mehr (`earth_cleared_buildings`, über `/api/world-lab/buildings` → `plots`); an ihrer Stelle liegt eine gestrichelte freie Fläche. Der Eigentümer sieht dort die Bautypen, deren Grundfläche hineinpasst, und baut über `/api/game/build/spatial` (Lage und Drehung des alten Hauses).
  - **Bewohner (Thomas, 25.10.2026: „echte Personen, neu angelegt“):** Echte Wohnhäuser sind bewohnt. Beim Kauf ziehen die Bewohner als Personen ins Spiel ein – 1 je 40 m² Geschossfläche, Einfamilienhaus höchstens 4, Mehrfamilienhaus höchstens 8 –, mit eigenem Konto (Startbestand 980 Cr als ausgewiesene Emission `bootstrap:person:<id>`) und Mietvertrag über 200 Cr je Abrechnung an das Wirtschaftskonto des Käufers (`run_npc_rent_settlement`). Die Miete steckt mit 6 Abrechnungen im Kaufpreis. Beim Abriss ziehen sie in staatlichen Wohnraum mit freien Plätzen; gibt es keinen, wird der Abriss abgelehnt.
  - **Umbauen (Thomas: „Nutzung ändern, halbe Baukosten“):** Ein gekauftes Gebäude bekommt eine andere Nutzung (z. B. Café, Bank, Hotel), sofern deren Grundfläche hineinpasst; Hülle, Aussehen und Bewohner bleiben, sofort fertig (`convert_earth_building`). Ein Café im gekauften Haus kann man betreten.
  - **Bauprüfung (`lib/worldlab/buildingConflict.server.ts`, in `/api/game/build/spatial`):** Wo ein echtes Haus steht, wird nicht gebaut („erst kaufen und abreißen“); eine freie Fläche nach Abriss bebaut nur, wem sie gehört. Die Kacheldaten dafür lädt `lib/worldlab/tileSource.server.ts` (gemeinsam mit `/api/world-lab/tile`).
  - Offen: Die neuen Bewohner haben noch keine Arbeit – ohne Einkommen reicht ihr Startbestand für etwa fünf Mieten (Bevölkerung und Ökonomie, Stellenmarkt).

### Flurstücke statt Häuser (Thomas, 25.10.2026: „wäre ja blöd, wenn ich im Garten eines anderen etwas bauen könnte“)

- **Quelle:** amtliches Liegenschaftskataster NRW, WFS NW ALKIS Vereinfacht (`ave:Flurstueck`, Datenlizenz Deutschland – Zero – 2.0, ohne Eigentümerangaben). Antwort am 25.10.2026 aus Vercel geprüft (Sundern, Elsternhagen 26: Flur 2, Flurstück 355, 660 m², Wohnbaufläche) und als Test hinterlegt.
- **Abruf:** `/api/world-lab/parcels` holt je Zelle (~450 × 420 m) einmal, die Karte stößt das für die Gegend um die Figur selbst an (nur in NRW). Gespeichert in `earth_parcels`, geholte Zellen in `earth_parcel_cells`. Leser `lib/worldlab/alkis.ts`, Umrechnung UTM 32 → WGS84 `lib/worldlab/utm.ts` (beide mit Tests). Prüfaufruf ohne Speichern: `GET /api/world-lab/parcels?lat=…&lon=…&dry=1`.
- **Karte:** Flurstücksgrenzen als feine Linien ab Zoom 2,2; eigene golden, fremde Spieler-Flurstücke blau umrandet. Klick auf den Boden öffnet die Tafel des Flurstücks (Bezeichnung, Fläche, Nutzung, Eigentümer, Häuser, Bewohner, Preis).
- **Kaufen:** In NRW kauft man das Flurstück samt Häusern (`/api/game/parcel-offer`, `buy_earth_parcel`); Klick auf ein Haus führt dorthin („Wird mit dem Flurstück verkauft“). Preis = Fläche × Bodenwert nach Nutzung (Wohnbaufläche 4, Gewerbe 3, Landwirtschaft 0,6, Wald 0,4 Cr/m²) + Wert der Häuser (Geschossfläche, Miete). Nicht verkäuflich: Verkehrsflächen, Gewässer, Friedhöfe und Flächen besonderer funktionaler Prägung, Flurstücke mit öffentlichen Gebäuden oder fremden Häusern. Außerhalb des Katasters bleibt der Kauf einzelner Häuser.
- **Bauen:** Wo Flurstücke bekannt sind, muss der Neubau ganz auf eigenen Flurstücken stehen; auf eigenem Flurstück kann man an der angeklickten Stelle bauen. Ohne Kataster gilt ein geschätzter Garten von 6 m um fremde Häuser (`lib/worldlab/buildingConflict.server.ts`).
- **Weitere Länder (25.10.2026):** Neben NRW sind Hessen, Rheinland-Pfalz, Hamburg, Sachsen-Anhalt, Sachsen, Brandenburg und Mecklenburg-Vorpommern angebunden (Liste, Gebiete und Quellenvermerke in `lib/worldlab/alkis.ts`, `CADASTRE_SERVICES`). Alle acht Dienste am 25.10.2026 aus Vercel mit der Abfrage des Spiels geprüft (Sundern, Kassel, Mainz, Hamburg, Magdeburg, Leipzig, Potsdam, Rostock – Flurstücke an der richtigen Stelle). Mecklenburg-Vorpommern antwortet nur in UTM 33 (`toUtm(…, 33)`). An Landesgrenzen fragt das Spiel beide Länder; fällt eines aus, bleibt das Gefundene und die Zelle wird nach einer Stunde neu geholt. Die Tafel nennt die Quelle je Land.
  - Nicht angebunden: Berlin (eigenes Schema `alkis_flurstuecke:flurstuecke`), Thüringen (Dienst liefert keine Flurstücke im Standardschema), Niedersachsen (Dienst am 25.10. in Wartung), Bayern, Baden-Württemberg, Schleswig-Holstein, Saarland, Bremen (kein offener Dienst gefunden oder nicht erreichbar).
  - Sachsen-Anhalt: Der Dienst heißt „OpenData“, die Capabilities verweisen aber auf die Kostenverordnung – Lizenz vor einer Veröffentlichung noch prüfen.
- **Teilen und Zusammenlegen:** Eigenes Flurstück an der angeklickten Stelle quer oder längs zur Hauptrichtung teilen; mit einem eigenen Nachbarflurstück zusammenlegen, wenn beide eine Grenze mit denselben Eckpunkten teilen (`lib/worldlab/parcelGeometry.ts`). Vermessungsgebühr 200 Cr an die Gemeinde; jeder Teil mindestens 30 m². Die alten Flurstücke bleiben als `retired_at` in `earth_parcels` (ein späterer Katasterabruf holt sie nicht zurück), die neuen haben `source = 'noxia'` und `parent_ids`.
- **Verkauf an andere Spieler:** Eigenes Flurstück (oder ein gekauftes Haus außerhalb des Katasters) mit Wunschpreis anbieten (`earth_property_listings`); ein anderer Spieler kauft zum angezeigten Preis (`buy_listed_earth_property`, Transfer Käufer → Verkäufer, Protokoll in `earth_property_sales`). Mit dem Flurstück wechseln alle Gebäude des Verkäufers darauf, abgerissene Flächen und Mietverhältnisse (neuer Vermieter: Firma des Käufers). Solange darauf gebaut wird, ist kein Verkauf möglich.
  - **Steuer (Thomas, 25.10.2026):** 5 % auf Verkäufe unter Spielern. Der Käufer zahlt den Angebotspreis, der Verkäufer erhält ihn abzüglich Steuer, die Steuer geht in die Koloniekasse der Erde (`colony_ledger`, `tax_transaction`). Der Satz gilt je Verwaltungsbezirk (`earth_property_tax_rates`, vorerst die Gemeinde aus dem Kataster; `'*'` = allgemeiner Satz 5 %). Wenn Politik etabliert ist, kann ein Bezirk dort seinen eigenen Satz setzen (0–50 %). Geteilte und zusammengelegte Flurstücke behalten ihre Gemeinde.
- **Verkäufer:** Die Tafel nennt die Stadt/Gemeinde aus dem Kataster („Stadt Sundern“; Stadt, wenn OSM den Ort als town/city führt), gebucht wird beim öffentlichen Akteur der Erde (Thomas, 26.10.2026: vorerst so). Später, wenn es Rollen wie Bürgermeister gibt: eigene Kasse je Stadt/Gemeinde.
- Hinweis: Fremde Spieler sehen geänderte Grenzen erst, wenn ihre Kachel nicht mehr aus dem CDN kommt (bis zu einer Stunde).

### Grundstücke kaufen, nicht nur Häuser (Thomas, 28.10.2026: „aktuell kann man nirgends einfach so bauen auf der Erde“)

Befund: Ein Klick auf freien Boden tat nichts, wenn dort kein Flurstück geladen war. Außerhalb der Länder mit offenem Kataster gab es damit keinen Weg zu Land und zum Bauen, im Katastergebiet nur in den Zellen um die Figur. Seitdem öffnet ein Klick auf den Boden die Tafel „Boden“ (`app/world-lab/LandPanel.tsx`):
- **Im Katastergebiet:** Die Zelle am Klickpunkt wird geholt, die Karte neu geladen, dann öffnet die Flurstückstafel (Kaufen, Bauen wie gehabt). Liegt dort kein Flurstück, steht das in der Tafel (meist Straße oder Gewässer).
- **Ohne Kataster:** Grundstück abstecken – quadratisch 20, 30, 40 oder 60 m, an der nächsten Straße bis 50 m ausgerichtet, Umriss auf der Karte (gelb frei, rot nicht möglich). Prüfung und Preis in `lib/worldlab/landOffer.server.ts` (Geometrie mit Tests in `landPlot.ts`): keine Häuser und 6 m Garten um sie, keine Straßen (Feld- und Waldwege erlaubt), keine Gewässer, keine öffentlichen oder fremden Flächen (Park, Friedhof, Sport, Parkplatz, Platz, Gärten, Kleingärten), kein anderes Grundstück; Kartendaten müssen da sein. Preis = Fläche × Bodenwert (Bauland 4, Feld 0,6, Wald 0,4, sonst 2 Cr/m²) × Lagefaktor, mindestens 500 Cr; Verkäufer die Gemeinde.
- Gekauft wird es ein Flurstück wie die amtlichen (`earth_parcels`, Quelle `noxia_land`, Kennung `nl-…`), gekauft über `buy_earth_parcel`. Dann gilt alles vom Kataster: Grenze auf der Karte, Bauen, Teilen, Zusammenlegen, Weiterverkauf mit Steuer. Schnittstelle `GET/POST /api/game/land-offer`.
- **Bauprüfung:** Abgestecktes Land zählt nicht als amtliches Kataster. Ohne Kataster darf keine Ecke eines Neubaus auf fremdem abgestecktem Land stehen; sonst gilt weiter die Gartenregel.
- **Hessen:** Der Dienst liefert bei uns keine Nutzungsart (alle 2 020 hessischen Flurstücke ohne `usage`), so wären auch Straßen-Flurstücke verkäuflich gewesen. Ohne Nutzungsart erkennt die Karte Straßen jetzt an den Kartendaten: schmal, mit langer Straßenmitte darin (`looksLikeStreetParcel`). Geprüft am 28.10.2026 mit `GET /api/world-lab/parcels?lat=50.11&lon=8.68&dry=1&usage=1`: Der hessische Dienst antwortet, die Kennzeichen haben dasselbe Format wie die Flurstücke (Zuordnung vorsorglich vereinheitlicht, `parcelKey`, Zellfassung `v3-nutzung`). Er liefert für die Frankfurter Innenstadt aber nur wenige Nutzungsabschnitte (Main als Fließgewässer), nicht die der Häuser und Straßen. Warum, ist offen; bis dahin gilt die Straßenerkennung aus den Kartendaten.
- **Teilstücke im Katastergebiet (Thomas, 28.10.2026: „wichtig ist vor allem Sundern“):** Die Flurstücke in Sundern sind groß und teuer (Acker 3 ha ≈ 21 000 Cr, Wohnflurstück mit sechs Häusern ≈ 63 000 Cr; Spieler haben meist um 5 000 Cr). In der Flurstückstafel steckt „Teilstück“ an der angeklickten Stelle ein Stück aus einem Flurstück der Gemeinde ab (ab 600 m², nicht bei Straßen, Gewässern, öffentlichen Flächen oder fremdem Eigentum). Das Stück muss ganz im Flurstück liegen; Häuser samt 6 m Garten, Straßen und andere Stücke sind tabu. Preis = Fläche × Bodenwert der Nutzung des Flurstücks × Lage, mindestens 300 Cr. Gespeichert als Flurstück mit Quelle `noxia_part` und `parent_ids`; an seiner Stelle geht es dem Mutterflurstück vor (überall das kleinste Flurstück am Punkt: Karte, Tafel, Bauprüfung). Das Mutterflurstück ist danach nicht mehr als Ganzes zu haben, nur weitere Teilstücke.
- **Formen:** quadratisch 20, 30, 40, 60 m oder länglich 15 × 40, 20 × 40, 20 × 60, 30 × 60, 40 × 80 m; „drehen“ legt die lange Seite an die Straße oder quer dazu. Ausrichtung an der nächsten Straße bis 50 m.
- Offen: Zwei Spieler, die gleichzeitig überlappendes Land abstecken, können beide kaufen (kein Sperren in der Datenbank). Fremde Spieler sehen neues Land wie neue Flurstücke erst, wenn ihre Kachel nicht mehr aus dem CDN kommt (bis zu einer Stunde).

### Bereinigung 25.10.2026 (Thomas: „meine selbst gebauten Gebäude passen nicht mehr“)

McKnights elf Bauten in Sundern aus der Zeit vor der echten Karte entfernt (2 Wohnblöcke, Habitat, Schule, Fabrik, Warenhaus, Bank, Raumhafen-Kern, 3 Solarfelder), ohne Erstattung. Die fünf Bewohner (4 aus dem Wohnblock, 1 aus dem Habitat) wohnen jetzt im staatlichen Wohnblock Selmecke (`203e82d7…`, 8 von 12 Plätzen), Mietverhältnis als Bereinigung (`origin = backfill`), Präsenz mitverschoben. Café („Thomas“) und die staatlichen Bauten in Selmecke bleiben.

### Tafeln rechts (Thomas, 25.10.2026)

„Du bist hier“, Zielliste und Adresssuche stehen wieder rechts oben wie in der alten Szene, die Tafel des gewählten Objekts direkt darunter. Links bleiben Hilfe, Schnellziele, Messwerte und die Rückwege.

## Einstieg neuer Spieler (Thomas, 27.10.2026: „passe alles auf das neue System an“)

- Nach dem Onboarding (Name, Avatar, Quiz, drei Karten) geht es ins Dashboard mit der neuen Weltkarte (`/dashboard?starterCafe=<id>`), nicht mehr auf die alte Seite `/earth`. Die Weltkarte öffnet beim ersten Laden den Innenraum des Startcafés (Hauptstraße 72); danach steht die Figur am Café.
- Die Startposition setzt das Onboarding auf das Café (`/api/game/profile?action=setup` liefert Breite und Länge des Startcafés). Ohne gespeicherte Position beginnt die Weltkarte ebenfalls am Café statt in „Sundern Mitte“.
- Erste Einweisungskarte: „Starte in Sundern“ – Café, Leute ansprechen, Haus kaufen und umbauen (statt „bau deine erste Anlage“).
- `/earth` bleibt als Planungs- und Entwicklerseite bestehen; der Link „Erde öffnen“ im Scanner führt jetzt ins Dashboard.

## Linienflug ohne eigenes Schiff (Thomas, 27.10.2026: „baue das“)

- Der Server konnte seit 03.10.2026 Passagiere ohne Schiff befördern (Ticket statt Energie, `noxia_start_passenger_transit`), aber im Spiel kam ein neuer Spieler nicht an den Knopf, und alle Konten hatten ein Schiff.
- **Ticketschalter** (`app/components/TicketCounter.tsx`): in der Gebäudetafel jedes Raumhafen-Baus (`spaceport_*`) in der Weltkarte, sobald man davorsteht – Ziele mit Preis und Flugdauer, „Ticket kaufen“; Spieler mit eigenem Schiff bekommen den Hinweis auf die Navigation. Angebote aus `GET /api/game/transit?offers=1` (`getPassengerOffers`, gleiche Rechnung wie beim Abflug; `lib/game/passengerOffers.ts` mit Tests).
- **Navigation** (Sonnensystem in Gebäuden auf Mond, Phobos, Deimos, Mars): ohne Schiff keine Sperre nach Schiffsreichweite mehr, Ticketpreis statt Energie.
- Preise von der Erde: Mond 500, Kepler und Prometheus 700, Deimos und Phobos 825, Mars 850 Cr; neue Spieler haben 5 000 Cr.
- Geprüft in der Datenbank (Transaktion, zurückgerollt): neues Konto ohne Schiff, Ticket Erde → Mond (−500 Cr), Ankunft auf dem Mond, Rückflug buchbar.
- Offen: zusätzlich ein Reisebüro in Sundern (Ort entscheidet Thomas); der Schalter zieht mit dem Raumhafen in den Süden um.

## Reisebüro (Thomas, 27.10.2026: „auch für Reisen zu anderen Gegenden der Erde, nicht nur im Weltraum“)

- **Ort:** staatliches Reisebüro in Sundern, Hauptstraße 47 (osm:way:191141345, schräg gegenüber dem Startcafé; in den Kartendaten gibt es in Sundern kein Reisebüro). Gebäudeart `travel_agency` (nicht baubar), Plakette ✈. Änderbar.
- **Tafel** (`app/components/TravelAgency.tsx`): Reiter „Erde“ und „Weltraum“ (Linienflug-Ticketschalter). In der Gebäudetafel des Reisebüros, sobald man davorsteht.
- **Erdreisen** (`lib/game/earthTrips.ts` mit Tests): Ziele sind die Orte mit Kartendaten (`celestial_regions` der Erde ohne Ortsdetail-Zellen). Bis 400 km Bahn (8 Cr + 0,15 Cr/km), darüber Flug (60 Cr + 0,04 Cr/km). Dauer nach Spieluhr (60-fach), höchstens 5 min echte Zeit. Beispiele ab Sundern: Menden 11 Cr, Frankfurt 29 Cr (2 min), Herceg Novi 111 Cr, Datong 362 Cr, Tingo María 476 Cr.
- **Buchung** (`/api/game/earth-trip`, Migration `20261027190000_earth_travel_agency.sql`, live): Preis und Dauer rechnet der Server; Abbuchung beim Spieler, Gutschrift als Ticketerlös in der Koloniekasse der Erde (wie Linienflug, geht als Fiskaltransfer an die öffentlichen Dienste). Während der Fahrt ist die Karte gesperrt und zeigt die Restzeit; bei Ankunft springt die Figur zum Ziel, die Karte baut sich dort neu auf. Eine offene Reise übersteht Neuladen.
- **Rückweg:** Mehr als 30 km von Sundern zeigt „Du bist hier“ den Knopf „Weiterreisen …“ (steht für Bahnhof/Flughafen vor Ort) mit Heimreise nach Sundern und allen anderen Zielen.
- Geprüft in der Datenbank (Transaktion, zurückgerollt): Buchung Sundern → Frankfurt 30 Cr, Ticketerlös in der Kasse, zweite Buchung während der Reise abgelehnt, Ankunft erst nach Ablauf.
- Offen: echte Bahnhöfe und Flughäfen aus den Kartendaten als Abfahrtsorte statt des Knopfes; weitere Reisebüros in anderen Städten.

## Einstiegsquiz (Thomas, 27.10.2026)

Geprüft, was mit den Antworten des Einstiegsquiz geschieht: Sie setzen nur die Schwierigkeitsstufe der Akademie (`profiles.knowledge_level`). Ergebnis anzeigen, Stufe nachführen und Fachgebiete nutzen: Request **R-17** in `population-economy.md`.

## Staatliche Basis „Selmecke“ (Thomas, 27.10.2026: „sieht furchtbar aus“)

**Befund:** „Selmecke“ ist in den Kartendaten kein Stadtteil, sondern ein Bach und das **Naturschutzgebiet Selmecke** (Schutzklasse 4, 51,331–51,351 / 7,968–7,980). Die 17 staatlichen Bauten (Verwaltung, Schule, Wohnblock mit 8 Bewohnern, Habitat, Labor, Scanner, Fabrik, Werft, zwei Lager, Solarfeld, Raumhafen mit Kern, Service, Lager und drei Landeplätzen) stehen zum Teil darin, in einem Waldtal ohne echte Häuser und Straßen – nur Feldwege. Deshalb wirkte die Basis wie ein Platzhalter auf der Wiese. Dazu kam ein Zeichenfehler: Bilder großer Bauten wurden mit ihrem Bildmaßstab bis 1,4-fach über die Grundfläche hinaus vergrößert (Landeplatz 120 × 90 m als Scheibe von rund 350 m).

**Gebaut (27.10.2026):**
- Landeplätze und Solarfeld zeichnet die Karte selbst in echter Größe (`drawPad`, `drawSolar` in `worldEngine.ts`): erhöhte Betonplatte mit Fugen, gelb-schwarzer Warnrand, Zielkreis mit Kreuz, Landelichter; Solarfeld als Reihen geneigter Paneele.
- Anlagen: NOXIA-Gebäude ohne echtes Haus, die höchstens 45 m auseinander stehen, bekommen ein gemeinsames Betonvorfeld mit Fugen, Zaun und Mastleuchten (`drawFacilities`, Geometrie in `lib/worldlab/facility.ts` mit Tests). Einzelne Bauten bekommen nur eine Betonfläche.
- Bilder anderer NOXIA-Gebäude werden nicht mehr größer als ihr Grundriss (Bildmaßstab über 1,7 wird gekappt).
- Geprüft mit einer Testseite (echte Lage und Größe der 17 Bauten, künstlicher Boden): keine Überlappungen mehr, keine Fehler.

**Entschieden (Thomas, 27.10.2026): Die Basis zieht ganz um, in ein Gewerbegebiet im Süden von Sundern.** Kandidaten aus den Kartendaten (Flächennutzung Industrie):
- bei Wellpappen Tillmann (51,2995 / 7,9831, rund 380 × 430 m, 3,3 km vom Zentrum),
- westlich davon ein großes Industriegebiet (51,2989 / 7,9620, rund 590 × 470 m, dazu 51,3013 / 7,9635, 440 × 360 m; 4 km),
- Endorfer Mühle (51,2973 / 8,0430, rund 250 × 510 m, 4,2 km).

Für alle drei fehlten die Hausdaten. Die zehn Ortsdetail-Zellen sind am 27.10.2026 gegen 10:30 Uhr als leere Orte in `celestial_regions` eingereiht (`earth-place-51p29700-7p95959` … `earth-place-51p29700-8p04595`); der stündliche Lauf `/api/cron/world-places` holt zwei je Stunde.

**Auswertung 28.10.2026 (8 von 10 Zellen gefüllt; leer noch `51p29700-7p97878` und `51p29700-7p98838`, also die Wiese südwestlich von Tillmann):**

| | A: bei Wellpappen Tillmann | B: Industriegebiet West | C: Endorfer Mühle |
|---|---|---|---|
| Hallen | Tillmann Wellpappe 33 500 m² und 10 100 m², daneben eine Halle ohne Namen mit 12 700 m² (wohl ebenfalls Tillmann) | 9 200 m², 3 900 m², 3 500 m², 3 000 m², 2 400 m², ohne Namen (außer Kaiser & Waltermann, 1 800 m²) | sechs Hallen mit 1 600–3 100 m², ohne Namen |
| Freie Fläche | Industrie-Insel 51,2979 / 7,9803 (217 × 187 m, keine Häuser) und Wiese 51,2968 / 7,9781 (753 × 605 m) – beide in den noch leeren Zellen | Acker 51,2977 / 7,9656 (235 × 224 m, keine Häuser) | Wiese 51,2965 / 8,0400 (374 × 633 m), am Rand Häuser von Endorf |
| Nachbarn | Segelfluggelände Sundern-Seidfeld gleich nördlich | Naturschutzgebiete Breloh und Im Sümpfel direkt daneben | Dorf Endorf |
| Weg zum Zentrum | 3,3 km | 4 km | 4,2 km |

Vorschlag: **A**, aber ohne die Hallen von Tillmann (ein reales, arbeitendes Unternehmen). Landeplätze und Raumhafen auf die Industrie-Insel und den Nordrand der Wiese, Solarfeld auf die Wiese; Fabrik, Werft, Lager und Labor als neue Hallen am Rand der Insel, Verwaltung, Schule und Wohnblock an der Straße. Erst festlegen, wenn die zwei leeren Zellen da sind. Ausweichlösung: **B** – dort stehen die Werkbauten in echten Hallen ohne Namen, die freie Fläche ist aber knapp und liegt an zwei Naturschutzgebieten.

**Nächste Schritte:**
1. Sobald die Zellen gefüllt sind: je Gebiet echte Hallen und freie Flächen auswerten; Lageplan vorschlagen (Fabrik, Werft, Lager, Labor in echte Hallen über `source_ref`; Landeplätze, Raumhafen und Solar auf freie Fläche, zusammen rund 300 × 200 m), Thomas entscheidet.
2. Umzug der Bauten (Lage, Drehung, `source_ref`) als Migration. Wohnzuweisungen und Arbeitsplätze hängen an `tile_entity_id` und ziehen mit; Anwesenheit und Wege der Personen gehören zu Bevölkerung und Ökonomie (Request dort, sobald der Ort feststeht).
3. Danach prüfen, ob die alte Lage im Naturschutzgebiet leer ist.

### Startcafé mit NOXIA-Dach (Thomas, 27.10.2026)

Das Startcafé im realen Haus Hauptstraße 72 trägt das NOXIA-Dach wie die öffentlichen Gebäude (W-7). Gekaufte und umgebaute Häuser behalten ihr reales Aussehen. Weil beide in der Datenbank sonst gleich aussehen (Spielergebäude mit `source_ref`), gibt es dafür das Merkmal `tile_entities.noxia_roof` (Migration `20261027160000_tile_entities_noxia_roof.sql`); `/api/world-lab/buildings` liefert es als `noxiaRoof`.

## Requests aus anderen Teilprojekten

### W-1 (Gastronomie, 25.10.2026): Straßennamen in der Spielansicht – in der Weltkarte erledigt (25.10.2026)

Umgesetzt in der neuen Weltkarte: Straßennamen entlang der Straße ab Zoom 1,6 (`lib/worldlab/streetLabels.ts`); Anschrift beim Klick auf ein Gebäude; Ziel-Feld „Hauptstraße 102“ springt zum Gebäude (`GET /api/world-lab/address`, aus `region_features`, nächster Treffer zur Spielfigur, ohne fremde Dienste). Nicht umgesetzt in der bisherigen Erdszene (`EarthWalkableSurface`) – die soll durch die Weltkarte ersetzt werden.

Ursprünglicher Request:

Beobachtung Thomas, 25.10.2026 (in der Erdszene bei Sundern): Die Straßen haben im Spiel keine Namen. Die Namen sind da – `region_features` führt für Straßen `properties.name` (z. B. Hauptstraße, Bogenstraße), und das Ortswissen der Figuren nennt sie bereits.

- Straßennamen entlang der Straße zeichnen, wie auf einem Stadtplan: in Laufrichtung, lesbar gedreht, einmal je Abschnitt und nur ab einer Zoomstufe, in der sie nicht übereinanderliegen. Das gilt für die bisherige Erdszene (`EarthWalkableSurface`) und die neue Weltkarte (`/world-lab`), je nachdem, welche bleibt.
- Dazu Hausnummern an Gebäuden mit `addr:housenumber`, mindestens beim Anklicken – für Gastronomie wichtig, weil Spieler Lokale und Hotels dort bauen wollen, wo im echten Ort eines steht (Beispiel: Hauptstraße 102 in Sundern), und das Ziel-Feld heute nur Koordinaten versteht.
- Zielwahl: „Hauptstraße 102“ im Ziel-Feld sollte auf das Gebäude springen (Geokodierung aus `region_features`, keine fremde Dienstanfrage).

### W-2 (Gastronomie, 25.10.2026): Layout der neuen Karte – Informationen rechts, nur das Nötige – erledigt (25.10.2026)

Umgesetzt (`app/world-lab/WorldLab.tsx`, `WorldPanels.tsx`):
- **Eine Spalte rechts:** oben „Du bist hier“ (Ort, Straße); ohne Auswahl darunter ⌂ eigenes Gebäude, Ziel und Adressfeld; mit Auswahl nur Ort und Straße, darunter die Tafel (Person, Gebäude mit „Betreten“ über `EarthBuildingAccessLayer`, Ort, Baustelle, Fläche). Klick auf eine Person räumt das Ziel weg.
- **Links nichts Dauerhaftes:** Bedienhinweise beim ersten Öffnen (danach hinter „?“ oben in der Spalte); Sprungziele (Sundern Mitte, Café, Selmecke) stehen jetzt in der Ortsleiste unter „Orte“; Messwerte, „Kartendaten nachladen“ und „Bisherige Erdszene“ nur mit `?dev=1` (bleibt gespeichert, `?dev=0` schaltet ab) hinter „⚙“.
- **Fehler:** Ursache der Meldung „Unexpected token 'A' … is not valid JSON“: `/api/world-lab/refresh` lief über 120 s (Vercel-Grenze; Region neu bauen plus Overpass-Spiegel), Vercel antwortete dann mit einer Textseite. Jetzt Zeitbudget 95 s auf dem Server (Teilergebnis statt Abbruch), die Karte liest Antworten sicher; Spieler sehen einen kurzen Satz in der Spalte, Einzelheiten stehen in der Konsole (`[world-lab]`).
- **Für Gastronomie (Aufgabe 11):** Die Gebäudetafel ist der Zweig `building` in `WorldPanels.tsx`; für NOXIA-Gebäude mit Innenraum steht dort `own` und `entry` bereit – Öffnungszeiten (`venueHoursFor`/`venueOpenAt`) gehören in die Zeile über „Betreten“.


Beobachtung Thomas, 25.10.2026 (neue Weltkarte im Spiel, Sundern): Das Layout passt noch nicht. Informationen sollen hauptsächlich rechts stehen, und nicht zu viel auf einmal – nur, was gerade gebraucht wird.

Stand im Bild: links eine große Tafel (Bedienhinweise, Sprungziele, Messwerte, „Kartendaten nachladen“, zwei Rücklinks), oben die Ortsleiste, rechts oben Ort und Ziel mit Adressfeld – drei Flächen, die die Karte einrahmen. Vorschlag:

- **Eine Spalte rechts** (wie Personentafel und Zieltafel in der Erdszene), die ihren Inhalt nach Lage wechselt: nichts gewählt → Ort, Ziel, Adressfeld; Person gewählt → Personentafel; Gebäude gewählt → Gebäudetafel mit „Betreten“; beim Laufen bleibt sie leer bis auf Ort und Ziel.
- **Links nichts Dauerhaftes.** Bedienhinweise nur einmal beim ersten Öffnen oder hinter einem „?“. Sprungziele (factory, Sundern Mitte, Café, Selmecke) in die Ortsleiste oben unter „Orte“, wo sie schon hingehören. Messwerte, „Kartendaten nachladen“ und „Bisherige Erdszene“ sind Entwicklerdinge – hinter einen kleinen Schalter oder nur mit `?dev=1`.
- **Fehler nicht als Fließtext in der Tafel** („Unexpected token 'A' … is not valid JSON“ – der Server antwortet mit einer Fehlerseite statt JSON; bitte prüfen, warum). Für Spieler ein kurzer Satz, Einzelheiten in die Konsole.
- Abstimmung mit Gastronomie: Betreten eines Lokals und die Personentafel sollen in der neuen Karte so laufen wie in der Erdszene (`EarthBuildingAccessLayer`, Klick auf Person räumt das Ziel weg).

### W-3 (Gastronomie, 25.10.2026): Lesbarkeit der neuen Karte und doppelte Leisten – erledigt (25.10.2026)

Umgesetzt:
- **Figur:** Standardzoom näher (3,4 statt 2,6), Figuren 1,3–1,35-mal größer, goldener Boden-Ring unter der eigenen Figur; Häuser vor der Figur werden durchscheinend (Aufgabe 10).
- **Straßen:** Gehweg mit Bordstein an allen Fahrstraßen, zuerst gezeichnet, damit Kreuzungen als Platz ineinanderlaufen; Flüsse mit erdigem Ufersaum.
- **Anklickbar:** Häuser, Personen, Schilder, Baustellen und Flächen hellen beim Überfahren auf, der Zeiger wird zur Hand.
- **Schilder:** NOXIA-Gebäude (auch gekaufte und umgebaute) tragen ein Namensschild über dem Dach; fremde Häuser nicht.
- **Leisten:** Die Ortsleiste ist zugeklappt ein schmaler Knopf in der Kopfzeile („⌖ Ort ▾“); aufgeklappt Suche, Home und Orte darunter. „Erde → LEO“ und „Weltlage“ stehen nicht mehr frei im Bild, sondern in der Spielleiste unter „Aktionen“ (`data-noxia-action="orbit"`/`"world"`, `DashboardCockpit.tsx`).


Bestätigt von Thomas, 25.10.2026. Beobachtungen am Bild von Sundern (Fabrikgelände, Figur McKnight):

**Karte**
- Die Figur ist winzig und steckt halb im Glasbau. Entweder näher heran beim Laufen (Standardzoom), oder Boden-Ring unter der Figur und das Haus davor durchscheinend (Aufgabe 10 – hier sieht man, warum).
- Straßen sind nur Linien im Grün: Bürgersteige, Kreuzungen, Flussufer fehlen. Fleißarbeit, aber der Unterschied zwischen Stadt und Diagramm.
- Nichts zeigt, was anklickbar ist. Leichtes Aufhellen beim Überfahren und Mauszeiger als Hand für Häuser und Personen.
- NOXIA-Gebäude (Café, Fabrik, Hotel) tragen kein Schild. Ein kleines Namensschild wie bei den Personen; fremde Häuser nicht.

**Leisten**
- Zwei Navigationsleisten übereinander: oben Aktuell · Home · Orte · Springen, unten Karte · Orte · Profil … – zweimal „Orte“ mit verschiedener Bedeutung. Die obere in die Kopfzeile neben Credits und Standort, oder in „Orte“ unten.
- „Erde → LEO“ und „Weltlage“ stehen rechts unten frei im Bild; sie gehören in die Spielleiste unter „Aktionen“.

**Anschluss Gastronomie (dort gebaut, sobald die Gebäudetafel aus W-2 steht):** Beim Klick auf ein Lokal in der rechten Spalte Name, Art, offen/geschlossen mit Uhrzeit und „Betreten“ – aus `venueHoursFor`/`venueOpenAt` (`lib/game/hospitality/venues.ts`), damit man vor dem Hineingehen weiß, dass das Café um 20 Uhr Koloniezeit schließt.

### W-4 (Gastronomie, 25.10.2026): Reale Gebäude anklickbar, kaufbar und mit NOXIA-Gebäuden verknüpft – erledigt (25.10.2026)

Umgesetzt:
- **Stabile Kennung:** Jedes reale Gebäude trägt in den Kacheldaten seine OSM-Kennung (`i`, z. B. `osm:way:123`, aus `noxia_source_id`); `tile_entities.source_ref` verweist darauf. Die Feature-Id taugt nicht als Kennung – Regionen werden neu aufgebaut und bekommen dabei neue Zeilen.
- **Am realen Grundriss:** Ein NOXIA-Gebäude mit `source_ref` (gekauft, umgebaut – oder künftig das übertragene Startcafé) wird auf dem Grundriss des Hauses gezeichnet, mit Namensschild (W-3); sein eigenes Bild entfällt dann (`drawBlock` in `worldEngine.ts`).
- **Gebäudetafel:** Adresse, **Größe** (Grundfläche aus dem echten Grundriss, Geschosse) und **heutige Nutzung aus OSM**: zuerst Angaben am Haus selbst (`amenity`, `shop`, `tourism`, `office`, `craft`), dann ein Laden oder Lokal im Haus („Restaurant „Balkan Grill““), dann `building=*` („Mehrfamilienhaus“); ohne Angabe „keine Angabe in OSM (Bauform: …)“. Kennung in der Kachel als `u` (z. B. `a:bar`), Bezeichnungen in `lib/worldlab/buildingUse.ts` (mit Tests). Darunter „Kaufen“ bzw. Flurstück, bei NOXIA-Gebäuden „Betreten“; beim eigenen gekauften Haus „Nutzung: wie bisher: Wohnhaus“ bzw. nach Umbau „Café (vorher: Wohnhaus)“.
- Nicht im Browser geprüft (braucht Anmeldung und Datenbank) – Thomas prüft an einer Bar in Sundern (etwa „Metropol“), ob die Nutzung stimmt.
- Offen bei Bevölkerung und Ökonomie (R-13): Lokale aus OSM nicht verkaufen/umbauen, Startcafé übertragen, Gebäude aus OSM-Relationen kaufbar machen.

Ursprünglicher Request:

Entscheidung Thomas, 25.10.2026 (siehe R-13 bei Bevölkerung und Ökonomie): Lokale entstehen auf der Erde durch Kauf und Umbau bestehender Gebäude, nicht durch Neubau. Dafür braucht die Karte:

- Jedes reale Gebäude aus `region_features` hat eine stabile Kennung (OSM-Id oder Feature-Id), auf die eine `tile_entities`-Zeile verweisen kann; ein gekauftes oder umgebautes Haus zeigt sein Schild und seine Nutzung auf der Karte, steht aber am Grundriss des realen Hauses.
- Klick auf ein reales Gebäude → Gebäudetafel (W-2) mit Adresse, Größe, heutiger Nutzung aus OSM (Wohnhaus, Laden, Bar „Metropol“) und, wenn frei, „Kaufen“; ist es NOXIA-Gebäude, „Betreten“.
- Das selbst gebaute Startcafé soll von der Karte verschwinden, sobald es auf ein reales Gebäude übertragen ist (Übergang in R-13).

### W-5 (Bevölkerung und Ökonomie, 25.10.2026): Umbau zum Lokal in der Gebäudetafel (zu R-13/W-4) – erledigt (25.10.2026)

Umgesetzt (`app/world-lab/WorldPanels.tsx`, Texte in `lib/worldlab/buildingUse.ts` mit Tests):
- **Umbauliste:** je Nutzung Preis, Bauzeit („Bauzeit 2 Std.“ – ein Tick ist eine Stunde) oder „sofort“ und der Hinweis aus `note` („2 Personal · 3 Wohnplätze“). Unten steht, was gilt: bei Lokalen voller Preis mit Bauzeit, bei anderen Nutzungen halbe Baukosten, sofort.
- **Laufender Umbau:** `/api/world-lab/buildings` liefert `conversion` (Ziel, Name, `readyAt` aus `conversion_plan`); die Tafel zeigt „Umbau läuft: Bar – fertig um 21:40“ statt „Umbauen …“.
- **Reale Lokale kaufen:** Metropol und Balkan Grill (Lokale des Ortes) zeigen „Betreten“ und darunter Eigentümer, „Lokal: Bar, schon ausgebaut (+1.800 Cr)“, Preis und „Kaufen“ – über den normalen Kaufweg (`POST { source }`), nicht über Angebote unter Spielern. Freie reale Lokale ohne NOXIA-Gebäude zeigen dieselbe Zeile.
- **Startcafé:** in der Datenbank geprüft (25.10.2026): `cafe` „Hauptstraße 72“ mit `source_ref = osm:way:191141346`, das Haus ist in den Kartendaten; vom alten Platz ist nichts übrig. Die Karte zeichnet es damit auf diesem Grundriss. Ebenso Metropol (`osm:way:191141349`, Hauptstraße 76) und Balkan Grill (`osm:way:332679123`, Hauptstraße 68).
- Nicht im Browser geprüft (braucht Anmeldung): Thomas klickt Metropol an und prüft „Kaufen“ neben „Betreten“.

Ursprünglicher Request:

R-13 ist gebaut (`population-economy.md`). Für die Tafel in `app/world-lab/WorldPanels.tsx`:

- `GET /api/game/building-offer?conversions=<id>` liefert je Nutzung jetzt zusätzlich `buildTicks`, `venue` und `note` (z. B. „2 Personal · 3 Wohnplätze“). Für Lokale gilt **nicht** mehr „halbe Baukosten“, sondern der volle Preis mit Bauzeit; der Hinweis „Hülle und Bewohner bleiben, halbe Baukosten.“ stimmt nur noch für andere Nutzungen. Bitte Bauzeit und `note` anzeigen.
- Während eines Umbaus hat das Haus `conversion_plan` (`type`, `ready_at`), bleibt aber `acquired_building`. Vorschlag: „Wird zum Café umgebaut – fertig um …“ in der Tafel; dafür `conversion_plan` in `/api/world-lab/buildings` mitliefern.
- Reale Lokale (Metropol, Balkan Grill in Sundern) sind jetzt NOXIA-Gebäude des Ortes; die Tafel zeigt sie als „Bar · Metropol“ mit „Betreten“. Seit dem Nachtrag (Thomas, 25.10.2026) sind reale Lokale kaufbar, mit Ausbauwert im Preis: das Angebot liefert dafür `venue` (Lokalart) und `fitOut` (Credits) – bitte in der Tafel zeigen, z. B. „Bar, schon ausgebaut (+1 800 Cr)“. Bei Metropol und Balkan Grill steht „Kaufen“ neben „Betreten“.
- Das Startcafé ist vom alten 24 × 24-m-Platz auf das reale Haus Hauptstraße 72 gezogen (W-4, letzter Punkt); auf der Karte sollte es jetzt den Grundriss dieses Hauses belegen.

### W-6 (Bevölkerung und Ökonomie, 26.10.2026): Porträt beim Anklicken einer Figur – in der Weltkarte erledigt (27.10.2026)

Umgesetzt: Die Personentafel der Weltkarte (`app/world-lab/WorldPanels.tsx`) zeigt oben `NpcPortrait` aus dem Aussehen der Person, wie in der Koloniesicht; die Rolle steht im Porträt nur, wenn die Person bekannt ist (`identityState = 'known'`). Nicht umgesetzt in der alten Erdszene – sie zeigt keine anklickbaren Personen und soll durch die Weltkarte ersetzt werden.


Thomas, 26.10.2026: „NPCs sollten immer noch Porträts zeigen, wenn man sie anklickt.“ Sobald in der neuen Weltkarte Personen stehen: beim Anklicken `NpcPortrait` aus `lib/grid/NpcVisual.tsx` in der Tafel rechts, wie in der Koloniesicht (`app/dashboard/WalkableColony.tsx`). Gleiches für die alte Erdszene (`app/earth/EarthWalkableSurface.tsx`), falls dort Personen erscheinen, solange sie läuft.

### W-7 (Gastronomie, 27.10.2026): Öffentliche NOXIA-Gebäude im realen Haus erkennbar machen – erledigt (27.10.2026)

Umgesetzt:
- `/api/world-lab/buildings` liefert `public: true` für Gebäude des Ortes (`owner_class = 'STATE'`, ohne Spieler als Eigentümer). Betroffen heute: Bank (Sparkasse, Hauptstraße 140), Bar Metropol, Restaurant Balkan Grill.
- **Aussehen** (`drawBlock` in `worldEngine.ts`): öffentliche Gebäude im realen Haus behalten Grundriss und reale Geschosszahl, bekommen aber das Dach aus `NOXIA_LOOKS[typeId]` bzw. `NOXIA_DEFAULT_LOOK`. Gekaufte Häuser sehen weiter aus wie vorher. Das Startcafé (Spielergebäude im realen Haus, nicht gekauft) bleibt wie bisher im Aussehen des realen Hauses.
- **Symbol:** Über jedem öffentlichen Gebäude steht eine runde Plakette mit dem Zeichen der Gebäudeart (€ Bank, § Verwaltung, ✎ Schule, ☕ Café, ♪ Bar, ✦ Restaurant, H Hotel, sonst ◆; Tabelle `PUBLIC_SYMBOLS` in `lib/worldlab/blocks.ts`). Sie ist in jeder Zoomstufe sichtbar, gleich groß auf dem Bildschirm, und anklickbar (öffnet die Gebäudetafel).
- **Kein Aufblitzen:** Ein NOXIA-Gebäude mit `source` bekommt seinen Ersatzblock erst, wenn die Kachel an seiner Position fertig gezeichnet ist und das Haus dort nicht vorkam (`standVisible`).
- Nicht im Browser geprüft (Anmeldung nötig): Thomas bitte bei Sundern auf Sparkasse, Metropol und Balkan Grill schauen.


**Beobachtung (Thomas, 27.10.2026, Dashboard-Karte bei Sundern):** „Bank-Gebäude war kurz da, wurde dann durch die Sundern-Gebäude ersetzt.“

**Was dahintersteckt:**
- Die staatliche Bank steht seit `20261027090000_earth_bank_sparkasse.sql` im realen Haus der Sparkasse, Hauptstraße 140 (`tile_entities.source_ref = osm:way:246890726`).
- `drawBlock` in `app/world-lab/worldEngine.ts` ordnet das Haus richtig zu. Beschriftung „Bank · Sparkasse · Hauptstraße 140“ und „Betreten“ stimmen.
- Das Haus hat aber das Aussehen des realen Hauses, weil `owner.source` gesetzt ist. Diese Regel ist für **gekaufte** Häuser gedacht: „sieht aus wie vorher, nur der Eigentümer ist neu“.
- Bevor die Kachel geladen ist, zeichnet die Karte die Bank kurz als eigenen 24,8 × 16,2-m-Block mit NOXIA-Dach. Danach verschwindet dieser Block. So entsteht der Eindruck, die Bank sei ersetzt worden.

**Bitte:**
1. **Aussehen nach Herkunft:** Gebäude des Ortes (`owner_class = 'STATE'`, nicht vom Spieler gekauft), die einem realen Haus zugeordnet sind, mit realem Grundriss und realer Höhe zeichnen, aber mit dem Dach aus `NOXIA_LOOKS[typeId]` bzw. `NOXIA_DEFAULT_LOOK`. Besser noch mit einem Schild bzw. Symbol der Gebäudeart (Bank, Verwaltung, Akademie), damit man öffentliche Gebäude von Weitem findet. Gekaufte Häuser behalten ihr Aussehen wie bisher.
   - `/api/world-lab/buildings` liefert dafür `ownerLabel: 'Staatlich'`. Ein eigenes Feld (z. B. `public: true`) wäre sauberer.
2. **Kein Aufblitzen:** NOXIA-Gebäude mit `source` nicht als eigenen Block zeichnen, solange die Kachel ihres Hauses noch lädt.
3. **Gilt ebenso für** Metropol und Balkan Grill (Gebäude des Ortes in realen Lokalen) und für alle späteren öffentlichen Gebäude an realen Adressen.

### W-8 (Gastronomie, 28.10.2026): Gebäudenamen auf der Erde ohne Kolonie-Vokabular

**Befund aus der Gesprächsauswertung (G-6, `docs/reviews/npc-gespraeche-testphase.md`):** Ein Pfarrer im Sauerland ist „auf dem Weg zum Habitat“. Erfunden hat er das nicht: Bei Sundern stehen zwei NOXIA-Gebäude der Art `habitat`. Die Weltkarte gibt der Figur ihren Namen aus `building_definitions` („Habitat“) als Ort in der Nähe mit (`nearbyPlaces`, `localFacts` in `app/world-lab/WorldPanels.tsx`).

**Bitte:** Auf der Erde Namen verwenden, die dort üblich sind, z. B. `habitat` → „Wohnhaus“ und `residential_block` → „Wohnblock“. Das gilt für Beschriftung, Gebäudetafel und Gesprächsfakten. Am einfachsten über eine Namenstabelle je Ort, ein Feld im Gebäudezugang oder `display_name`. Auf Mond und Mars bleibt „Habitat“ richtig.

Die übrigen Ortsbefunde aus G-6 stammen aus der alten Erdszene vom 12.10.2026 („keine Straßen hier“, Herceg Novi). Die neue Weltkarte gibt Straße, Ort und Gebäude mit. Ob sie noch vorkommen, zeigt die tägliche Auswertung.

### W-9 (Philosophie/NPC, 28.10.2026): Figuren gehen sichtbar zwischen ihren Orten – erledigt (28.10.2026)

Thomas (28.10.2026): „auch wichtig, dass die NPCs auch normal durch die Stadt oder Station laufen“. Auf seinen Wunsch im Philosophie/NPC-Chat gebaut (Details: `docs/architecture/NOXIA-NPC-RELIGION-0002-philosophie-npcs-davaru-omnizedenten.md`, Abschnitt „Sichtbares Gehen“).

- `WorldLab.tsx`: `/api/world-lab/people` alle 30 s, Bewohnerliste jede Minute nachladen; Schlafende in der Wohnung (`inside`), Freie mit `strollAround` (Wohnung).
- `worldEngine.ts`: Wechselt der Anker, geht die Figur über `planRoute` hin (`startCommute`, endet von selbst); Spaziergang auf den nächsten Straßen um die Wohnung (`pickRoute(seed, base)`), Einstieg dort, wo die Figur gerade ist; `releasePerson` geht zurück statt zu springen.
- `/api/world-lab/people`: zusätzlich `states` (Tätigkeit, Schlaf, Wohnung – Spielgebäude oder realer Grundriss).
- Gemeinsame Regeln und Tempo: `lib/game/population/visibleMovement.ts`.

### W-10 (Philosophie/NPC, 28.10.2026): Gotteshäuser, Gemeindezentren und ArtLounge betretbar, mit den Personen der Simulation – erledigt (28.10.2026)

Auf Wunsch von Thomas im Philosophie/NPC-Chat gebaut (Details: `docs/architecture/NOXIA-NPC-RELIGION-0001-spiritual-roles-and-places.md`, Abschnitt „Innenräume“).

- `WorldPanels.tsx`: Gebäudetafel bietet „Betreten“ für reale Gotteshäuser, Gemeindezentren und das Haus der CAMALEO-ArtLounge (`buildingRoomKind`); Wahrzeichen öffnen den Raum ihrer Religion. Die Tafel nennt, wer gerade drinnen ist.
- `/api/world-lab/people` liefert je Person zusätzlich Rolle, Tätigkeit, letzte Handlung und die OSM-Kennung des Gebäudes (`placeOsm`); neu `/api/world-lab/place-info` (Religion eines realen Gebäudes).
- `LandmarkWalkableInterior.tsx`: Personen der Simulation im Raum, ansprechbar mit ihrer echten ID; neue Möbel und Böden.

### W-11 (Philosophie/NPC, 28.10.2026): Omnizedenz-Begegnungsstätten leicht findbar – erledigt (28.10.2026)

Auf Wunsch von Thomas im Philosophie/NPC-Chat gebaut (Details: `docs/architecture/NOXIA-NPC-RELIGION-0002-philosophie-npcs-davaru-omnizedenten.md`, „Begegnungsstätten leicht findbar“).

- `lib/worldlab/meetingPlaces.ts`: feste Stätten plus jedes Gebäude der Art `resonance_place`.
- `worldEngine.ts`: neue Ebene `beacons` mit `setBeacons()` – Plakette je Stätte, in jeder Zoomstufe gleich groß, Klick öffnet den Ort.
- `WorldLab.tsx`: Zielgruppe „Omnizedenz-Begegnungsstätten“ ganz oben und ohne Entfernungsgrenze (über 6 km: Reisebuchung), Knopf zur nächsten Stätte.
- `WorldPanels.tsx`: Resonanzplätze öffnen den begehbaren Raum `resonance_place` mit den Personen der Simulation, für alle Spieler; Zeichen in `LandmarkGlyph.tsx`.
- Reales Haus Hauptstraße 87, Sundern, über den Flurstückskauf (McKnight) erworben und umgebaut.

## Nicht in diesem Teilprojekt

- Innenräume (Teilprojekt Gastronomie für Café, Bar, Restaurant).
- Bevölkerung, Bedürfnisse, Geld.
