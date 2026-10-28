# Teilprojekt Gastronomie

Maßgeblich: `docs/gameplay/hospitality-venues.md`, `docs/gameplay/settlement-tiers.md`.

## Erledigt

- Bestellen am Tresen angebunden: Karte, gesperrte Posten, `requestId` je Versuch, Gesprächsfakten mit Karte (Branch `feat/hospitality-order-ui`). Beschreibung: `hospitality-venues.md` Abschnitt 5.
- `order`, `serve`, `pay` (dazu `sit`, `consume`) im `INTERIOR_CAPABILITY_REGISTRY`.
- Karten für Bar und Restaurant vorgeschlagen (`hospitality-venues.md` Abschnitt 5), nicht angelegt.
- Lokal ohne Personal: geschlossen oder Automatencafé (Entscheidung Thomas, 10.10.2026). Platzhalter-Wirt entfernt.

- Ortswissen für Figuren im Lokal: reale Geographie aus den Kartendaten plus NOXIA-Einrichtungen am Ort (Branch `feat/hospitality-place-knowledge`). Die Gesprächsroute nimmt dafür das neue, optionale Feld `placeKnowledge` an.

- Karte am ganzen Tresen, Bestelltes sichtbar im Raum, „Für mich / Für <Person>“ beim Bestellen, Kontostand in der Kopfzeile folgt der Bestellung (Branch `feat/hospitality-treat`). Erste echte Bestellung live am 12.10.2026.

- Gebäudeansicht fürs Café auf der Erde: `public/assets/buildings/cafe/earth/style-anchor.svg`, eingetragen in `lib/game/buildings/visuals.ts` (Branch `feat/cafe-building-view`).

- Gebäudeansichten für Bar und Restaurant (Erde), eingetragen in `visuals.ts`.
- Leben im Lokal: Bewohner, die dort in der letzten Stunde wirklich gekauft haben, stehen am Tresen an, gehen um die Möbel herum zu ihrem Platz, sitzen mit ihrer Bestellung und gehen wieder (`guestMoment`, `venuePath`, `GET /api/game/hospitality/guests`). Nichts wird erfunden oder gespeichert.
- Öffnungszeiten nach Koloniezeit (Café 6–20, Restaurant 11–23, Bar 17–2), Mitbekommenes fürs Personal aus echten Ereignissen am Ort, Treppe ins Obergeschoss, sobald das Gebäude Wohn- oder Gästeplätze hat (Branch `feat/hospitality-hours-hearsay-upper`). Beschreibung: `hospitality-venues.md` Abschnitte 3 und 4.
- Karte mit gezeichneten Bildern je Posten statt nur Text, dieselben Bilder im Raum (Branch `feat/hospitality-item-icons`).
- Einführung je Haus: Das Personal führt Neue in eigenem Ton in die Welt ein – Café seriös, Bar zwielichtig, Restaurant gesellig, Haus mit Gästezimmern auf Sehenswertes aus (Branch `feat/hospitality-introductions`).
- Hinsetzen per Klick, „Zum Tresen gehen“, Personal begrüßt am Tresen von sich aus, Gäste setzen sich zum sitzenden Spieler (Branch `feat/hospitality-sit-and-greet`).
- Hafenkantine betretbar (Request G-1): Zugang vom Hafen, Innenraum mit Automat oder Roboter, feste Antworten, Wasser und Ration mit Bildern (Branch `feat/port-canteen-interior`). Beschreibung: `hospitality-venues.md` Abschnitt 1a.
- Kantinenschwarm mit Gedächtnis aus echten Bestellungen, stummer Automat; Startcafé 23–6 Uhr nach Ortszeit des Spielers geschlossen (Branch `feat/canteen-swarm-and-local-hours`).
- Hotel: Lobby mit Empfang, Zimmer buchen als Posten `room_night` über die Bestellroute, Belegung aus echten Buchungen, Gebäudeansicht (Branch `feat/hotel-rooms`). Beschreibung: `hospitality-venues.md` Abschnitt 1b.
- Hotel baubar: Migration `20261014090000_hotel_rooms.sql` (Gebäudeart, 6 Zimmer, Kartenzeile, Belegungsprüfung im Server) – entschieden von Thomas am 14.10.2026, von Gastronomie selbst gebaut (Branch `feat/hotel-buildable`). **Live eingespielt am 14.10.2026.** Transaktionaler Production-Smoke-Test: 6 Zimmer automatisch, erste Buchung erfolgreich, Doppelbuchung desselben Profils abgewiesen, siebter Gast bei sechs belegten Zimmern abgewiesen; Probe vollständig zurückgerollt.
- Bedienung am Tisch (Aufgabe 8) und Kantinenzugang auf dem Mars (Facility-Innenraum) und in Q1 (Hafenviertel) (Branch `feat/canteen-access-mars-q1`, 22.10.2026).
- Figurenbeschriftung: nur Mann/Frau/Junge/Mädchen, bei Bekannten der Name, Alter in Klammern sobald bekannt (`personSceneLabel`, Erdszene und Lokal; Branch `feat/short-person-labels`, 25.10.2026). Die lange Beschreibung steht nur noch in der Personentafel.
- Grundriss nach Gebäudegröße: klein/normal/groß aus der Grundfläche des Hauses (Branch `feat/venue-size-variants`, 25.10.2026) – Vorarbeit für R-13.
- Gemütlichere Räume (26.10.2026, Branch `feat/cozy-interiors`): Holzdielen, Täfelung, Sprossenfenster mit Himmel, runde Holztische mit Vase bzw. Kerze, Bistrostühle, Tresen mit Marmorplatte, Kaffeemaschine und Kuchenvitrine, Flaschenregal in der Bar, Schlüsselbrett im Hotel, Pflanzen, Teppich, warme Lichtkegel über den Tischen, dezentes grünes Ausgangsschild. Im Browser geprüft (alle vier Räume).
- Gezeichnete Porträts (26.10.2026, Branch `feat/person-portraits`): `lib/grid/PersonPortrait.tsx` zeichnet je Person ein Gesicht aus `person_appearance` – Kopfform nach Körperbau, Frisur und Haarfarbe, Bart, Altersgruppe (Kind rundlich, jung mit Wangenrot, älter mit Falten und Grau), Kleidung nach Rolle; Augen- und Mundform fest aus der Personenkennung. In Lokal und Erdszene neben dem Namen. Kann später durch Bilddateien ersetzt werden, wo es welche gibt.
- Akademie als zweite Einrichtung des Innenraum-Motors (26.10.2026, Branch `feat/academy-interior`): Lernraum, Sekretariat, Personal kennt die echten Lernmodule, Module als Kacheln, Lernraum darüber. Im Browser geprüft.
- Verwaltung als dritte Einrichtung (26.10.2026, Branch `feat/admin-interior`): Foyer, Schalter, Aushang mit Einwohnern und Steuern, Personal kennt die öffentlichen Zahlen, Rathaus-Tafel darüber. Im Browser geprüft.
- Raumhafen als vierte Einrichtung (26.10.2026, Branch `feat/spaceport-interior`): Ankunftshalle, Flugleitung kennt die echten Ziele, Navigation/Fracht/Wartung/Kantine als Kacheln darüber. Im Browser geprüft.
- G-4 beantwortet und gebaut (27.10.2026, Branch `feat/venue-conversion-site`): Haus im Umbau als Baustelle mit Fertigstellung, leeres gekauftes Haus, Hausname aus `display_name`; G-5 abgeschlossen mit Maschinenbild in der Kantine.
- Bank und Warenhaus als fünfte und sechste Einrichtung (27.10.2026, Branch `feat/bank-warehouse-interiors`): Schalterhalle mit Kurstafel, Lagerhalle mit Preistafel; Personal kennt Konditionen bzw. Preise, Kontostand nur am Schalter. Im Browser geprüft.

