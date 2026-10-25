# Café, Bar und Restaurant – Innenaufbau, Figuren, Gespräche

Status: gebaut (Innenaufbau, Platzierung, Gesprächswissen, Bestellen am Tresen). Die Buchung selbst gehört zum Teilprojekt Bevölkerung und Ökonomie. Wirt als Bewohner und Stimmungswirkung sind **nicht** gebaut – nur die Anschlussstellen sind unten beschrieben.

Bezug: `docs/gameplay/settlement-tiers.md` (Rolle des Cafés), `NOXIA-LIVING-0010` (Stellen), `NOXIA-FIN-0001` (Buchungssemantik), `NOXIA-LIVING-0006` (Affekt).

## 1. Was es jetzt gibt

| Baustein | Ort |
|---|---|
| Raummodell für alle drei Lokaltypen (reine Regeln) | `lib/game/hospitality/venues.ts` |
| Prüfungen dazu | `lib/game/hospitality/venues.test.ts`, `npm run test:hospitality` |
| Innenraum-Vorlagen | `lib/game/buildings/interiors/templates/{cafe,bar,restaurant}Standard.ts` |
| Begehbarer Raum | `app/earth/CafeWalkableInterior.tsx` (ein Bauteil für alle drei, gewählt über `buildingTypeId`) |
| Eintritt | `lib/game/buildings/entry.ts`: `cafe`, `bar`, `restaurant` → `hospitality` |

Im Spiel erreichbar ist heute nur das Café. `bar` steht im Gebäudekatalog weiter auf `planned`, `restaurant` hat dort noch keinen Eintrag. Beides bleibt so, bis die Lokale eine echte Funktion haben (Regel „keine leeren Hüllen“). Sobald ein Gebäude mit `entity_id` `bar` oder `restaurant` existiert, öffnet es ohne weitere Arbeit den passenden Raum.

### Lokale auf der Erde: kaufen und umbauen statt neu bauen

Entscheidung (Thomas, 25.10.2026): Auf der Erde wird ein Lokal nicht auf freier Fläche gebaut. Man **kauft ein bestehendes Gebäude** des realen Ortes und baut es zum Café, zur Bar, zum Restaurant oder Hotel um – sofern es nicht schon eines ist. Das selbst gebaute Startcafé an der Hauptstraße ist ein Übergangszustand und soll verschwinden, sobald der Kaufweg steht.

Folgen für die Gastronomie (bleibt hier):
- Die Lokalart leitet sich künftig aus dem gekauften Gebäude ab, nicht aus einer eigenen Kachel: ein Gebäude trägt eine Nutzung (`cafe`, `bar`, `restaurant`, `hotel`), der Innenraum öffnet wie bisher über `venueKindForBuildingType`.
- Reale Lokale aus den Kartendaten sind von Anfang an Lokale: In Sundern das „Metropol“ (Bar, Hauptstraße 76) und der „Balkan Grill“ (Restaurant, Hauptstraße 68). Sie sind nicht umbaubar, aber betretbar, sobald sie ein NOXIA-Gebäude mit Nutzung sind – mit Bar- bzw. Restaurantraum, Karte nach R-2 und Personal nach LIVING-0010.
- Beim Umbau Grundriss nach Gebäudegröße: kleines Haus → Café-Raum, großes → Restaurant oder Hotel mit `transient_capacity` aus der Geschossfläche (Vorschlag, noch nicht gebaut).

Kaufen, Eigentum, Umbaukosten und die Verbindung Kartengebäude ↔ `tile_entities` liegen bei Bevölkerung und Ökonomie (R-13) und Weltkarte (W-4).

## 1a. Hafenkantine

Seit 13.10.2026 steht in jedem Hafengebäude eine staatliche Hafenkantine (`port_canteen`, NOXIA-LIVING-0013). Für Spieler ist sie jetzt betretbar (Request G-1):

