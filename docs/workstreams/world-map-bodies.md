# Teilprojekt Weltkarte jenseits der Erde

Ziel (Thomas, 06.11.2026): „wir haben die Erde nun schon sehr hübsch gemacht, es wird Zeit, dass wir das mit den anderen Himmelskörpern auch tun.“

Entschieden (Thomas, 06.11.2026):

1. **Erster Ort: Mars / Tharsis Hub** (vor Mond/Shackleton und Q1).
2. **Eine Zeichenmaschine für alle Körper.** `app/world-lab/worldEngine.ts` bleibt die eine Maschine; der Körper liefert nur Projektion, Boden, Sonne und seine Daten. Laufen, Personen, Tafeln und Betreten sind gemeinsam.

Dieses Teilprojekt läuft **neben** der bisherigen Marsoberfläche (`PlanetaryWalkableSurface`) und ersetzt sie erst nach ausdrücklicher Entscheidung von Thomas.

## Stand (06.11.2026)

Im Spiel: Auf dem Mars (Kolonieansicht) schaltet der Knopf „◇ Neue Weltkarte“ unten links auf die neue Karte, „← Bisherige Kolonieansicht“ zurück. Die Wahl merkt sich der Browser je Ort (`noxia-body-view-v1:<slug>`); ohne Wahl bleibt die bisherige Ansicht, weil sie schon MOLA-Gelände zeigt.

| Baustein | Ort |
|---|---|
| Projektion mit dem Umfang des Körpers (eigene Datei, damit `mercator.ts` und damit das Kachelformat der Erde unverändert bleiben) | `lib/worldlab/bodyProjection.ts` |
| Was ein Körper der Maschine liefert: Projektion, Bodenfarbe, Sonnenstand, „draußen nur im Anzug“, Schwerkraft; welche Orte die neue Karte schon zeigt | `lib/worldlab/bodies.ts` |
| Sonnenstand auf dem Mars (Allison & McEwen 2000 wie Mars24): Tag und Nacht folgen dem Sol, Ortszeit in der Kopfzeile | `lib/worldlab/marsSun.ts`, Tests daneben |
| Kacheln aus den Wegen des Ortes (kein OSM); vorerst ohne Wege, siehe unten | `lib/worldlab/bodyTiles.ts`, Tests daneben |
| Gebäude mit echter Lage: `world_frames` (Ursprung) + `tile_entities.x_m/y_m` → Breite/Länge des Körpers | `GET /api/world-lab/body?location=mars` |
| Ansicht (Kopfzeile, Gebäude- und Personentafel, Gespräch, Betreten) | `app/world-lab/BodyWorld.tsx` |
| Einbau ins Spiel | `app/dashboard/DashboardMarsSurface.tsx` |
| Neue Optionen der Zeichenmaschine (`projection`, `ground`, `sunElevation`); ohne sie gilt die Erde wie bisher | `app/world-lab/worldEngine.ts` |

Wie es arbeitet:

- **Ein Koordinatensystem je Körper.** Mercator mit dem Marsradius (IAU-Ellipsoid, 3 396 190 m), Kachelstufe 17 wie die Erde – eine Kachel ist bei Tharsis rund 158 m groß. Abstände im Ortsrahmen bleiben auf der Karte erhalten (Test: Warenlager → Reaktor 546 m, Abweichung unter 1 m).
- **Keine erfundenen Lagen.** Gebäude ohne metrische Lage (nur alter Rasterplatz, `legacy_tile`) werden nicht gezeichnet; die Kopfzeile nennt ihre Zahl (Tharsis: 1 von 47). Rasterplätze werden nicht in Meter umgerechnet (`ADR-single-world-surface`).
- **Wege: vorerst keine.** `bodyTiles.ts` kann Wege des Ortes (Meter Ost/Nord) als Straßen in die Kacheln legen. Der Seed-Wegeplan `THARSIS_HUB_SURFACE_CORRIDORS` passt aber nicht zu den Gebäuden in der Datenbank: Der Seed legt z. B. den Medical Core auf Raster 14/16, die Datenbank hat ihn bei −170/170 m (Raster 3/7) – die Wege lägen südwestlich neben der Siedlung (im Probebild sichtbar). Deshalb zeichnet die Karte noch keine Wege; „Gehe hin“ geht gerade. Dieselbe Abweichung steckt in der bisherigen Marsoberfläche, die die Seed-Wege zeigt.
- **Siedlungsfläche**: Die Maschine legt um nahe beieinanderstehende NOXIA-Gebäude eine befestigte Fläche mit Zaun und Lampen (wie Landeplätze auf der Erde) – auf Tharsis ergibt das den Druckkern als eine Fläche.
- **Bewohner** stehen vor ihrer Arbeit oder Wohnung; wer in einem betretbaren Gebäude arbeitet oder schläft, ist drinnen. Gespräch ab 8 m über `/api/game/npc-conversation` mit den Gebäuden der Umgebung als Ortswissen; `visit_place` schickt die Person zum Gebäude.
- **Betreten** öffnet denselben Innenraum wie die bisherige Marsoberfläche (`BuildingInterior`).
- **Tag und Nacht** nach dem Marstag (24 h 39 min), nicht nach der Erduhr.