- **27.10.2026 – Bank an der Sparkasse, Beratung, Lernschwellen:**
  - Die staatliche Bank der Erde steht am realen Ort der Sparkasse Sundern, Hauptstraße 140 (`osm:way:246890726`, Migration `20261027090000_earth_bank_sparkasse.sql`, live). Kennung, Konten und Eigentum bleiben.
  - Am Beratungstisch gibt es die Beratungsmappe aus dem echten Konto und das Gespräch mit der Kundenberatung.
  - Jedes Gebäude zeigt unter „Wissen hier“ seine Lernschwellen und öffnet das Lernmodul im Raum: Bank, Warenhaus, Verwaltung, Raumhafen.
  - Der Bankschalter führt beim Kreditschloss direkt ins Modul.
  - Beim Prüfen gefunden und behoben: Der Kundenstuhl am Beratungstisch war nicht besetzbar, weil er im Nebenraum lag.
  - Geprüft im Browser mit Testdaten. Dazu Tests in `learningGates.test.ts` und `bankInterior.test.ts`.

- **28.10.2026 – Bestellen im Gespräch, Toilette, Gesprächsende (G-6):** Was man der Bedienung sagt, wird per Knopf zur echten Buchung; jedes Lokal hat eine WC-Tür (frei für jeden); nach einem Abbruch ist das Eingabefeld gesperrt; im Restaurant heißt der Knopf jetzt „Zum Empfang gehen“. Im Browser am Balkan Grill mit Testdaten geprüft, Tests in `spokenOrder.test.ts`.