- **Zugang:** vom Hafengebäude aus – „Kantine betreten“ im Raumhafen-Overlay (Erde, Mond, Phobos, Deimos), Bereich „Hafenkantine“ im Facility-Innenraum des Landeplatzes (Mars) und Raum „Hafenkantine“ im Kolonie-Innenraum von Andockmodul (Prometheus) und Hafenviertel (Q1). Ob eine Kantine im Hafen steht, sagt `GET /api/game/hospitality/canteen?parentEntityId=…`; ohne Kantine gibt es keinen Eintritt.
- **Innenraum** (`app/dashboard/PortCanteenInterior.tsx`): Ausgabe, kein Sitzplatz, rund um die Uhr.
- **Automat** (kleine Landeplätze: Mond, Phobos): stumm. Eine Anzeige mit Karte, Preisen und Notration, sonst nichts.
- **Kantinenschwarm** (Raumhafen, Andockmodul, Hafenviertel): zwei Roboterkörper eines Schwarms, erkennbar Maschine. Sie sprechen im Plural und beantworten acht feste Fragen (`lib/game/hospitality/canteen.ts`) – keine Gesprächs-KI. Ihr Gedächtnis ist je Ort und besteht nur aus dem, was sie selbst gesehen haben: Bestellungen dieses Spielers in Kantinen des Ortes (`player_hospitality_orders`), Gäste und Notrationen der letzten 24 Stunden (`person_consumption_events`). „Kennt ihr mich?“ – „Wir haben Sie hier schon zweimal bedient, zuletzt vor einer Stunde: Ration.“ Nach Arbeit verweisen sie an die Verwaltung; keine Deutungen, kein Klatsch.
- **Karte:** Wasser 2 Cr, Ration 6 Cr aus `hospitality_menu`, mit eigenen Bildern; Bestellung über `POST /api/game/hospitality/order` wie im Lokal.
- **Notration** für Spieler ohne Geld ist noch nicht freigeschaltet (LIVING-0012 Schritt 3); das Gerät sagt das so.

## 1b. Hotel

Nach dem Vorbild SunDog: Am Empfang mietet man ein Zimmer. Gebaut (Entscheidung Thomas, 13.10.2026: „im Hotel sollte man ein Zimmer buchen können“):

- **Innenraum** `hotel`: Lobby mit Empfang (Bestellplatz), zwei Tische, Treppe „ZIMMER ↑“, Büro hinter dem Empfang; Vorlage `hotelStandard.ts`, Layout in `venues.ts`. Der Empfang ist rund um die Uhr besetzt, ohne Personal ist das Hotel geschlossen. Gebäudeansicht `public/assets/buildings/hotel/earth/style-anchor.svg`.
- **Zimmer buchen:** Ein Zimmer ist ein Posten der Karte (`item_code` `room_night`, „Zimmer für eine Nacht“) und wird am Empfang wie eine Bestellung gebucht – versteuerte Überweisung über `order_hospitality_item`, Kennung je Versuch. Die Karte zeigt ihn getrennt von Speisen, mit Schlüssel als Bild.
- **Belegung:** Zimmerzahl ist `transient_capacity` des Gebäudes; belegt sind die Buchungen der letzten 24 Stunden (`player_hospitality_orders`, eine Nacht = 24 Stunden Echtzeit – ein Platzhalter, bis Koloniezeit und Spielzeit verknüpft sind). `GET /api/game/hospitality/guests` liefert `rooms {capacity, occupied, mineForS}`. Wer schon ein Zimmer hat oder wenn keins frei ist, kann nicht buchen – das prüft nur die Oberfläche (Request R-7: serverseitig).
- **Wissen:** Das Personal kennt Zimmerzahl und freie Zimmer und weiß, ob der Gast eines hat; ein Gast sieht nur die Treppe und den Schlüssel des Gegenübers. Zimmer über einem Café oder Restaurant funktionieren genauso, sobald das Gebäude Gästeplätze hat.
- **Baubar** (Entscheidung Thomas, 14.10.2026: einbauen): Migration `20261014090000_hotel_rooms.sql` – Gebäudeart `hotel` (Stufe 2, 3 600 Credits, 3 Ticks), neue Hotels bekommen 6 Gästeplätze, Kartenzeile `room_night` 40 Credits, und ein Trigger auf `player_hospitality_orders` weist Buchungen ab, wenn kein Zimmer frei ist oder der Gast schon eines hat (`NOXIA_ROOM_NONE_FREE`, `NOXIA_ROOM_ALREADY_BOOKED`, `NOXIA_ROOM_NONE_HERE`). Geprüft in einer zurückgerollten Transaktion gegen die Live-Daten.
- **Noch nichts bewirkt** das Zimmer: Erholung als Bedürfnis gibt es nicht (R-7).

