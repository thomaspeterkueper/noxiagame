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

### Lokal ohne Personal

Entscheidung (Thomas, 10.10.2026): Ein Lokal ohne Personal ist geschlossen – oder ein Automatencafé. Den Platzhalter-Wirt gibt es nicht mehr. `venueService` leitet daraus ab:

| Betrieb | Wann | Folge |
|---|---|---|
| `staffed` | mindestens eine Person arbeitet hier | Personal steht am Platz, kennt die Karte |
| `self-service` | Café ohne Personal | Automat am Tresen verkauft, niemand berät; Gäste können da sein |
| `closed` | Bar oder Restaurant ohne Personal | kein Ausschank, keine Figuren; der Spieler kann nur wieder gehen |

Dass gerade das Café zum Automatencafé wird und Bar und Restaurant schließen, ist eine Lesart dieser Entscheidung, keine eigene Datenspalte. Soll ein Gebäude das selbst festlegen können, braucht es ein Merkmal am Gebäude.

„Personal“ heißt hier: Arbeitszuweisung zu diesem Gebäude. Ob die Person gerade Schicht hat, weiß der Raum nicht (siehe 6.1).

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

## 5. Bestellen

Am `servicePoint` (vor Tresen, Empfang oder Automat) öffnet ein Knopf die Karte in der Seitenleiste.

- Karte und Kontostand kommen von `GET /api/game/hospitality/order`. Was nicht bezahlbar ist, steht auf der Karte, ist aber gesperrt.
- Bestellen geht nur, solange der Spieler am `servicePoint` steht.
- Jeder Bestellversuch trägt eine eigene `requestId`. Bricht die Verbindung ab, behält der nächste Klick auf denselben Posten die Kennung – es wird nicht doppelt gebucht.
- Nach der Buchung zeigt die Karte den neuen Kontostand und sperrt, was nun zu teuer ist.
- In einem geschlossenen Lokal gibt es keinen Knopf.

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