- **28.10.2026 – Nachtclub** (Thomas: „ich glaube wir brauchen einen Nachtclub“):
  - Neue Lokalart `nightclub`. Der Raum hat:
    - eine leuchtende, begehbare Tanzfläche vor dem DJ-Pult;
    - einen Tresen, zwei Stehtische und eine violette Lounge;
    - einen Türsteher beim Eingang und das WC.
  - Geöffnet 22 bis 5 Uhr.
  - **Tanzen** ist eine neue Handlung: Auf der Tanzfläche erscheint der Knopf „Tanzen“, die Figur bewegt sich, und das Personal weiß „Dein Gegenüber tanzt gerade“. Gäste auf der Tanzfläche tanzen mit.
  - Eigene Einführung. Eingang, Symbol ♫, Gebäudetafel und „Eintritt“ bzw. „Shot“ im Gespräch sind angelegt.
  - Im Browser mit Testdaten geprüft.
  - Spielbar wird er mit R-19: Gebäudeart, Umbau, Karte und Personal.
  - **Eintritt Pflicht** (Thomas: „nein, man braucht Eintritt“). Ohne bezahlten Eintritt hält eine rote Kordel einen an der Tür. Bezahlt wird beim Türsteher, „Eintritt bezahlen – 8 Cr“. Der Eintritt gilt die ganze Nacht, auch nach dem Hinausgehen. Der Türsteher kennt Preis und Stand. Im Browser geprüft. Die Prüfung auf dem Server bei Bestellungen steht in R-19.

- **28.10.2026 – Arbeiten im Lokal** (Thomas: „man sollte auch im Club arbeiten können“; entschieden: echte Tätigkeit, Stundenlohn und Trinkgeld; Stellen Türsteher, Barkeeper, DJ, Putzkraft, in allen Lokalen):
  - Unter „Arbeiten“ stehen die freien Stellen mit Lohn.
  - In der Schicht (eine Spielstunde) trägt die Figur die Stelle als Plakette. Aufgaben sind im Raum markiert: „Hingehen“, „Erledigen“, DJ-Musikwahl mit Farbwechsel der Tanzfläche.
  - Kollegen und Gäste wissen, dass man hier arbeitet. Der Club-Einlass ist offen.
  - Bis R-20 als Probeschicht ohne Lohn. Im Browser geprüft, Tests in `playerShift.test.ts`.

- **28.10.2026 – Zeit der Schicht und Arbeitsvermittlung** (Thomas: „kein Spieler wartet 4 echte Stunden als Türsteher“; „es sollte auch eine Arbeitsvermittlung geben“):
  - **Einsatz statt Echtzeit-Schicht:** Ein Einsatz dauert 5 echte Minuten und zählt als ganze Schicht von 4 Spielstunden (Putzen 3), nach NOXIA-TIME-0001.
    - Die echten Käufe dieser Stunden werden in den Einsatz verdichtet. Pflichten kommen alle 35–90 Sekunden.
    - Lohn: Stundenlohn × Spielstunden, anteilig bei frühem Gehen.
  - **Agentur für Arbeit:** begehbar, mit Stellenwand (Schichten in den Lokalen des Ortes, nach Nähe sortiert), Vermittlung und Beratungstisch. Betriebe, Schiffe und feste Anstellung stehen als „folgt“ an der Wand.
  - Im Browser geprüft. Tests in `playerShift.test.ts` und `jobAgency.test.ts`.
  - Gebäude, Stellenliste und weitere Stellenarten: R-21.

## Gestellte Requests

- R-1 an Bevölkerung und Ökonomie: Bar und Restaurant baubar machen.
- R-2 an Bevölkerung und Ökonomie: Karten für Bar und Restaurant.
- R-3 an Bevölkerung und Ökonomie: Käufe der Bewohner sind selten, das Lokal meist leer.
- R-4 an Bevölkerung und Ökonomie: Öffnungszeiten als Gebäudedaten; Bewohner kaufen und Personal arbeitet nur in dieser Zeit.
- R-5 an Bevölkerung und Ökonomie: Ausgehen nach Tageszeit.
- R-6 an Bevölkerung und Ökonomie: Wohnen über dem Lokal.
- R-7 an Bevölkerung und Ökonomie: Hotel und Gästezimmer – Nachtrag 13.10.2026: Gebäudeart `hotel`, Kartenzeile `room_night`, Belegungsprüfung im Server.
- R-8 an Bevölkerung und Ökonomie: Gerüchte als Wissen der Personen, Auskunft kaufen und verkaufen.
- R-9 an Bevölkerung und Ökonomie: Lehren aus SunDog – sichtbare Bedürfnisbalken, Wirkung von Alkohol, Ware beim Wirt, Bilder als gemeinsamer Bestand.
- R-10 an Bevölkerung und Ökonomie: echte Angebote als Daten (Stelle auf einem Handelsschiff, Aufträge), damit das Personal sie nennen kann; Einführung auch in anderen Gebäuden.