## 2. Innenaufbau

Alle drei Räume sind 760 × 470 groß, der Eingang liegt unten links.

| Lokal | Aufbau | Plätze für Gäste | Plätze für Personal |
|---|---|---|---|
| Café | Tresen oben rechts, vier Tische mit je zwei Stühlen | 8 | 1 (hinter dem Tresen) |
| Bar | langer Tresen an der rechten Wand mit fünf Hockern, drei Stehtische, eine Sitznische | 13 | 2 (hinter dem Tresen) |
| Restaurant | Empfang beim Eingang, acht Tische, rechts die Küche hinter Wand und Durchreiche | 16 | 3 (Empfang, Durchreiche, Küche) |

Jeder Platz gehört zu einem Raum der Innenraum-Vorlage. Daraus ergibt sich die **Sichtweite**: Räume, die über normalerweise offene Durchgänge verbunden sind, bilden einen Sichtbereich. Eine geschlossene Tür trennt. Der Gast sieht deshalb weder Nebenraum noch Küche; wer in der Küche steht, sieht den Speiseraum nicht. Die Durchreiche ist kein Durchgang.

Die Prüfungen stellen sicher: Möbel überlappen nicht, jeder Sitzplatz liegt auf einem Stuhl oder Hocker, Tresen/Empfang und Ausgang sind zu Fuß erreichbar, und die Zahlen im Raumtext stimmen mit dem Aufbau überein.

## 3. Figuren

`placeVenueFigures` setzt Personen an Plätze:

- **Personal** (aktive Arbeitszuweisung in genau diesem Gebäude) steht an den Personalplätzen. Sind alle belegt, ist die Person hinten beschäftigt und nicht zu sehen.
- **Begleitung** des Spielers bleibt beim Eingang.
- **Gäste** sitzen oder stehen an freien Plätzen. Dieselbe Person findet beim nächsten Betreten wieder denselben Platz, solange er frei ist.
- Liegt ein Eintrag in `person_interior_presence` vor, gilt dessen Raum. Ist er vom Gastraum aus nicht einsehbar, wird die Figur nicht gezeigt.
- Ist der Raum voll, werden weitere Personen nicht dargestellt.

### Gäste, die kommen und gehen

Ein Bewohner, der im Lokal wirklich gekauft hat (`person_consumption_events`), ist für eine gute halbe Stunde Gast. Was man sieht, folgt allein aus der Zeit seit dem Kauf:

| Zeit seit dem Kauf | Im Raum |
|---|---|
| bis 1,5 Minuten | steht am Tresen (mehrere stehen hintereinander an) |
| danach 18 Sekunden | geht um die Möbel herum zu seinem Platz |
| danach 35 Minuten | sitzt, die Bestellung steht vor ihm |
| danach 22 Sekunden | geht zum Ausgang |
| später | nicht mehr da |

Der Gast weiß im Gespräch, was er selbst bestellt hat; andere sehen ihn dort, wo er gerade ist. Nichts davon wird gespeichert – der Raum zeigt nur, was aus echten Käufen folgt. Ohne Kauf erscheint niemand.

### Hinsetzen, zum Tresen gehen, Gesellschaft

