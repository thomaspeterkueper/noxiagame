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
  - **29.10.2026:** Agentur live angelegt im realen Haus Freiheitsmühle 7 (Thomas: „nimm das Gebäude, das besser passt“; bei Nr. 1 gibt es nur schmale Winkelbauten). Kartensymbol ⚒. Personal folgt mit R-21.

- **29.10.2026 – VERA, Vermittlungsroboter der Agentur:**
  - Thomas: „Personal oder wenigstens Roboter, damit wir Arbeitssuchende beraten und aus dem Gespräch neue Ideen für NOXIA entwickeln können … vielleicht hilft das auch Personen, die im echten Leben noch orientierungslos sind“.
  - Der Motor kann jetzt Figuren ohne Personeneintrag (`extraResidents`, Kennung `robot:…`), mit eigener Roboterfigur und eigenem Bild.
  - VERA berät in der Spielwelt, nimmt Wünsche nach neuen Arbeiten auf und hilft bei Fragen zum echten Leben, mit Verweis auf die echte Berufsberatung und Check-U. Sie sagt offen, dass sie eine Maschine und Spielfigur ist.
  - Im Browser geprüft, Tests in `jobAgency.test.ts`. Auswertung der Wünsche: R-22.

- **29.10.2026 – Direkt vermitteln:**
  - Thomas: „bei offenen Stellen, die die Agentur kennt, können wir ja auch direkt vermitteln“.
  - An der Vermittlung hat jede Stelle „Vermitteln lassen“.
  - Im Gespräch mit VERA oder dem Personal erscheint ein Knopf für eine genannte Stelle, z. B. „Als DJ vermitteln: Hauptstraße 50“. Wie beim Bestellen gilt: Vermittelt ist erst, was der Spieler bestätigt.
  - Der Schein gilt zwei Stunden. Das Personal im Lokal weiß davon, und die Stelle steht dort oben.
  - „Gleich hingehen und anfangen“ öffnet das Lokal, und die Schicht beginnt sofort.
  - Im Browser geprüft; Tests in `jobAgency.test.ts`.
  - Offen: W-12 (Figur auf der Karte beim Lokal absetzen) und R-22 Punkt 4 (Schein serverseitig).

- **30.10.2026 – Bezahlte Schichten nach Leistung:**
  - Thomas: „Geld gibt es nur, wenn auch die Aufgaben erfüllt wurden, sonst Abzüge … keine Folgeanstellung am selben Ort, wenn bei drei Schichten immer noch keine Aufgaben erledigt wurden … für Nichtstun gibt es kein Geld.“
  - Der Schichtweg (R-20) ist gebaut und live. Regeln in `playerShift.ts` (`shiftPay`, `employerShiftFacts`, `shiftEndText`), gerechnet in der Datenbank.
  - Lohn: ab drei Vierteln der Aufgaben voll, darunter anteilig, ohne Aufgabe nichts.
  - Drei Leerschichten in Folge bedeuten eine Woche keine Schicht in diesem Haus.
  - Das Personal erklärt Lohn und Sperre im Namen des Betreibers. In der Schicht zeigt die Tafel, was bisher verdient ist und wie viele Aufgaben zum vollen Lohn fehlen.
  - In der Datenbank durchgerechnet, im Browser geprüft. Offen bei Population: Trinkgeld, Lohnsätze aus `role_wage_rates`.

- **02.11.2026 – Friedhof, davon hier: der Beerdigungskaffee:**
  - Thomas: „Zwischenidee: ein Friedhof“. Entschieden: begehbarer Ort, Bewohner sterben, Beerdigungen, Gedenkort – verteilt als W-13, R-23 und P-1 (Philosophie/NPC, in `NOXIA-NPC-RELIGION-0001`).
  - Gebaut: Beerdigungskaffee im Lokal (`lib/game/hospitality/funeralReception.ts`), sobald Population ihn als Sondertermin `funeral_reception` ansetzt (Vertrag in R-23 Punkt 6).
  - Tafel „Beerdigungskaffee für …“. Personal bedient taktvoll; Gastgeber und Trauergäste wissen, für wen er ist, und erfinden keine Erinnerungen.
  - Der Spieler kann sein Beileid aussprechen. Neu im Motor: `ctx.say(text)`.
  - Ohne Termin gibt es nichts. Tests in `funeralReception.test.ts`, im Browser mit Probetermin geprüft.

- **03.11.2026 – Gemeinsam im Lokal (Begleitung bleibt beim Spieler):**
  - Thomas: „die Charaktere sind noch nicht sehr authentisch, vor allem bei gemeinsamen Aktionen“. Befund im Protokoll: Lukas Brüggemann ging am 28.10. mit Thomas in die Bar und schwieg dort.
  - Jetzt bleibt die Begleitung beim Spieler: selber Tisch oder neben ihm (`companionPlace`).
  - Das Gespräch von draußen geht weiter (`companionHistory`). Die Begleitung weiß, was ausgemacht war, und das Personal begrüßt beide (`companionFacts`).
  - Gespräche bleiben beim Wechsel zwischen Personen erhalten.
  - Nebenbei behoben: „im Café Café“.
  - Kinder, Lebensläufe, Kita, Schule, Spielplatz: R-24 und W-14.