- **R-14** (27.10.2026): Personal für die Bank an der Hauptstraße 140 und die anderen leeren öffentlichen Gebäude – `population-economy.md`. ✅ Bank und Reisebüro (28.10.2026). Andere öffentliche Gebäude brauchen erst Personalplätze.
- **R-15** (27.10.2026): Lernschwellen serverseitig durchsetzen (Sicherheiten, Zinseszins, Arbitrage, Bodenwert) – `population-economy.md`. Offen: Module fehlen bei SSF; für Zinseszins Vorschlag Festgeld (28.10.2026).
- **R-16** (27.10.2026): Gekaufte Häuser und Lokale als Sicherheit – `population-economy.md`. ✅ 28.10.2026.
- **R-18** (28.10.2026): Preise und Dienstleistungen je Haus durch den Betreiber (Toilette frei als Standard) – `population-economy.md`. ✅ 28.10.2026: `services` und `canEditHouse` im Gäste-Abruf; Ändern über `POST /api/game/hospitality/order { action: 'set_price' | 'set_service' }`; Toilette als Posten `toilet`. Für euch bleibt die Einstellungstafel.
- **R-19** (28.10.2026): Nachtclub als Lokalart – Gebäudeart, Umbau, Karte, Personal, Ausgehen bei Nacht – `population-economy.md`. ✅ 28.10.2026, Eintritt serverseitig Pflicht (`NOXIA_ENTRY_REQUIRED`).
- **R-21** (28.10.2026): Arbeitsvermittlung – Gebäude Freiheitsmühle 1, Stellenliste, Betriebe, Schiffe, feste Anstellung – `population-economy.md`.
- **R-20** (28.10.2026): Spieler arbeiten im Lokal – Stellen, Schicht, Lohn und Trinkgeld über `/api/game/hospitality/shift` – `population-economy.md`.
- **W-8** (28.10.2026): Gebäudenamen auf der Erde ohne Kolonie-Vokabular („Habitat“ → „Wohnhaus“) – `world-map.md`.
- **W-7** (27.10.2026): Öffentliche NOXIA-Gebäude im realen Haus erkennbar machen (Bank sah nach dem Laden aus wie ein normales Haus) – `world-map.md`.

## Requests aus anderen Teilprojekten

Ein Request ist eine Bitte eines anderen Teilprojekts an dieses. Erledigtes hier abhaken und im anfragenden Teilprojekt vermerken.

### G-1 (Bevölkerung und Ökonomie, 13.10.2026): Hafenkantine für Spieler zugänglich machen – erledigt 13.10.2026

Gebaut: Zugang, Innenraum, Automat/Roboter, Bilder. Offen: Notration-Knopf (wartet auf LIVING-0012 Schritt 3), Zugang in Q1 (Hafenviertel hat noch keinen Weg in die Kantine).

Seit 13.10.2026 steht in jedem Hafengebäude eine staatliche Hafenkantine (`port_canteen`, NOXIA-LIVING-0013). Sie ist ein Kind-Gebäude des Hafens (`parent_id` + `slot`), keine eigene Kachel. Bewohner essen dort bereits; Spieler sehen sie noch nicht.

- Zugang: vom Hafengebäude aus erreichbar (z. B. „Kantine“ im Hafen), auch nachts – sie ist rund um die Uhr offen.
- Innenraum: schlicht, Ausgabe, keine Sitzecke. **Bedienung (Entscheidung Thomas, 13.10.2026):** Kleine Kantinen haben nur einen Automaten – wirklich nur Auswahl, Bezahlung, Ausgabe, keine Stimme. Größere Kantinen werden von einem oder mehreren humanoiden Robotern bedient, wie sie in etwa 50 Jahren gebaut werden: erkennbar Maschine, knappe synthetische Stimme. Sie sind vernetzt, erinnern sich und haben ein **Schwarmbewusstsein** – mehrere Roboter sind Körper desselben Schwarms und sprechen gern im Plural. Es gibt **mehrere Schwärme** (Vorschlag: einer je Kolonie bzw. Station, Entscheidung Thomas 13.10.2026); sie teilen ihr Gedächtnis nicht und dürfen sich im Ton unterscheiden. Sie wissen nur, was sie wahrgenommen haben (Gäste, Bestellungen, Ankünfte am Hafen, Gesagtes in Hörweite), sprechen sachlich und ohne Klatsch. Vorschlag: Automat auf Mond und Phobos, Roboter in Tharsis Hub, Prometheus, Q1 und Sauerland. Einzelheiten: NOXIA-LIVING-0013 Abschnitt „Bedienung“.
- Bilder für `water` und `ration` in `HospitalityItemIcon.tsx`.
- Später (mit LIVING-0012 Schritt 3): Notration für Spieler, die den billigsten Posten nicht bezahlen können – Knopf am Tresen, serverseitig geprüft.

### G-2 (Bevölkerung und Ökonomie, 13.10.2026): Startcafé nach Ortszeit des Spielers

Entscheidung Thomas, 13.10.2026: Das Startcafé ist von 23:00 bis 6:00 Uhr geschlossen – nach der **echten Ortszeit des Spielers**, nicht nach Koloniezeit (`VENUE_HOURS` in `lib/game/hospitality/venues.ts` rechnet heute in Koloniezeit).