- **Laufen per Klick:** „Zum Tresen gehen“ und „An einen Tisch setzen“ führen die Spielfigur um die Möbel herum (`venuePath`); ein Klick auf einen freien Platz setzt sie genau dorthin. WASD bricht den Weg ab und lässt sie aufstehen.
- **Am Tresen spricht das Personal zuerst:** Tritt der Spieler an den Tresen, begrüßt ihn die nächste Person vom Personal von sich aus – einmal je Besuch (Feld `opening` der Gesprächsroute, höchstens zwei Sätze, im Ton des Hauses). Am Automaten begrüßt niemand.
- **Jemand setzt sich dazu:** Sitzt der Spieler, kommt ein Gast an seinen Tisch, wenn er erst danach vom Tresen losgeht, dort ein Platz frei ist und er Gesellschaft mag (`seatForGuest`, `likesCompany` – etwa jeder zweite, fest je Person). Der Gast weiß im Gespräch, dass er sich dazugesetzt hat. Das Gespräch beginnt der Spieler.
- **Nur echte Gäste.** Dazusetzen kann sich nur, wer wirklich gekauft hat. Solange Bewohner selten kaufen (Request R-3), geschieht das selten.
- **Bedienung am Tisch:** Wer in einem Lokal mit Personal sitzt, bekommt nach kurzer Zeit Besuch: Die nächste Person vom Personal geht um die Möbel herum an den Tisch, bleibt dort eine Weile (`TABLE_SERVICE`: nach 12 s, 6 s Weg, 50 s am Tisch) und nimmt die Bestellung auf – die Karte ist dann am Tisch offen, Bestelltes steht auf dem Tisch. Danach geht sie zurück hinter den Tresen. Im Gespräch weiß sie, dass sie zum Bedienen gekommen ist. Nicht am Automaten und nicht in der Hotellobby.
- Sitzen hat noch keine Wirkung auf den Spieler (Erholung: Requests R-7, R-9).

### Lokal ohne Personal

Entscheidung (Thomas, 10.10.2026): Ein Lokal ohne Personal ist geschlossen – oder ein Automatencafé. Den Platzhalter-Wirt gibt es nicht mehr. `venueService` leitet daraus ab:

| Betrieb | Wann | Folge |
|---|---|---|
| `staffed` | mindestens eine Person arbeitet hier | Personal steht am Platz, kennt die Karte |
| `self-service` | Café ohne Personal | Automat am Tresen verkauft, niemand berät; Gäste können da sein |
| `closed` | Bar oder Restaurant ohne Personal | kein Ausschank, keine Figuren; der Spieler kann nur wieder gehen |

Dass gerade das Café zum Automatencafé wird und Bar und Restaurant schließen, ist eine Lesart dieser Entscheidung, keine eigene Datenspalte. Soll ein Gebäude das selbst festlegen können, braucht es ein Merkmal am Gebäude.

„Personal“ heißt hier: Arbeitszuweisung zu diesem Gebäude. Ob die Person gerade Schicht hat, weiß der Raum nicht (siehe 6.1).

### Öffnungszeiten

Die Kolonie hat eine Uhr: ein Tick ist eine Stunde, die Stunde ist `Tick % 24`. Das ist Koloniezeit, nicht die Uhrzeit des Spielers.

| Lokal | geöffnet |
|---|---|
| Café | 6–20 Uhr |
| Restaurant | 11–23 Uhr |
| Bar | 17–2 Uhr |
| Hotel | rund um die Uhr |

Die Zeiten stehen als feste Werte in `VENUE_HOURS` (`venues.ts`) – ein Startwert, keine Gebäudeeigenschaft (Request R-4).