- **03.11.2026 – Echte Lokale öffnen das volle Lokal:**
  - Thomas: „Lokale zusammenführen“.
  - Reale Cafés, Bars, Kneipen und Restaurants der Karte bekommen beim ersten Betreten ein NOXIA-Lokal (`noxia_real_venue`). Sie öffnen `CafeWalkableInterior` über `RealVenueInterior`, mit den Anwesenden der Simulation als Personal und Gästen.
  - In der Datenbank durchgerechnet (vorhandenes Metropol wird gefunden, neues Lokal angelegt und beim zweiten Mal wiedergefunden, Karte vorhanden). Im Browser mit Probeort geprüft.
  - Requests: W-15, R-28, P-2.

- **04.11.2026 – W-15 fertig:**
  - Wer mit jemandem losgeht – vorausgehen lassen oder gemeinsam zu einem Ort –, nimmt ihn mit ins Lokal, auch ins reale. Das Gespräch geht drinnen weiter, ohne doppelte Figur.
  - Die Stellenwand der Agentur kennt reale Lokale mit Personal.
  - Im Browser geprüft.

- **04.11.2026 – Hausregeln, bezahlte Toilette, Familien:**
  - **Hausregeln für Eigentümer:** Im eigenen Lokal steht „Hausregeln: Preise, Angebot, Toilette“. Dort lässt sich je Posten ein eigener Preis setzen oder der Posten von der Karte nehmen. Die Toilette ist frei, nur für Gäste, mit Gebühr oder gar nicht da.
    - Gespeichert über `set_price` und `set_service` (R-18). Den Eigentümer prüft die Datenbank.
    - `GET /api/game/hospitality/order` liefert dem Eigentümer `houseMenu`, die ganze Karte der Lokalart.
  - **Toilette mit Gebühr:** Sie wird wie ein Posten gebucht (`toilet`). Die Gebühr steht am Knopf, und wer eben erst war, zahlt nicht gleich noch einmal.
  - **Familien (vorbereitend, R-24):**
    - Kakao und Kinderteller auf der Karte (Café; Restaurant nur Kinderteller).
    - Keine Kinder in Bar und Nachtclub, kein Alkohol an Kinder (auch nicht ausgegeben).
    - Kinder wissen im Gespräch, dass sie mit niemandem mitgehen und nichts Persönliches verraten. Kinder kommen nicht als Begleitung mit.
    - Regeln in `lib/game/hospitality/familyRules.ts`, Tests vorhanden.
  - In der Datenbank als `service_role` durchgerechnet (Preis 5, Kuchen abbestellt, Toilette 2 Cr gebucht), im Browser geprüft.

- **04.11.2026 – Credits untereinander:**
  - Thomas: „Trinkgeld lassen wir weg, aber es sollte Möglichkeiten geben, generell Credits untereinander auszutauschen.“
  - **Bar:** In jedem Innenraum gibt es im Gespräch „Credits geben …“ – an den Bewohner, mit dem man spricht. Er weiß es im Gespräch und reagiert darauf.
  - **Überweisung** am Bankschalter: an Spieler (Spielername, höchstens 2000 Cr am Tag) oder an Bewohner, deren Namen man kennt, mit Verwendungszweck. Darunter stehen die Ein- und Ausgänge.
  - Bewohner an Spieler: Funktion für Population (R-29).
  - In der Datenbank als `service_role` durchgerechnet, im Browser geprüft.
  - Trinkgeld entfällt.

- **04.11.2026 – Andere Spieler im selben Raum:**
  - Thomas: „andere Spieler sollten gleichzeitig in der gleichen Welt, Bar, Orten usw. sein können“.
  - In allen Innenräumen des Lokal-Motors sieht man andere Spieler als Figuren mit Namen (Supabase Realtime Presence, `roomPresence.ts`).
  - Winken, Zuprosten, Credits bar geben.
  - Bewohner wissen, dass weitere Gäste da sind.
  - Karte, Auto, Raumschiff: W-16. Freier Chat zwischen Spielern: offen, Schutzregeln nötig.

- **04.11.2026 – Raum-Chat zwischen Spielern, alles protokolliert:**
  - Thomas: „Chats zwischen Spielern auch freischalten; alles, was gerade passiert, wenn jemand kommt, ist wichtig.“
  - Im Innenraum gibt es „IM RAUM“: Nachrichten an alle im Haus, mit Verlauf der letzten 30 Minuten und „melden“.
  - Kontaktdaten werden für die anderen entfernt. Ein Hinweis sagt, dass in der Testphase gespeichert und ausgewertet wird.
  - Protokolliert werden Kommen, Gehen, Gesten und Meldungen (`player_room_log`). Zustellung über Ably, gesendet nur über den Server.
  - Tests in `roomChat.test.ts`; im Browser mit nachgestellten Mitspielern geprüft. Auswertung: R-30.

- **04.11.2026 – Kiesel-Figuren:**
  - Thomas wählt aus drei Entwürfen (Figurenwerkstatt) den Stil „Kiesel“.
  - Generator `lib/figures/kiesel.ts` mit Tests. Alle Innenräume zeichnen Bewohner, Spieler und Mitspieler jetzt als Kiesel, mit Blickrichtung aus der Bewegung, Gehen, Sitzen und Kleidung nach Arbeit (Schürze im Café, Weste an der Bar).
  - Im Browser geprüft. Karte: W-17; Aussehen für alle, Alter und Kleidung: R-31.