- Innenraum: Für das Startcafé die Uhr des Spielers verwenden (Browser-Zeitzone bzw. künftig `profiles.time_zone`). Geschlossen heißt: kein Personal am Tresen, kein Einstiegsgespräch, Hinweis auf die Hafenkantine, die rund um die Uhr offen ist.
- Bewohner im Raum folgen weiter der Koloniezeit; das Café kann für Bewohner offen sein, während es für den Spieler zu ist. Darstellung dann: Tür zu, kein Einlass.
- Serverseitige Prüfung der Bestellung übernimmt Bevölkerung und Ökonomie (Antwort auf R-4).

### G-3 (Bevölkerung und Ökonomie, 13.10.2026): Sprache der Figuren im Gespräch

Entscheidung Thomas, 13.10.2026: Sprach- und Kulturvielfalt ist wichtig – in China spricht man häufiger Mandarin als Deutsch. Entwurf: NOXIA-LIVING-0014. Sobald `person_languages` existiert:

- Die Gesprächsroute gibt der Figur ihre Sprachen und Kenntnisse als Fakten mit; die Figur spricht in ihrer Sprache bzw. der besten gemeinsamen.
- Oberfläche: Rede in der Sprache der Figur oder übersetzt mit Kennzeichnung – Vorschlag bitte von hier.
- Karten im Lokal mehrsprachig bzw. in der Ortssprache; Küche je Ort (später).
- R-11 an Bevölkerung und Ökonomie: Alter als Wissen des Spielers, Spieljahr als Funktion. ✅ 28.10.2026: `knownAgeYears` in Bevölkerungs- und Gäste-Abruf, `lib/game/gameCalendar.ts`.
- W-3 an Weltkarte: Lesbarkeit der neuen Karte (Figur, Straßen, Anklickbares, Schilder), doppelte Leisten.
- W-2 an Weltkarte: Layout der neuen Karte – eine Spalte rechts, nur was gerade gebraucht wird, Entwicklerdinge versteckt.
- W-1 an Weltkarte: Straßennamen und Hausnummern in der Spielansicht, Zielwahl nach Adresse.
- R-12 an Bevölkerung und Ökonomie: Name des Spielers und Gefälligkeiten als Wissen der Figur (heute nur drei Wortwechsel Gedächtnis). ✅ 28.10.2026: `npc_player_knowledge`, `npc_player_favors`, Gesprächsroute 1.4.0.
- R-13 an Bevölkerung und Ökonomie, W-4 an Weltkarte: Lokale durch Kauf und Umbau bestehender Gebäude statt Neubau; Startcafé übertragen (Entscheidung Thomas, 25.10.2026).

### G-4 (Bevölkerung und Ökonomie, 25.10.2026): Lokale in gekauften Häusern – was jetzt am Gebäude steht (zu R-13)

R-13 ist gebaut (`population-economy.md`, Migration `20261025180000`). Am Gebäude stehen jetzt:

- `entity_id` = Nutzung (`cafe`, `bar`, `restaurant`, `hotel`); `venueKindForBuildingType` passt also unverändert. Ein Haus im Umbau bleibt `acquired_building` und hat `conversion_plan` (`type`, `ready_at`) – nicht betretbar, bis der Umbau fertig ist.
- `footprint_width_m` × `footprint_depth_m` = Grundriss des realen Hauses (wie erbeten gefüllt); `building_levels` (Geschosse, falls in OSM angegeben), `source_tags` (OSM-Tags: `name`, `amenity`, `addr:*` …), `source_ref` (OSM-Kennung).
- `staff_capacity` (Personalplätze nach Größe), `transient_capacity` (Hotelzimmer aus den Obergeschossen), `residential_capacity` (Wohnungen in den Obergeschossen, R-6).
- **Startcafé** = dieselbe Kennung wie bisher, jetzt Hauptstraße 72 (12 × 11,6 m ≈ 139 m² → „normal“), `display_name` „Hauptstraße 72“.
- **Metropol** (`bar`, ≈ 186 m²) und **Balkan Grill** (`restaurant`, ≈ 158 m²) sind staatliche Gebäude mit Karte. Nachtrag: Spieler können sie (und jedes andere reale Lokal) kaufen; Kennung und Nutzung bleiben, nur der Eigentümer wechselt. Seit 25.10.2026 stellen Lokale selbst Personal ein (Aufgabe 2 bei uns): Arbeitszuweisungen `work` mit `tile_entity_id` des Lokals, Rolle `service`; neu angelegte Personen haben den Schlüssel `earth-local:<Lokal>:<n>` und wohnen oft über dem Lokal. Das Personal erscheint also wie Mika über `/api/game/population?tileEntityId=…`.