**Startcafé:** Der Ankunftsort neuer Spieler geht nach der echten Ortszeit des Spielers (Entscheidung Thomas, 13.10.2026): geschlossen von 23 bis 6 Uhr, Browseruhr, `ARRIVAL_PLAYER_HOURS`. Die Tafel verweist nachts auf die Hafenkantine. Bewohner leben weiter nach Koloniezeit – dasselbe Café kann für den Spieler zu und für sie offen sein. Nur die Oberfläche prüft das; serverseitig (`profiles.time_zone`, `order_hospitality_item`) liegt es bei R-4. Außerhalb der Zeit ist ein Lokal mit Personal geschlossen; die Tafel nennt die nächste Öffnung. Ein Automatencafé schließt nie. `venueClosedReason` unterscheidet „außerhalb der Zeit“ und „kein Personal“. Uhrzeit und Öffnungszeit stehen im ersten Gesprächsfakt, das Personal kann also sagen, wann geöffnet ist.

Bewohner und Personal richten sich noch nicht nach diesen Zeiten – Käufe und Arbeit laufen in der Simulation rund um die Uhr (Requests R-4, R-5).

### Obergeschoss: Wohnung oder Gästezimmer

Hat das Gebäude Wohnplätze (`residential_capacity`) oder Gästeplätze (`transient_capacity`), bekommt der Raum eine Treppe (`withUpperFloor`): „PRIVAT ↑“ für eine Wohnung, „ZIMMER ↑“ für Gästezimmer. Das Personal weiß davon (`upperFloorFact`), Gäste sehen nur die Treppe. Die Treppe ist nicht begehbar, oben gibt es noch keinen Raum. Heute hat kein Gastronomiegebäude solche Plätze; wer oben wohnt und wie man ein Zimmer mietet, liegt bei Bevölkerung und Ökonomie (Requests R-6, R-7).

## 4. Gespräche

Regel: **Eine Figur weiß nur, was sie im Raum wissen kann.** `venueConversationFacts` baut die lokalen Fakten für `/api/game/npc-conversation` aus Sicht der Figur:

| Fakt | Gast | Personal |
|---|---|---|
| Name und Art des Lokals | ja | ja |
| Aufbau des Gastraums | ja, wenn einsehbar | ja, wenn einsehbar |
| Eigener Platz („sitzt an Tisch 2“, „steht hinter dem Tresen“) | ja | ja |
| Wo der Spieler gerade steht | ja, wenn einsehbar | ja, wenn einsehbar |
| Andere Personen in Sichtweite – Anzahl und Platz, **keine Namen** | ja | ja |
| Personalbereich | nur, dass es ihn gibt | was dort liegt |
| Karte und Preise | nein – nur, wo bestellt wird | ja |
| Was der Spieler bei diesem Besuch bestellt hat | ja, wenn einsehbar | ja, wenn einsehbar |
| Weg in die Welt (Akademie, Handel, Linienflug, Verwaltung) | nein | nur in Ankunftslokalen (Café, Bar) |

Nie enthalten: Kontostand, Wissensstufe, Beruf oder Vorhaben des Spielers. Das steht als ausdrücklicher Fakt dabei – die Figur erfährt es nur, wenn der Spieler es erzählt. Der Koch im Restaurant bekommt weder Raumaufbau noch Gäste, weil er sie nicht sieht.

Die Liste bleibt innerhalb der Grenzen der Gesprächsroute (höchstens 16 Fakten mit je 140 Zeichen). Das ist geprüft, weil die Route sonst still abschneidet.

Der Weg in die Welt hängt an der Rolle im Raum (Personal eines Ankunftslokals). In einem Automatencafé erklärt ihn niemand. Das Startcafé braucht deshalb Personal – die Migration `20261010090000_earth_cafe_host.sql` legt dafür eine Person mit Arbeitszuweisung an.

Niemand kassiert im Gespräch. Das Personal kennt die Karte und sagt, wo bestellt wird; gebucht wird nur über den Knopf am Tresen, Empfang oder Automaten. Gibt es für ein Lokal keine Karte, sagen die Fakten ausdrücklich, dass nichts ausgeschenkt wird.

### Ortswissen

Was eine Figur sieht, steht in den lokalen Fakten. Was sie über ihre Gegend **weiß**, ohne es zu sehen, ist Ortswissen – eine eigene Liste (`placeKnowledge`, höchstens 10 Sätze) neben den lokalen Fakten.