- **04.11.2026 – Kiesel überall, Tanzen, Arbeit, Rangelei, Kampf:**
  - Thomas sah im Spiel noch keine neuen Figuren; auf seinen Wunsch auch Erdkarte, Oberflächen, Kolonie und Landmarken auf Kiesel umgestellt (W-17).
  - Neue Posen in seiner Steigerung:
    - Tanzen;
    - Arbeit mit Werkzeug wie in Siedler: Tablett, Glas polieren, Wischen, Hämmern, Hacken, Schaufeln;
    - Rangelei: Schubsen, Hinfallen;
    - Kampf: Zuschlagen, Abwehren, Getroffen, am Boden, mit Pflaster für Verletzte.
  - Im Lokal:
    - Gäste und Spieler tanzen auf der Tanzfläche.
    - Das Personal arbeitet sichtbar, mit Pausen: Putzkraft wischt, Tresen poliert, Bedienung trägt das Tablett, der DJ tanzt.
    - Rangelei und Kampf kommen nur aus Population-Ereignissen `venue_incident` (`venueIncident.ts`, mit Test): Posen, Hinweis, Wissen der Figuren.
  - Regeln und Folgen: R-32; Haltung zu Streit: P-3.

- **04.11.2026 – Gesten und gemeinsame Bewegungen (nach Second Life):**
  - Thomas: „wir können uns da auch Sachen von Second Life abschauen“ – „alles nacheinander“. Übernommen ist die Spielmechanik, nicht Namen oder Bilder.
  - **Gesten:** Winken, Jubeln, Klatschen, Verbeugen, Prost, Tanzen.
    - Per Knopf oder im Chat („/winken“, „/prost“).
    - Mitspieler sehen sie über die Anwesenheit.
    - Eine Figur in der Nähe weiß, dass man ihr zugewinkt hat.
  - **Gemeinsam:** Zusammen tanzen, Anstoßen, Hand geben, Umarmen, Trösten.
    - Mit Spielern: Einladung, die andere Seite sagt „Gern“ oder „Lieber nicht“; wer annimmt, geht hin, beide machen die Bewegung und schauen sich an.
    - Mit Bewohnern: Die Figur entscheidet nach dem, was sie weiß (`npcJointDecision`):
      - Umarmen nur mit der Begleitung oder nach dem Beileid;
      - Anstoßen nur, wenn beide etwas trinken;
      - Tanzen nicht mit Kindern und nicht mit Personal bei der Arbeit;
      - Trösten nur Trauernde.
    - Danach weiß die Figur es im Gespräch.
  - `lib/multiplayer/gestures.ts` mit Tests; im Browser geprüft.

- **05.11.2026 – Eigene Figur gestalten (Second Life, Teil 3):**
  - Tabelle `player_appearance` (Thomas bestätigt).
  - `/api/game/appearance`: nur erlaubte Werte, keine Kinder- oder Roboterfigur.
  - Editor „Deine Figur gestalten …“ im Lokal: Alter, Statur, Haut, Frisur, Haarfarbe, Bart, Ausdruck, Kleidung, Oberteil; Vorschau in vier Richtungen.
  - Die Figur gilt im Lokal, auf Erdkarte und Oberflächen (dort im Druckanzug) und in der Kolonie. Mitspieler sehen sie über die Anwesenheit.
  - Bei einer Schicht kommt die Arbeitskleidung darüber.
  - Im Browser geprüft.

- **05.11.2026 – Flüstern, Sagen, Rufen (Second Life, Teil 4):**
  - Im Raum-Chat wählt man „Sagen“ (hören die in der Nähe, etwa zwei Fünftel des Raums) oder „Rufen“ (der ganze Raum).
  - Flüstern geht über den eigenen Ably-Kanal nur an den einen Spieler; wer zu weit weg steht, geht erst hin.
  - Gespeichert wird alles mit Reichweite und Standort (`player_room_messages.range`, `to_profile_id`, `pos_x`, `pos_y`). Der Verlauf zeigt fremdes Geflüster nicht.
  - Im Browser geprüft.

- **05.11.2026 – Veranstaltungen (Second Life, Teil 5):**
  - Tabelle `venue_events` (Thomas bestätigt) und `/api/game/hospitality/events`.
  - Der Eigentümer kündigt DJ-Abend, Konzert, Lesung, Quiz, Feier oder Stammtisch an (echte Uhrzeit, höchstens zehn Termine, zwei Monate im Voraus) und kann absagen.
  - Im Lokal hängt der Aushang, dazu „Was ist los? · anderswo“.
  - Die Figuren wissen davon: Das Personal kennt das Programm, Gäste wissen, was gerade läuft, und kennen die nächste Ankündigung.
  - Tests; im Browser geprüft. Bewohner kommen zu Veranstaltungen: R-33; Karte: W-18.

- **05.11.2026 – Einrichten und Hausrecht (Second Life, Teil 6):**
  - Tabellen `venue_furnishing` und `venue_bans` (Thomas bestätigt), `/api/game/hospitality/house`.
  - **Einrichten:** Wem das Lokal gehört, der zieht im Raum die Tische mit ihren Stühlen und Plätzen an eine andere Stelle und schmückt mit Pflanze, Stehlampe, Bild, Girlande, Teppich und Kerzen (höchstens zwölf Stück).
    - Das geht auch, wenn geschlossen ist.
    - Tresen, Tanzfläche, Einlass und Ausgang bleiben frei; die Wege passen sich an (`furnishing.ts`, mit Tests).
    - Die Figuren sehen den Schmuck.
  - **Hausrecht:** Der Eigentümer gibt einem Mitspieler Hausverbot für 24 Stunden, eine Woche oder auf Dauer, und kann es wieder aufheben.
    - Wer Hausverbot hat, sieht das Lokal als geschlossen, mit Angabe, bis wann.
    - Bestellen und Raum-Chat sind für ihn auch auf dem Server gesperrt; nach höchstens 30 Sekunden greift es auch drinnen.
  - Im Browser geprüft. Damit sind alle sechs Teile der Second-Life-Mechaniken gebaut.