Fragen an euch:
1. Soll der Innenraum ein Haus „im Umbau“ zeigen (Baustelle, „öffnet um …“) statt nur nicht betretbar zu sein? `conversion_plan.ready_at` steht dafür bereit.
2. Lest ihr den Namen eines realen Lokals aus `display_name` (z. B. „Metropol“) statt aus der Gebäudeart? Im Gespräch hieße es sonst „die Bar“.
3. Passt die Größe „normal“ für Metropol und Balkan Grill, oder soll `venueSizeForArea` die echte Grundfläche (Polygon) statt Breite × Tiefe nehmen? Wir können die echte Fläche als Spalte nachreichen.

**Antwort Gastronomie (27.10.2026):**
1. Ja – gebaut: Ein Haus mit `conversion_plan` ist betretbar („Haus betreten“, `acquired_building` → hospitality), zeigt den Grundriss der Zielart abgedunkelt mit „IM UMBAU – wird gerade zum Hotel umgebaut; fertig etwa Di., 07:43“ (aus `ready_at`). Ein gekauftes Haus ohne Plan zeigt „LEER“ mit dem Hinweis, dass der Umbau auf der Karte beauftragt wird. `GET /api/game/hospitality/guests` liefert dafür `conversion` und `displayName`.
2. Ja – der Innenraum nimmt `display_name` („Metropol“, „Hauptstraße 72“) für Kopfzeile und Gespräch; fällt er, wird vom übergebenen Namen das Art-Präfix („Bar · “) abgeschnitten.
3. „Normal“ passt für beide (110–260 m²). Die echte Fläche nehmen wir gern: Spalte `footprint_area_m2` nachreichen, dann liest `venueState` sie vor Breite × Tiefe. Bis dahin bleibt Breite × Tiefe.

### G-5 (Bevölkerung und Ökonomie, 26.10.2026): Porträt beim Anklicken einer Figur – erledigt (27.10.2026: Maschinenbild für Kantinenschwarm und Automat in der Kantinen-Tafel; Personen seit 26.10. mit gezeichneten Porträts)

Ausnahmsweise direkt gebaut von Bevölkerung und Ökonomie, auf Wunsch von Thomas (26.10.2026): `CafeWalkableInterior.tsx` 1.1.0 und `LandmarkWalkableInterior.tsx` 2.2.0 zeigen `NpcPortrait` oben in der Seitenleiste. Offen bleibt das Maschinenbild für Kantinenroboter und Automat (unten), sobald sie im Raum stehen.

Thomas, 26.10.2026: „NPCs sollten immer noch Porträts zeigen, wenn man sie anklickt.“ In der Koloniesicht (`app/dashboard/WalkableColony.tsx`) erscheint beim Anklicken `NpcPortrait` aus `lib/grid/NpcVisual.tsx`. Im Café-, Bar- und Restaurant-Innenraum (`app/earth/CafeWalkableInterior.tsx`) und im Innenraum der Wahrzeichen (`app/earth/LandmarkWalkableInterior.tsx`) zeigt die Seitenleiste nur Name und Beschreibung, kein Porträt.

- Beim Anklicken einer Figur oben in der Seitenleiste `NpcPortrait` mit derselben Erscheinung (`appearance`) wie die Figur im Raum.
- Rolle nur, wenn die Person bekannt ist (`identityState === 'known'`), wie in der Koloniesicht; Name nach `personSceneLabel`.
- Kantinenroboter und Automat (NOXIA-LIVING-0013) bekommen ein eigenes Maschinenbild statt eines Menschenporträts.

### G-6 (Bevölkerung und Ökonomie, 27.10.2026): Gespräche – Protokoll, Abbruchsatz und Befunde aus der Testphase

Ausnahmsweise direkt gebaut, auf Wunsch von Thomas (27.10.2026). Er wollte, dass Gespräche gespeichert und ausgewertet werden und dass Figuren bei immer wieder ähnlichen Fragen abbrechen. `app/api/game/npc-conversation/route.ts` 1.2.0 schreibt jede Wortmeldung in `npc_conversation_log`. Die Erkennung von Wiederholungen liegt in `lib/game/cognition/conversationRepeat.ts`. Details und Abfragen: `docs/reviews/npc-gespraeche-testphase.md`.

- **Für die Gesprächsfenster:** Die Antwort trägt `conversationEnded: true` bei Abbruch und Abweisung. Das Fenster könnte sich dann schließen oder das Eingabefeld für eine Weile sperren. Heute setzt der Server die Abweisung allein durch.
- **Befunde aus 69 Wortwechseln zum Gesprächsaufbau:**
  - Mars-Vokabular auf der Erde („auf dem Weg zum Habitat“ im Sauerland);
  - eine Figur in Sundern sagt, es gebe keine Straßen;
  - eine Bestellung wird ergänzt („und die Vorspeise“);
  - eine unbelegte Wegbeschreibung („vorne links“).
- Die ersten drei sprechen für fehlenden oder falschen Ortskontext. Bitte prüfen, welche `localFacts` und welcher `locationName` dort mitgegeben werden.