- **Quelle real:** die importierten Kartendaten (`region_features`) im Umkreis von 6 km – Ort und Einordnung, Nachbarorte, Gewässer, Wald, benannte Plätze und Betriebe, Straßen. Immer das Nächste zuerst.
- **Quelle NOXIA:** Gebäude am Ort im Umkreis von 4 km (je Art das nächste, mit grober Entfernung und Himmelsrichtung), kanonische Landmarken (`earthLandmarks.ts`) und der Referenzstandort Selmecke.
- **Nichts Erfundenes:** Liegen für einen Ort keine Kartendaten vor, ist die Liste leer. Die Gesprächsroute erlaubt zusätzlich allgemein Bekanntes zur realen Gegend, aber keine weiteren Einrichtungen, Öffnungszeiten oder Wege.
- **Wer es weiß:** alle Figuren im Lokal – sie sind Bewohner des Ortes.
- **Kein Wissen über Personen:** Wer wo wohnt oder was jemand besitzt, steht nicht darin.

Regeln: `lib/game/hospitality/placeKnowledge.ts`, Laden: `placeKnowledge.server.ts`, Abruf: `GET /api/game/hospitality/place?tileEntityId=…`. Ein Lokal ohne Erdposition (Station) hat noch kein Ortswissen.

### Einführung je Haus

Entscheidung (Thomas, 13.10.2026): Jedes Gebäude kann einen Einstieg in die Welt geben, und jedes auf seine Art – die Hinweise werden den Leuten in den Mund gelegt, die dort arbeiten. Für die Lokale ist das gebaut (`lib/game/hospitality/introductions.ts`):

| Haus | Haltung des Personals | worauf es Neue stößt |
|---|---|---|
| Café | seriös, verlässlich, rät zum soliden Weg | Akademie, Verwaltung, klein anfangen |
| Bar | halblaut, sieht überall eine Gelegenheit, nennt das Risiko | Preisunterschiede, Spediteur, herumkommen |
| Restaurant | gesellig, empfiehlt | selbst bauen, Betriebe und Personal, Handel |
| Haus mit Gästezimmern | zuvorkommend wie am Empfang | Sehenswertes aus dem Ortswissen, Linienflug |

- Die Gesprächsroute bekommt dafür das Feld `introduction` (Haltung und höchstens fünf Hinweise). Nur das Personal erhält es.
- **Der Ton färbt, die Tatsachen bleiben.** Alle Hinweise nennen Wege, die es im Spiel gibt. Die Bar klingt zwielichtig, bietet aber nichts Verbotenes an – das gibt es im Spiel nicht.
- **Kein erfundenes Angebot.** Eine bestimmte Stelle auf einem Handelsschiff, ein Auftrag oder ein Preis kommt erst über echte Daten ins Gespräch (Request R-10). Bis dahin macht das Personal Lust und zeigt die Richtung.
- Die Orientierungsfakten des Ankunftscafés (`ARRIVAL_ORIENTATION_FACTS`) bleiben daneben bestehen.

### Mitbekommenes

Wer hinter dem Tresen steht, bekommt mit, was am Ort geschieht. Das ist eine dritte Liste (`hearsay`, höchstens 6 Sätze) neben lokalen Fakten und Ortswissen, und nur das Personal erhält sie.

- **„Selbst gesehen:“** – wie viele Gäste heute da waren, wie lange der letzte her ist (aus `person_consumption_events`).
- **„Gehört:“** – am Ort wird gebaut (`player_builds`), es gab Streit oder jemand hat geholfen (`population_events`, letzte 24 Stunden), Leute suchen Arbeit.
- **Keine Namen, keine Zahlen über Geld.** Die Gesprächsroute verlangt, Gehörtes als Hörensagen weiterzugeben.
- **Alles aus echten Daten.** Ist nichts geschehen, ist die Liste leer.