- **05.11.2026 – In den Arm nehmen, Hand in Hand:**
  - Thomas: „in den Arm nehmen fehlt oder Hand in Hand laufen“.
  - Zwei weitere gemeinsame Bewegungen, bei denen man zusammen weitergeht: Wer angenommen hat, läuft neben dem anderen mit, mit der Hand auf der richtigen Seite. Lässt einer los („Loslassen“ oder weggehen), ist es für beide vorbei.
  - Auch per Chat: „/hand in hand“, „/in den Arm“.
  - Bewohner machen es nur mit ihrer Begleitung, in den Arm nehmen auch Trauernde nach dem Beileid, nie Kinder.
  - Tests; im Browser geprüft.

- **06.11.2026 – Polizei, Feuerwehr, Arztpraxis, Krankenhaus:**
  - Thomas: „ja, mache das“. Begehbare Räume auf dem Innenraum-Motor, mit Dienstpersonal in Uniform, Wissen und Angeboten:
    - Wache: Anzeige, Fundsache, Verlust; sie kennt gemeldete Vorfälle.
    - Feuerwache: Löschfahrzeug, Mitmachen bei der Freiwilligen Feuerwehr.
    - Praxis: Sprechzeiten, Termin, Wartezimmer.
    - Krankenhaus: Information, Besuch, Station.
  - Tabelle `service_cases`, `/api/game/services`.
  - Öffnen von der Karte: `police`, `fire_station`, `doctors`/`dentist`, `hospital`/`clinic`.
  - Einsatz im Lokal: Nach einer Schlägerei kommt die Streife, bei Verletzten der Rettungsdienst.
  - Bei echten Notfällen verweist das Personal auf 110, 112 und 116 117; keine Diagnosen.
  - Tests; im Browser geprüft. Requests R-34, W-20, P-4.

- **06.11.2026 – Innenräume in 2,5D:**
  - Thomas: Auf Handys ist das Spiel derzeit praktisch nicht spielbar, deshalb zuerst Browser mit großem Bildschirm. Zum Entwurf (Artefakt „Raumwerkstatt“): „sieht schon super aus, sollten wir so umsetzen, mit Namen, gerne auch etwas futuristischer“.
  - **Umsetzung:**
    - Der Innenraum-Motor stellt den Raum mit CSS-3D schräg (orthografisch wie die Karte).
    - Zwei Rückwände mit Leuchtkante in der Farbe der Raumart (Nachtclub Magenta, Café Bernstein, Polizei Blau, Praxis und Krankenhaus Türkis …), Fenster in der Nordwand.
    - Möbel mit Höhe und Seiten, dazu Schatten auf dem Boden.
    - Figuren, Namen, Knöpfe und Pflanzen stehen aufrecht zur Kamera; der Browser sortiert die Tiefe selbst.
    - Namen stehen jetzt immer über allen Figuren.
  - **Bedienung:**
    - Neu: Boden anklicken zum Gehen.
    - WASD gehen nach Bildschirmrichtung.
    - Einrichten per Ziehen rechnet über drei Bezugspunkte zurück in Raumkoordinaten.
  - Die Spiellogik bleibt unverändert. In der Kopfzeile lässt sich auf die Draufsicht zurückschalten (wird im Browser gemerkt).
- **06.11.2026 – Größer, modernes Café, Servierroboter, lebendigere Bewegungen:**
  - Thomas: „sieht noch nicht wirklich gut aus, ich denke es sollte grösser sein, moderner, hier könnten wir uns ein Beispiel an modernen koreanischen Cafés nehmen, Bedienungsroboter, Bewegungen sind noch so einfach aktuell“.
  - **Größer:**
    - Die Kamera zoomt näher heran (Standard 1,35) und folgt der eigenen Figur.
    - Zoom per Mausrad oder mit den Knöpfen +, − und „Raum“/„Nah“ (wird im Browser gemerkt).
  - **Modernes Café** (eigener Entwurf, keine Kopie eines echten Lokals):
    - Terrazzo-Boden, Holzlamellen an der unteren Wand, Bogenfenster mit schwarzem Rahmen.
    - Runde Marmortische auf Beinen, pastellfarbene Hocker, weißer Tresen mit Lamellenfront, Glasregal, große Pflanzen.
    - Hängelampen über den Tischen (nicht in Polizei, Wache, Praxis, Krankenhaus und Bank).
    - Leuchtschrift mit dem Namen des Lokals auf der freien Wandfläche; Straßenadressen werden nicht angeschrieben.
  - **Servierroboter** (Café und Restaurant, eigener Entwurf: weißer Körper, zwei Holztabletts, Bildschirmgesicht):
    - Wartet am Tresen, fährt über die Wegfindung zu besetzten Plätzen und wieder zurück.
    - Er ist nur Bild – er spricht nicht und weiß nichts; die Bedienung bleibt die Person am Tresen.
  - **Bewegungen:**
    - Neue Posen: trinken, plaudern (stehend und sitzend).
    - Sitzende Gäste wechseln zwischen Sitzen, Trinken und Plaudern; Stehende plaudern.
    - Leichtes Atmen der Figuren; Bewohner gleiten weich zu ihrem Platz.