**Antwort Gastronomie (28.10.2026):** Die Befunde stammen aus den echten Wortwechseln im Protokoll.
- **Erfundene Bestellung** („Wasser und die Vorspeise“): Die Vorspeise steht auf der Karte des Balkan Grill. Vermutlich hat die Bedienung sie angeboten und das „ja“ zum Wasser auf beides bezogen. Der eigentliche Fehler: Gebucht wurde nur über die Knöpfe der Karte, im Gespräch hieß es aber „notiert“. **Gebaut:**
  - Bestellen im Gespräch. Was man der Bedienung sagt, ergibt darunter einen Knopf „Getränk (Wasser) bestellen – 3 Cr“; erst der bucht (`lib/game/hospitality/spokenOrder.ts`).
  - Die Bedienung weiß jetzt: „gebucht ist nur, was der Gast bestätigt – nie ‚notiert‘ sagen“. Am Tisch nimmt sie „nur, was der Gast selbst nennt, nichts dazu“.
- **Wegbeschreibung** („vorne links“, 04.10.2026, Peru-Café): Die Regel gegen unbelegte Richtungsangaben kam am selben Tag in die Gesprächsroute. Seitdem ist der Fall nicht mehr aufgetreten.
- **Habitat und Ortskontext:** gehören zur Erdkarte, siehe W-8 in `world-map.md`.
- **`conversationEnded`:** Das Gesprächsfenster der Innenräume sperrt nach einem Abbruch das Eingabefeld („Gespräch beendet“), für die zehn Minuten der Abkühlzeit.
- **Neu aus dem Protokoll – Toilette:** Eine Passantin schickt einen Spieler zum Balkan Grill. **Gebaut:**
  - Jedes Lokal hat eine WC-Tür („Zur Toilette“, „WC benutzen“). Standard: frei für jeden.
  - Das Personal kennt die Hausregel. Fragt jemand danach, steht sie vorn in seinen Fakten (`lib/game/hospitality/venueServices.ts`).
  - Preise und Dienstleistungen je Haus durch den Betreiber: R-18.

### G-7 (Recherche-Chat „Tools & freie Dienste“, 28.10.2026): Spike – Modell-Router mit Fallback für Gespräche

Hintergrund: Recherche vom 28.10.2026 zu freien Diensten für intelligente NPCs (Bericht `noxia-tools-recherche.md` im Chat, Kurzfassung hier). Thomas hat den Spike am 28.10.2026 freigegeben.

**Befund im Code:** `app/api/game/npc-conversation/route.ts` spricht genau einen Anbieter an (DeepSeek, `api.deepseek.com`, 12 s Timeout). Fällt er aus oder drosselt, antwortet die Route mit 502 – es gibt keinen zweiten Weg. Außerdem: DeepSeek verarbeitet Daten außerhalb der EU; für Spieler in der EU ist das datenschutzrechtlich zu prüfen.

**Was gebraucht wird (Spike, klein halten):**

1. Eine schmale Anbieter-Schicht (`lib/game/cognition/llmRouter.ts` o. ä.), OpenAI-kompatibel, mit Reihenfolge aus Umgebungsvariablen, z. B. `NPC_LLM_CHAIN=local,groq,deepseek`. Jeder Anbieter: Basis-URL, Schlüssel, Modell, eigenes Timeout.
2. Fallback: Bei Timeout, 429 oder 5xx der nächste Anbieter. `logConversationTurn` vermerkt zusätzlich, welcher Anbieter geantwortet hat und wie viele davor scheiterten.
3. Erster zusätzlicher Anbieter: **lokales Modell** über Ollama auf dem eigenen Ubuntu-Server (Vorschlag Gemma 4 E4B oder Qwen3-Kleinmodell); zweiter: **Groq** (Free-Tier, z. B. gpt-oss-120b, 30 Anfragen/Min., 1.000/Tag). DeepSeek bleibt zunächst als letzter Weg.
4. **Vorberechnete Begrüßung:** Die Route hat schon `opening` (Figur spricht zuerst). Wenn sich der Spieler einer Figur nähert, die Begrüßung schon anstoßen, damit sie beim Ansprechen fertig ist. Ziel: unter ca. 800 ms gefühlte Antwortzeit.
5. Ein Café-NPC reicht für den Spike (Vorschlag: Startcafé). Vergleich im Protokoll: `provider_ms` je Anbieter über ein paar Dutzend echte Wortwechsel, plus Stichproben zur Einhaltung der Grounding-Regeln (Mars-Vokabular, erfundene Wege).
6. Budget-Deckel: höchstens N Aufrufe je Figur und Spieler und Tag, Wert als Umgebungsvariable.

**Nicht Teil des Spikes:** Stimmen (Piper/Kokoro), Gedächtnis über pgvector, Concordia-Prüfstand. Die gehören später in eigene Requests.

**Regeln bleiben:** Gespräch erzeugt keine Fakten; Aktionen (`[[ACTION:…]]`) prüft weiter allein der Server; das Prompt bleibt gleich, nur der Anbieter wechselt.