## Geprüft und nicht geprüft

- Geprüft im Browser mit den echten Gebäudelagen (Prüfseite, Chromium ohne Grafikkarte, 06.11.2026): 46 Gebäude stehen auf rostbraunem Grund, Mars-Bilder für Solarfelder, Reaktoren, Landeplatz, Kantine u. a.; Habitate erscheinen als Ersatzblock (kein Kartenbild). Nicht geprüft: Anmeldung, Bewohner, Gespräch, Betreten.
- Geprüft: Projektion, Lageumrechnung, Kacheln und Mars-Sonnenstand mit Tests (`bodyTiles.test.ts`, `marsSun.test.ts`; Ls am 06.01.2000 wie Mars24); Typprüfung des ganzen Projekts; Kachelformat der Erde unverändert (`tileFormat.test.ts`).
- Datenbank (06.11.2026): Alle Orte außerhalb der Erde haben einen Ursprung in `world_frames` und fast alle Gebäude metrische Lagen (Mars 46/47, Mond 27/27, Phobos 16/16, Deimos 3/3, Mishkan Avi 4/4, Prometheus 13/14, Q1 5/17).
- **Noch nicht geprüft: die Ansicht im Browser mit echten Daten.** Thomas: Mars öffnen → „◇ Neue Weltkarte“, herumlaufen, ein Gebäude betreten, eine Person ansprechen.

## Offene Aufgaben

1. Thomas prüft die Karte im Browser (siehe oben).
2. **Gelände** – MOLA-Höhen je Kachel als Hangschattierung und Höhenlinien wie `lib/worldlab/terrain.ts` auf der Erde. Daten und Abruf gehören dem Bereich Mars: Request `coordination/open/20261106-0700-bodies-to-mars-mola-terrain-tiles.md`.
3. **Anzug draußen** (Thomas: auf anderen Himmelskörpern draußen nur im Anzug oder Fahrzeug): Figur im Druckanzug für Spieler und Bewohner, Kartenbild für Habitat, Lager, Reaktor auf dem Mars. Request `coordination/open/20261106-0701-bodies-to-graphics-suit-and-mars-map-assets.md`. Bis dahin zeigt die Karte die normale Figur.
4. **Wege klären**: Welcher Plan gilt für Tharsis – die Gebäudelagen der Datenbank oder der Seed (`NOXIA-WORLD-0003`)? Danach Wege aus dem gültigen Plan. Gehört dem Bereich Mars/Core, Frage an Thomas.
5. **Durchgänge zwischen Modulen** (Thomas: der Weg führt oft durch andere Gebäude) – als eigene Wegart, auf der man ohne Anzug geht; die Fahrwege bleiben draußen.
6. **Flächen**: Landefeld, Radiatorfelder, Solarfelder, Druckkern als Flächen statt nur als Gebäude.
7. **Mishkan Avi** (Mars, −10,5° / −72,5°) in `WORLD_MAP_LOCATIONS` aufnehmen – geht ohne Umbau, sobald Tharsis geprüft ist.
8. **Mond / Shackleton** (89,8° S): Mercator geht am Pol nicht. Braucht eine Polarprojektion (polar-stereografisch, wie LOLA-Polardaten) in `bodyProjection.ts` – die Maschine selbst bleibt.
9. **Phobos, Deimos**: kleine, unregelmäßige Körper – lokale Projektion um den Ort; Schwerkraft fast null (Ankerseile, Bewegung).
10. **Stationen (Q1, Prometheus)**: keine Oberfläche; Decks und Module statt Gelände. Eigenes Vorhaben mit Orbit/Raumstationen.
11. Wenn alles da ist, was die bisherige Ansicht kann: Thomas entscheidet, ob die neue Karte Standard wird.

## Requests aus anderen Teilprojekten

(noch keine)