- **06.11.2026 – Übrige Räume in 2,5D nachgezogen** (Thomas: „ja mach das“):
  - Tafeln (Kurse, Stellen, Hinweise, Übungsplan, Stationen) hängen an der Wand; die Beschriftung steht auf der Tafel statt am Boden.
  - Trennwände sind Milchglas: Büro, Halle und Behandlungsraum dahinter bleiben sichtbar.
  - Regale je nach Haus: Ordner auf Wache, Bank und Agentur, Zeitschriften im Wartezimmer der Praxis.
  - Löschfahrzeug mit Fahrerhaus, Scheiben, weißem Streifen, Rädern und Blaulicht.
  - Helle Empfangstresen in Praxis, Krankenhaus und Wache.
- **06.11.2026 – Ein Motor für alle Räume:**
  - Thomas: „wir sollten den älteren Raum oder generell unterschiedliche Raum-Motoren vermeiden und nur auf einer Version aufbauen, d. h. alles Alte umziehen“.
  - **Umgezogen** auf `app/interiors/WalkableInterior.tsx`: Bibliothek, Kirche, Moschee, Synagoge, Hindu-Tempel, buddhistischer Tempel, Gemeindesaal, Begegnungsstätte, Laden, Werkstatt, ArtLounge (drei Geschosse), Gastraum und Friedhof.
    - Damit gibt es dort jetzt auch 2,5D, Kiesel-Figuren, Mitspieler, Gesten, Raum-Chat, Zoom und Kamera.
    - `app/earth/LandmarkWalkableInterior.tsx` ist nur noch die Einrichtung; Aufrufer und Props sind unverändert.
  - **Erhalten:**
    - Bibliothek: Stöbern an jedem Regal, Mitnehmen, Buchtipp. Die Bibliothekarin bringt Bücher an den Platz, liest mit, liest vor und sortiert ein; dazu der Lesegast.
    - Gotteshäuser und Treffpunkte: Fürbitte, Bittgebet und Anliegen, Gottesdienstablauf nach echter Uhr, Predigt hören, offene Runde mit Sprechblasen, Kerzen.
    - Friedhof: Gedenkort mit eigenen Kerzen, ruhige Gesprächsregeln mit Telefonseelsorge.
    - Außerdem Stockwerke, Leistungen und Tresen-Einschub, „Gehe zu …“, Sprachausgabe und Musik.
  - **Neue allgemeine Anschlüsse im Motor:**
    - `figureAt` (feste oder gehende Figuren), `greeting` (feste Begrüßung), `onReply` (Versprochenes ausführen).
    - `talkPanel`, `floorLayer`, `furnitureDressing`, `overlay`, `outdoor`, `roomName`, `roomClass`, `headerTools`, `nearbyPlaces`, `ctx.sit()`.
    - Der Ausgang richtet sich nach `layout.exit`.
  - Die Grundrisse werden umgerechnet (`lib/game/landmarks/venueLayout.ts`, mit Test: Start frei, alle Sitz- und Bereichspunkte erreichbar).
  - **Nicht umgezogen:** Das Immersionsstudio (Dvārakā-Szenen) ist eine Erlebnisszene, kein begehbarer Raum; es bleibt, wie es ist.