Regeln: `lib/game/hospitality/hearsay.ts`; geliefert von `GET /api/game/hospitality/guests` (`heard`, dazu `hour` und `upper`). Das ist ein Blick des Lokals auf den Ort, kein Wissen einzelner Personen: Zwei Wirte am selben Ort haben dasselbe gehört, und niemand erinnert sich später daran. Echte Gerüchte, die von Person zu Person wandern, und Auskunft gegen Geld wie in SunDog: Request R-8.

## 5. Bestellen

Am `servicePoint` (vor Tresen, Empfang oder Automat) öffnet ein Knopf die Karte in der Seitenleiste.

- Karte und Kontostand kommen von `GET /api/game/hospitality/order`. Was nicht bezahlbar ist, steht auf der Karte, ist aber gesperrt.
- Bestellen geht nur, solange der Spieler am `servicePoint` steht.
- Jeder Bestellversuch trägt eine eigene `requestId`. Bricht die Verbindung ab, behält der nächste Klick auf denselben Posten die Kennung – es wird nicht doppelt gebucht.
- Nach der Buchung zeigt die Karte den neuen Kontostand und sperrt, was nun zu teuer ist.
- In einem geschlossenen Lokal gibt es keine Karte.
- Die Karte erscheint von selbst, sobald der Spieler an der Kante von Tresen oder Empfang steht.
- **Sichtbar:** Was bestellt wurde, steht für den Rest des Besuchs im Raum – vor dem Spieler oder vor der Person, der es gilt.
- **Ausgeben:** Ist eine Person angesprochen, lässt sich „Für mich“ oder „Für <Person>“ wählen. Die Bestellung trägt dann `recipientPersonId`. Die beschenkte Figur weiß im Gespräch, dass ihr ausgegeben wurde; alle anderen haben nur eine Bestellung gesehen.
- **Noch ohne Wirkung auf die Person:** Die Buchung wertet `recipientPersonId` bisher nicht aus. Dass die Versorgung der beschenkten Person steigt und die Beziehung sich ändert, gehört zum Teilprojekt Bevölkerung und Ökonomie (dort als Aufgabe eingetragen). Ein eigenes Bedürfnis „Durst“ gibt es nicht; Essen und Trinken laufen beide über `sustenance`.

Karten gibt es bisher nur für `cafe`. Vorschlag für die fehlenden Zeilen in `hospitality_menu` (anzulegen im Teilprojekt Bevölkerung und Ökonomie; Preise an Getränk 3 / Kuchen 5 / Mahlzeit 8 ausgerichtet):

| `entity_id` | `item_code` | `label` | Credits |
|---|---|---|---|
| `bar` | `drink` | Getränk | 3 |
| `bar` | `snack` | Snack | 4 |
| `bar` | `longdrink` | Longdrink | 6 |
| `restaurant` | `drink` | Getränk | 3 |
| `restaurant` | `dessert` | Nachtisch | 5 |
| `restaurant` | `starter` | Vorspeise | 6 |
| `restaurant` | `main` | Hauptgericht | 12 |

### Bilder statt nur Text

Jeder Posten der Karte hat ein gezeichnetes Bild (`app/earth/HospitalityItemIcon.tsx`): Die Karte ist ein Raster aus Kacheln mit Bild, Name und Preis, und was bestellt wurde, steht mit demselben Bild im Raum. Das Bild hängt am `item_code` (`drink`, `cake`, `meal`, `snack`, `longdrink`, `starter`, `main`, `dessert`); ein unbekannter Posten bekommt den Teller unter der Haube. Vorbild ist SunDog, wo Waren und Speisen als Bilder gekauft und bewegt werden. Ein neuer Posten in `hospitality_menu` braucht also auch ein Bild hier.

## 6. Anschlussstellen – nicht gebaut

### 6.1 Wirt als echter Bewohner (`NOXIA-LIVING-0010`)

