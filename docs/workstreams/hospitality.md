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
- R-11 an Bevölkerung und Ökonomie: Alter als Wissen des Spielers, Spieljahr als Funktion.
- W-3 an Weltkarte: Lesbarkeit der neuen Karte (Figur, Straßen, Anklickbares, Schilder), doppelte Leisten.
- W-2 an Weltkarte: Layout der neuen Karte – eine Spalte rechts, nur was gerade gebraucht wird, Entwicklerdinge versteckt.
- W-1 an Weltkarte: Straßennamen und Hausnummern in der Spielansicht, Zielwahl nach Adresse.
- R-12 an Bevölkerung und Ökonomie: Name des Spielers und Gefälligkeiten als Wissen der Figur (heute nur drei Wortwechsel Gedächtnis).
- R-13 an Bevölkerung und Ökonomie, W-4 an Weltkarte: Lokale durch Kauf und Umbau bestehender Gebäude statt Neubau; Startcafé übertragen (Entscheidung Thomas, 25.10.2026).

## Offene Aufgaben

2. „Geschlossen“ an anwesendes Personal binden statt an die Arbeitszuweisung, sobald `person_interior_presence` verlässlich geschrieben wird.

3. Ortswissen-Abruf einmal live prüfen (`/api/game/hospitality/place`); die Regeln sind mit echten Daten aus Sundern getestet, der Abruf selbst lief noch nicht.

4. Gäste-Abruf einmal live prüfen (`/api/game/hospitality/guests`): Erscheint nach einem echten Kauf eines Bewohners eine Person am Tresen?

5. Öffnungszeiten, Treppe und Mitbekommenes einmal live prüfen; bisher nur Regeltests.

6. ✅ Empfang und Lobby fürs Hotel (13.10.2026, Abschnitt 1b).

7. „Auskunft“ als Posten am Tresen (SunDog: Info kaufen und verkaufen), sobald R-8 entschieden ist.

8. ✅ Bedienung am Tisch (22.10.2026), nur Regeltests.

9. ✅ Hafenkantine in Q1 und auf dem Mars erreichbar (22.10.2026; der Mars-Landeplatz läuft über `FacilityInterior`, dort fehlte der Zugang bisher). Offen bleibt der Notration-Knopf, sobald der Server sie für Spieler ausgibt.

10. ✅ Migration `20261014090000_hotel_rooms.sql` live eingespielt (14.10.2026). Production-Smoke-Test in zurückgerollter Transaktion bestanden: Hotel erhält 6 Zimmer, Zimmerbuchung funktioniert, Doppelbuchung wird abgewiesen, Vollbelegung wird bei 6/6 erzwungen. **Noch offen:** ein persistentes Hotel regulär über die Spieloberfläche bauen und dort die Buchung visuell/end-to-end prüfen.

11. Gebäudetafel in der neuen Weltkarte: beim Klick auf ein Lokal Name, Art, offen/geschlossen mit Uhrzeit und „Betreten“ – sobald W-2 dort eine rechte Spalte liefert.

12. Nach R-13/W-4: Lokalart aus der Gebäudenutzung lesen, ~~Grundriss nach Gebäudegröße~~ (gebaut), Bar- und Restaurantraum für die realen Lokale in Sundern (Metropol, Balkan Grill).

## Nicht in diesem Teilprojekt

- Wirt als Bewohner mit Stelle und Lohn, Stellenzahl aus den Personalplätzen.
- Hunger und Durst als Bedürfnisse, auch für Spieler (entschieden am 12.10.2026, liegt bei Bevölkerung und Ökonomie). Sobald es sie gibt: im Lokal anzeigen, was ein Posten stillt.
- Wirkung des Lokals auf Stimmung.