- **06.11.2026 – Mitspieler am richtigen Ort** (Thomas' Test mit Rawdium: „getroffen im Arbeitsamt, sehe ihn dort aber noch – inzwischen ist er am Raumhafen, dort kann ich ihn nicht sehen“):
  - **Raumhafen:** Er besteht aus sechs Gebäuden (Kern, Service, Lager, drei Landeplätze); je nach angeklicktem Gebäude landete man in einem anderen Raum. Jetzt gibt es einen gemeinsamen Raum `spaceport:earth` für Mitspieler und Raum-Chat (neue Prop `presenceRoom` im Motor).
  - **Wer weg ist, verschwindet:**
    - Die Liste wird alle 10 s neu geprüft, nicht nur bei neuen Meldungen.
    - Wer zwei Meldungen (je 30 s) verpasst, gilt nach 75 s als weg.
    - Beim Schließen des Tabs meldet man sich ab; beim Verlassen erst abmelden, dann den Kanal schließen.
  - **Nur der vorderste Raum ist aktiv:** Öffnet sich ein Raum über einem anderen, meldet man sich im unteren ab und beim Schließen des oberen wieder an.
  - **Ortsräume:** Die Raumkennung enthält nur noch zulässige Zeichen, sonst hätte der Raum-Chat Orte mit Leerzeichen oder Umlauten im Namen abgelehnt.
- **06.11.2026 – Chat, Tasten, Testhinweis** (Rückmeldung von Rawdium über Thomas):
  - **Chat im Vordergrund:**
    - Wer mit einer Figur oder einem Mitspieler spricht oder in den Raum-Chat klickt, sieht das Gespräch groß. Der Verlauf hat volle Höhe, die Schrift ist größer, das Eingabefeld mehrzeilig (Enter sendet, Umschalt+Enter macht eine neue Zeile).
    - Gesten, Angebot, Hinsetzen und Lernen liegen dann unter „Weitere Möglichkeiten …“. „Chat verkleinern“ führt zurück.
  - **Seitenleiste breiter ziehen:** Am linken Rand ziehen (280–760 px); Doppelklick wechselt zwischen groß und klein. Die Breite wird im Browser gemerkt.
  - **Pfeiltasten** gehen in Gebäuden wie WASD; die Tasten werden abgefangen, damit die Figur draußen auf der Karte nicht mitläuft.
  - **Gesten auf Tasten 1–6:** Winken, Jubeln, Klatschen, Verbeugen, Prost, Tanzen; die Ziffer steht auf dem Knopf.
  - **Testbetrieb:** Statt dauerhaft unten rechts erscheint der Hinweis einmal je Anmeldung (Browsersitzung) mit „Verstanden“ und „Mehr dazu“; er verschwindet nach 20 s von selbst. Der Hinweis im Gespräch („Automatisch ausgewertet · Mehr dazu“) bleibt.
- **06.11.2026 – Gebäude öffnen schneller** (Thomas: „können wir das Laden von Gebäuden noch beschleunigen?“):
  - Bisher wartete jedes Betreten auf `/api/game/building-access` (Ortsdaten: Markt, Aufträge, Orte, Tick) und zeigte so lange „Gebäude wird betreten …“.
  - **Jetzt:**
    - Café, Agentur, Rathaus, Bank, Akademie, Warenhaus und Raumhafen-Halle öffnen sofort; die Ortsdaten kommen im Hintergrund.
    - Gewartet wird nur noch, wo sie gebraucht werden (Schalter, Markt, Navigation).
    - Die Ortsdaten werden beim Start vorgeladen und 90 s behalten; gleichzeitige Anfragen teilen sich eine.
    - Im Test steht der Raum nach 0,2 s, auch wenn die Ortsdaten 4 s brauchen.
  - Räume ohne Gebäudekennung (Wache, Bibliothek, Kirche …) fragen keine eingetragenen Bewohner mehr ab.
  - Anfrage R-36 an Bevölkerung: `/api/game/population` arbeitet drei Stufen nacheinander ab, zwei davon könnten parallel laufen.
- **06.11.2026 – Figur im Onboarding** (Thomas: „wir sollten beim Onboarding auch den Figureneditor laden, bei unserem neuen Spieler wurde ein weiblicher Avatar zugeordnet, obwohl er ein männliches Profilbild ausgewählt hat“):
  - **Startfigur zum Dienstfoto:** Jedes der zwölf Fotos (`pilot_01`–`pilot_12`) hat eine passende Startfigur (`AVATAR_LOOKS` in `lib/figures/playerLook.ts`): Haar, Haarfarbe, Bart, Hautton, ungefähres Alter – nur was man auf dem Foto sieht.
  - **Vorgabe nach Foto:** `/api/game/appearance` nimmt ohne eigene Einstellung die Figur zum Foto statt einer zufälligen aus der Kennung. Wer schon spielt und nichts eingestellt hat (Rawdium: `pilot_01`), sieht nach dem Neuladen von selbst richtig aus.
  - **Onboarding:**
    - Nach „Registrierung abschließen“ öffnet sich der Figureneditor, vorbelegt nach dem Foto; danach geht es weiter zum Quiz.
    - „So übernehmen“ speichert die Figur zum Foto.
  - Tests: alle zwölf Fotos zugeordnet, Männer auf dem Foto ohne Frauenfrisur und Kleid, Frauen ohne Bart.
- **06.11.2026 – Kleider und Figureneditor überall** (Thomas: „Frauen könnten als Standard auch Kleider bekommen. Wir hatten auch schon einen Figureneditor, ich denke, den sollten wir auch integrieren, aktuell gibt es ihn glaube ich nur als Artefakt“):
  - **Kleider:**
    - Die sechs Dienstfotos mit Frauen geben als Vorgabe ein Kleid, jedes in eigener Farbe.
    - Bewohnerinnen tragen es zur Hälfte (vorher ein Viertel).
    - Die Farbe des Kleids ist im Editor wählbar wie das Oberteil im Alltag.
  - **Figureneditor überall:**
    - Bisher nur über „Deine Figur gestalten …“ in der Seitenleiste eines Innenraums.
    - Jetzt auch im Profil (Klick aufs Profilbild oben rechts: eigene Figur und „Figur gestalten …“) und im Onboarding, jeweils über den ganzen Bildschirm (`fixed`).
  - **Aus der Figurenwerkstatt übernommen:**
    - „Alle Bewegungen …“: alle Posen nach Stufen (Grundbewegungen, Gesten, Zu zweit, Tanz, Arbeit, Rangelei, Kampf), mit Blickrichtung und Hinweis, wann sie im Spiel vorkommen.
    - Ein Klick zeigt die Pose groß an der eigenen Figur; dazu der Knopf „Zufällig“.
    - Stilvergleich und Leistungsprobe der Werkstatt waren für die Entscheidung gedacht und bleiben im Artefakt.
- **06.11.2026 – Abmelden im Profil** (Thomas: „Abmelden sollte auch beim Figurenprofil sein, nicht unten bei Aktionen“): „↪ Abmelden“ steht im Kopf des Profilfensters neben „Figur gestalten …“; unter „Aktionen“ in der unteren Leiste ist es entfernt. Der Eintrag im Reiter „Einstellungen“ bleibt.
- **07.11.2026 – Besonderer Ort: Balver Höhle** (Thomas: „Können wir einen Special Place einbauen? Die Balver Höhle im Sauerland?“):
  - **Auf der Karte:** neuer kanonischer Ort `earth-de-balve-balver-hoehle` (Helle 2, 58802 Balve), Punkt am Höhleneingang, begehbar wie die ArtLounge. Anfrage W-22 an die Weltkarte (eigenes Kartenzeichen; ein veralteter Landmark-Test).
  - **Raumart `cave`:**
    - Tunnelhalle mit Felswänden, nach hinten schmaler; links der Dechenarm, rechts der Virchowarm.
    - Dreistufige Terrasse quer durch die Halle, Bühne hinten, Festbänke in zwei Blöcken mit Mittelgang, Ausschank, Infotafel.
    - Abgesteckte Fundstelle vorn links.
  - **Höhlenführerin:** spricht nur aus belegten Fakten (`staffFacts` im Grundriss):
    - Maße und Gestein, die beiden Nebenarme.
    - Neandertaler (vor etwa 100.000 bis 40.000 Jahren), Funde und Museen.
    - Festspiele seit 1985, Märchenwochen, Schützenfest, über 2.000 Plätze, Zweiter Weltkrieg.
    - Sie erfindet keine Termine oder Preise.
  - Quellen: Wikipedia „Balver Höhle“, sauerland.com („Europas größte Kulturhöhle“).
  - **Nebenbei behoben (betraf alle Orte seit dem Umzug auf einen Motor):** Bodenflächen hatten keine Größe (Stilangaben `x/y/w/h` statt `left/top/width/height`). Teppiche, Fliesen, Altarraum, Wege und Bühnenflächen fehlten in Bibliothek, Gotteshäusern, ArtLounge, Friedhof usw.; sie sind wieder da.
  - Gilt für alle Räume des Motors: Lokale, Bank, Agentur, Reisebüro, Wache, Feuerwache, Praxis, Krankenhaus.
  - Im Browser geprüft (Metropol, Café, Wache; Laufen per Klick, Tasten, Einrichten).
  - **Später** (Thomas): eine 80er-/90er-Fassung für die Zeitreise in VR.

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
- **R-34** (06.11.2026): Polizei, Feuerwehr, Gesundheit – Einsätze und Folgen – `population-economy.md`.
- **W-20** (06.11.2026): Polizei, Feuerwache, Praxis, Krankenhaus begehbar – `world-map.md`.
- **P-4** (06.11.2026): Seelsorge im Krankenhaus und bei Einsätzen – NPC-Religion.
- **W-19** (05.11.2026): Grabsteine auf der Weltkarte – `world-map.md`; Nachtrag zu R-23 (Gräber mit Namen vorziehen).
- **R-33** (05.11.2026): Bewohner gehen zu Veranstaltungen – `population-economy.md`.
- **W-18** (05.11.2026): „Was ist los?“ auf der Karte – `world-map.md`.
- **R-32** (04.11.2026): Streit, Rangelei und Kampf – mit Folgen – `population-economy.md`.
- **P-3** (04.11.2026): Haltung zu Streit und Gewalt – NPC-Religion.
- **W-17** (04.11.2026): Kiesel-Figuren auf der Karte – `world-map.md`.
- **R-31** (04.11.2026): Aussehen für alle – Altersgruppen und Kleidung – `population-economy.md`.
- **R-30** (04.11.2026): Spieler unter sich – Raum-Chat und Kommen/Gehen in die tägliche Auswertung – `population-economy.md`.
- **W-16** (04.11.2026): Andere Spieler auf der Karte, im Auto und an Bord – `world-map.md`.
- **R-29** (04.11.2026): Credits untereinander – Bewohner zahlen Spielern; Trinkgeld entfällt – `population-economy.md`.
- **W-15** (03.11.2026): Echte Lokale öffnen das volle Lokal – Änderungen in `WorldPanels.tsx` und `/api/world-lab/buildings` prüfen – `world-map.md`.
- **R-28** (03.11.2026): Echte Lokale – Personal, Käufe, Stellen – `population-economy.md`.
- **P-2** (03.11.2026): Gastraum nicht doppelt weiterbauen – `NOXIA-NPC-RELIGION-0001`.
- **R-25** (03.11.2026): Paare und Beziehungen wachsen dynamisch, auch Spieler–Figur mit festen Regeln – `population-economy.md`.
- **R-26** (03.11.2026): Roboter als Teil der Bevölkerung – `population-economy.md`.
- **R-24** (03.11.2026): Kinder, Lebensläufe, Kinderschutz, gemeinsame Unternehmungen – `population-economy.md`.
- **W-14** (03.11.2026): Kindergarten, Schule, Spielplatz betretbar – `world-map.md`.
- **W-13** (02.11.2026): Friedhöfe begehbar, Gedenkort – `world-map.md`.
- **R-23** (02.11.2026): Bewohner sterben, Gräber, Trauer, Nachlass, Termine – `population-economy.md`.
- **P-1** (02.11.2026): Trauerfeier je Tradition – `docs/architecture/NOXIA-NPC-RELIGION-0001-spiritual-roles-and-places.md`.
- **W-12** (29.10.2026): nach „Gleich hingehen“ die Spielerfigur beim Lokal absetzen – `world-map.md`.
- **R-22** (29.10.2026): Wünsche aus der Arbeitsvermittlung in der täglichen Gesprächsauswertung; echte Lebensfragen sorgsam – `population-economy.md`.
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

### G-8 (Chat 29.10.2026): Grok übernimmt, wenn Spieler ausfallend werden

Anlass: Thomas hat den Eindruck, dass Grok direkter antwortet und zu den Gesprächen passt, die Vassili geführt hat. Wenn Spieler ausfallend reagieren, soll Grok die Figur sprechen. Aufbauend auf G-7 (Router) und `EXT-ECO-NOXIA-20261028-001` (Prüfsuite).

1. **Auslöser, deterministisch zuerst:** Wortliste und einfache Muster für Beleidigungen und Anpöbeln (Deutsch), geprüft auf der Spielereingabe vor dem Modellaufruf. Kein Modell entscheidet über den Wechsel. Zählt mehrere Eingaben in Folge als „ausfallend“, bleibt die Figur in diesem Gespräch bei Grok (Zustand je Gespräch, nicht je Spieler).
2. **Anbieter:** xAI (`https://api.x.ai/v1`, OpenAI-kompatibel) als zusätzlicher Eintrag im Router, nur über `NPC_LLM_ESCALATION=xai` erreichbar, nicht in `NPC_LLM_CHAIN`. Schlüssel-Name überall `XAI_API_KEY` (Vercel-Umgebungsvariable und GitHub-Secret für die Prüfsuite; GitHub erlaubt keine Bindestriche). Modell zunächst `grok-4.3` (1,25 $/2,50 $ je Mio. Token); als Vergleich `x-ai/grok-4-fast:free` über OpenRouter. Fällt xAI aus oder ist kein Schlüssel gesetzt, antwortet die normale Kette.
3. **Sprachregeln unverändert:** Dasselbe Prompt und dieselben Grounding-Regeln. Direkter heißt: knapp, klare Grenze, kein Einknicken – nicht: selbst beleidigen, drohen oder Fakten erfinden. Der Server prüft Aktionen (`[[ACTION:…]]`) wie bisher allein; ein Streit ändert Preise, Öffnung oder Zugang nur über Spielregeln, nicht über das Gespräch.
4. **Budget:** Aufrufe an xAI zählen im Budget-Deckel aus G-7 mit eigenem Wert (`NPC_LLM_ESCALATION_MAX_PER_DAY`). Danach kurze Standardantwort ohne Modell.
5. **Datenschutz:** An xAI geht nur Spielkontext (Figur, Ort, die letzten Äußerungen), keine Konto- oder Spielerdaten. Vor dem Einschalten Auftragsverarbeitung und Datenfreigabe-Optionen im xAI-Konto prüfen.
6. **Messung:** 10–15 Eskalationsfälle in die Prüfsuite aufnehmen und gegen Grok, DeepSeek und Groq laufen lassen: Regeltreue, Länge, Ton (kein Hochschaukeln, keine erfundenen Fakten). Danach entscheidet die Tabelle, ob Grok bleibt.
7. `logConversationTurn` vermerkt `escalation: true` und den Auslöser.

**Zu klären (Thomas):** xAI-Konto und Schlüssel anlegen; Inhaltsrahmen für Beleidigungen festlegen (z. B. bis wohin die Figur zurückgibt, ab wann sie das Gespräch beendet).

### G-9 (Schauplatz-Chat „Der Duft der bleibt“, 06.11.2026): Innenraum für ein Wohnhaus – WG Krokusweg 10 – erledigt 06.11.2026 im Schauplatz-Chat (Raumart `rowhouse`/`rowhouse_wg`, `lib/game/landmarks/rowhouse.ts`)

Ortskonzept mit Belegung: `docs/world/earth/friedrichsdorf-krokusweg-10-duft.md`. Gebraucht wird eine neue Raumart für ein privates, mehrgeschossiges Wohnhaus (Vorschlag `shared_house`), nach NOXIA-INTERIOR-0001 als Daten auf dem gemeinsamen Motor, mit Treppen wie bei der ArtLounge (`toLevel`).

1. **Geschosse:** Keller (Kellerraum), EG (große Küche, Wohn- und Esszimmer, Gartenterrasse, Garten), 1. OG (drei Zimmer, innenliegendes Bad), DG (drei Zimmer, innenliegendes Bad, Dachterrasse). Terrasse im 1. OG am Zimmer der Chinesin auf der Gartenseite, Priyas Zimmer daneben ohne Terrasse, Zimmer des Deutschen zur Spielplatzseite.
2. **Bäder ohne Fenster** mit Dusche und Wanne; eigene Möbelarten nötig (Dusche, Wanne, Waschbecken, Bett, Schrank, Herd, Kühlschrank, Esstisch) – heute gibt es sie nicht.
3. **Privat:** Zimmer der Bewohner nur mit Einladung oder in Begleitung; Küche, Wohnzimmer und Garten auf Einladung ins Haus.
4. **Ortsfakten für die Figuren** (Abschnitt „Was der Ort im Spiel tragen soll“ im Ortskonzept): Gerüche, Geräusche, Sichtbereiche. Keine Plotdetails des Romans.
5. Kein Personal, keine Karte, kein Bedienplatz – ein Wohnhaus ist kein Lokal.


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