- **Eingang ins Raummodell:** `VenueResidentInput.worksHere`. Der Wert kommt aus `person_assignments` (`assignment_type = 'work'`, `tile_entity_id` = dieses Gebäude). Mehr braucht das Raummodell nicht.
- **Stellenzahl:** Die Personalplätze je Lokal (1 / 2 / 3) sind die natürliche Zahl offener Stellen. `Vacancy` in `lib/game/population/employment.ts` kann sie aus `VENUE_LAYOUTS[kind].spots` mit `kind === 'staff'` ableiten statt eine zweite Zahl zu führen.
- **Anwesenheit:** `/api/game/population?tileEntityId=…` liefert alle Personen mit Zuweisung zum Gebäude, unabhängig davon, ob sie gerade da sind. Der Raum zeigt deshalb auch Personal, das laut Tagesrhythmus schläft. Abhilfe ist `person_interior_presence`: Das Raummodell wertet `presenceRoomId` bereits aus. Offen ist, dass die Schicht diesen Eintrag verlässlich schreibt.
- **Betrieb:** `venueService` schaut nur auf die Arbeitszuweisung. Sobald Anwesenheit verlässlich ist, sollte „geschlossen“ an anwesendem Personal hängen, nicht an der Stelle.
- **Rollenname:** Die Gesprächsroute nimmt `people.public_role`, sobald die Person bekannt ist. Das Raummodell vergibt keine Berufsbezeichnung.

### 6.2 Wirkung auf Stimmung (`NOXIA-LIVING-0006`)

- **Entscheidung steht:** keine Bar-eigene Affektlogik, sondern ein allgemeiner Mechanismus für soziale Orte (`settlement-tiers.md`). Der Anker dafür ist `SOCIAL_INFRASTRUCTURE` in `lib/game/settlements/tiers.ts`; `restaurant` ist dort jetzt eingetragen (Begegnungsort, kein Ankunftspunkt, keine Erfüllung der Standardausstattung).
- **Auslöser:** ein Besuchsereignis der Bevölkerung, das `applyEventAffect` (`lib/game/population/affectRuntime.ts`) bewertet. Das Raummodell erzeugt keine Ereignisse.
- **Wer wen wahrnimmt:** `interiorPresenceObservations` wertet Personen im selben Raum als gemeinsam anwesend. Das Raummodell rechnet großzügiger mit Sichtbereichen (Gastraum und Tresen gehören zusammen). Bevor Begegnungen im Lokal auf Stimmung wirken, sollte eine der beiden Regeln gelten – `sightAreas` ist dafür als reine Funktion verfügbar.
- **Gespräch:** Stimmung fließt heute nicht in die lokalen Fakten ein. Wenn sie es soll, dann nur die eigene der Figur und was sie an anderen sehen kann (gezeigte, nicht empfundene Stimmung – Abschnitt 5 von LIVING-0006).

## 7. Offen

1. Café und Bar teilen sich noch die Frage aus `settlement-tiers.md`: eine Gebäudedefinition mit zwei Namen oder zwei Definitionen. Das Raummodell trägt beides.
2. `order`, `serve`, `pay`, `sit`, `consume` stehen jetzt im Fähigkeitsregister. Die allgemeinen Kennungen `arrival`, `exit`, `conversation`, `storage`, `staff` nutzen auch andere Vorlagen (Akademie, Verwaltung); sie sind weiter nicht registriert und gehören zum gemeinsamen Innenraumsystem.
3. Der Raum zeigt Personen ohne Bewegung; Wege zwischen Plätzen gibt es nicht.
4. Die Bestelloberfläche ist gegen nachgestellte Antworten geprüft, nicht gegen die echte Datenbankfunktion.
5. Ortswissen gibt es nur im Lokal. Die Personen draußen auf der Erdoberfläche (`EarthWalkableSurface`) wissen weiterhin nur, was sie im Umkreis von 45 m sehen; `placeKnowledge` der Gesprächsroute steht ihnen offen.
6. Ortswissen ist für alle Figuren gleich. Dass Zugezogene weniger wissen als Alteingesessene, ist nicht abgebildet.