## Offene Aufgaben

2. „Geschlossen“ an anwesendes Personal binden statt an die Arbeitszuweisung, sobald `person_interior_presence` verlässlich geschrieben wird. Stand 28.10.2026: Die Tabelle wird stündlich geschrieben, aber nur für 34 Personen in 18 Häusern. Das Personal von Metropol (2) und Balkan Grill (3) fehlt darin, deshalb noch nicht umstellbar.

3. Ortswissen-Abruf einmal live prüfen (`/api/game/hospitality/place`); die Regeln sind mit echten Daten aus Sundern getestet, der Abruf selbst lief noch nicht.

4. Gäste-Abruf einmal live prüfen (`/api/game/hospitality/guests`): Erscheint nach einem echten Kauf eines Bewohners eine Person am Tresen?
   - **Befund 28.10.2026 aus den Live-Daten:** Gekauft wird. In den letzten 24 Stunden waren es Metropol 2, Startcafé 1, Café Peru 5, Balkan Grill 0.
   - Die Käufe kommen aber gebündelt alle sechs Ticks (01, 07, 13, 19 Uhr UTC), je Lauf mit einem Zeitstempel. Ein Besuch dauert etwa 37 Minuten. Damit kamen alle Gäste eines Laufs zugleich, danach war das Lokal über fünf Stunden leer.
   - **Gebaut:** Jeder Besuch beginnt jetzt fest je Person und Kauf irgendwo im Sechs-Stunden-Abschnitt (`spreadVisitAge` in `venues.ts`, im Gäste-Abruf). Es gibt keinen Gast mehr als vorher, nur über den Abschnitt verteilt.
   - Weiter offen bleibt, dass der Lauf um 01 Uhr UTC mitten in der Nacht liegt (R-5, Ausgehen nach Tageszeit).

5. Öffnungszeiten, Treppe und Mitbekommenes einmal live prüfen; bisher nur Regeltests.

6. ✅ Empfang und Lobby fürs Hotel (13.10.2026, Abschnitt 1b).

7. „Auskunft“ als Posten am Tresen (SunDog: Info kaufen und verkaufen), sobald R-8 entschieden ist.

8. ✅ Bedienung am Tisch (22.10.2026), nur Regeltests.

9. ✅ Hafenkantine in Q1 und auf dem Mars erreichbar (22.10.2026; der Mars-Landeplatz läuft über `FacilityInterior`, dort fehlte der Zugang bisher). Offen bleibt der Notration-Knopf, sobald der Server sie für Spieler ausgibt.

10. ✅ Migration `20261014090000_hotel_rooms.sql` live eingespielt (14.10.2026). Production-Smoke-Test in zurückgerollter Transaktion bestanden: Hotel erhält 6 Zimmer, Zimmerbuchung funktioniert, Doppelbuchung wird abgewiesen, Vollbelegung wird bei 6/6 erzwungen. **Noch offen:** ein persistentes Hotel regulär über die Spieloberfläche bauen und dort die Buchung visuell/end-to-end prüfen.

11. ✅ Gebäudetafel in der neuen Weltkarte (28.10.2026): Bei Lokalen steht unter Größe und Nutzung „● Geöffnet – jetzt 13 Uhr Koloniezeit, von 11 bis 23 Uhr“ bzw. „○ Geschlossen – hier arbeitet gerade niemand“. Es gelten dieselben Regeln wie drinnen (`app/earth/VenueStatusLine.tsx`, `lib/game/hospitality/venueStatus.ts`). Name, Art und „Betreten“ hatte die Erdkarte schon (W-4).

12. ✅ Nach R-13/W-4: Lokalart aus der Gebäudenutzung lesen (`entity_id`), ~~Grundriss nach Gebäudegröße~~ (gebaut), ~~Lokalart aus OSM-Tags~~ (`venueKindForRealPlace`, gebaut), Bar- und Restaurantraum für die realen Lokale in Sundern (Metropol, Balkan Grill) – laufen, im Browser geprüft.

13. ✅ NOXIA-INTERIOR-0001 (26.10.2026, Branch `feat/walkable-interior-engine`): allgemeinen Teil aus `CafeWalkableInterior` als `WalkableInterior` herauslösen (Bewegung, Sitzen, Personen, Tafel, Gespräch, Bedienplatz, Angebotskacheln); das Lokal bleibt dabei unverändert spielbar. Danach können andere Gebäude mit eigener Einrichtung und eigenem Wissen dasselbe Bauteil nutzen.

## Nicht in diesem Teilprojekt

- Wirt als Bewohner mit Stelle und Lohn, Stellenzahl aus den Personalplätzen.
- Hunger und Durst als Bedürfnisse, auch für Spieler (entschieden am 12.10.2026, liegt bei Bevölkerung und Ökonomie). Sobald es sie gibt: im Lokal anzeigen, was ein Posten stillt.
- Wirkung des Lokals auf Stimmung.
