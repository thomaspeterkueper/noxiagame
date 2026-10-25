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
3. Kacheln vorab erzeugen und als Dateien ablegen statt bei jedem ersten Abruf aus der Datenbank zu rechnen.
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
6. Weite Strecken: Der Zeichenanker liegt fest am Startpunkt; für Reisen über viele Kilometer muss er mitwandern.
7. ~~Datenlücke~~ Teilweise erledigt: `/world-lab` holt Ortsdetail (Gebäude, Wohnstraßen, Wege) selbst nach – beim Start für die Zelle um die Figur, in bebauten Kacheln ohne Gebäude selbsttätig, sonst mit „Kartendaten hier nachladen“. Offen: prüfen, ob Overpass zuverlässig antwortet; Zellen ohne Bebauung werden nicht geholt.
8. ~~Sportplätze~~ Erledigt: Import und Darstellung gebaut (Importprofil 4). Datenbank geprüft am 25.10.2026: 24 Sportflächen in Sundern, darunter Röhrtalstadion und Sportplatz Sundern (Request nach `internal-tasks/done/`).
9. Kirchen haben jetzt einen Turm an der Stirnseite (geschätzt, OSM sagt nicht, wo er steht), Höhen aus OSM `height` werden genutzt. Einzelbilder für besondere Gebäude (Kirche, Bahnhof, Café, NOXIA-Gebäude): ganzes Bild in derselben Ansicht mit Fußpunkt, statt aus Wandstücken zusammengesetzt. Maße stehen in der Zeichenvorlage.
10. ~~Häuser vor der Figur durchscheinend~~ Erledigt (25.10.2026): Ein Haus, das vor der Figur gezeichnet wird und sie überdeckt, wird durchscheinend (Deckkraft 0,4); geprüft alle 120 ms in den Kacheln um die Figur (`updateSeeThrough`).
11. ~~Gescheiterte Kartenabrufe nachholen~~ Erledigt – geprüft am 25.10.2026: keine leere Erdregion mehr; Frankfurt 5 267 Objekte, Darmstadt (als „Langen“ benannt, der Punkt liegt nördlich der Stadt) 1 456, Datong 842, Sunderner Innenstadt 1 285. Gebaut als gebaut als stündlicher Lauf `/api/cron/world-places` (vercel.json, Minute 25). Er nimmt je Lauf höchstens zwei leere Orte aus `celestial_regions` und versucht sie über die bestehenden Importwege erneut, jeden frühestens drei Stunden nach dem letzten Versuch. Betroffen beim Start: Frankfurt (50,1106 / 8,6821), Darmstadt (49,9915 / 8,6667), Datong (40,0923 / 113,2953) und fünf leere Ortsdetail-Zellen in Sundern, u. a. die Innenstadt (51,327 / 8,0032). Offen: nach einigen Läufen prüfen, ob alle gefüllt sind; Ergebnis steht im Vercel-Log unter `[world-places]`.
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
- Offen: andere Bundesländer mit offenem Kataster (z. B. Berlin, Hamburg, Sachsen, Thüringen) anbinden; Flurstücke zusammenlegen/teilen; Verkauf an andere Spieler.

### Bereinigung 25.10.2026 (Thomas: „meine selbst gebauten Gebäude passen nicht mehr“)

McKnights elf Bauten in Sundern aus der Zeit vor der echten Karte entfernt (2 Wohnblöcke, Habitat, Schule, Fabrik, Warenhaus, Bank, Raumhafen-Kern, 3 Solarfelder), ohne Erstattung. Die fünf Bewohner (4 aus dem Wohnblock, 1 aus dem Habitat) wohnen jetzt im staatlichen Wohnblock Selmecke (`203e82d7…`, 8 von 12 Plätzen), Mietverhältnis als Bereinigung (`origin = backfill`), Präsenz mitverschoben. Café („Thomas“) und die staatlichen Bauten in Selmecke bleiben.

### Tafeln rechts (Thomas, 25.10.2026)

„Du bist hier“, Zielliste und Adresssuche stehen wieder rechts oben wie in der alten Szene, die Tafel des gewählten Objekts direkt darunter. Links bleiben Hilfe, Schnellziele, Messwerte und die Rückwege.

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

### W-5 (Bevölkerung und Ökonomie, 25.10.2026): Umbau zum Lokal in der Gebäudetafel (zu R-13/W-4)

R-13 ist gebaut (`population-economy.md`). Für die Tafel in `app/world-lab/WorldPanels.tsx`:

- `GET /api/game/building-offer?conversions=<id>` liefert je Nutzung jetzt zusätzlich `buildTicks`, `venue` und `note` (z. B. „2 Personal · 3 Wohnplätze“). Für Lokale gilt **nicht** mehr „halbe Baukosten“, sondern der volle Preis mit Bauzeit; der Hinweis „Hülle und Bewohner bleiben, halbe Baukosten.“ stimmt nur noch für andere Nutzungen. Bitte Bauzeit und `note` anzeigen.
- Während eines Umbaus hat das Haus `conversion_plan` (`type`, `ready_at`), bleibt aber `acquired_building`. Vorschlag: „Wird zum Café umgebaut – fertig um …“ in der Tafel; dafür `conversion_plan` in `/api/world-lab/buildings` mitliefern.
- Reale Lokale (Metropol, Balkan Grill in Sundern) sind jetzt NOXIA-Gebäude des Ortes; die Tafel zeigt sie als „Bar · Metropol“ mit „Betreten“. Andere reale Lokale ohne Eintrag melden „Nicht verkäuflich: Lokal des Ortes“.
- Das Startcafé ist vom alten 24 × 24-m-Platz auf das reale Haus Hauptstraße 72 gezogen (W-4, letzter Punkt); auf der Karte sollte es jetzt den Grundriss dieses Hauses belegen.

## Nicht in diesem Teilprojekt

- Innenräume (Teilprojekt Gastronomie für Café, Bar, Restaurant).
- Bevölkerung, Bedürfnisse, Geld.
