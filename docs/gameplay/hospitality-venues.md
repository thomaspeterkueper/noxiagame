# Café, Bar und Restaurant – Innenaufbau, Figuren, Gespräche

Status: gebaut (Innenaufbau, Platzierung, Gesprächswissen). Wirt als Bewohner, Bestellung/Bezahlung und Stimmungswirkung sind **nicht** gebaut – nur die Anschlussstellen sind unten beschrieben.

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

Ohne Personal bleibt der bisherige Platzhalter: ein Wirt ohne Personendatensatz und ohne Gesprächsspeicher, damit niemand in einen leeren Raum kommt.

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
| Weg in die Welt (Akademie, Handel, Linienflug, Verwaltung) | nein | nur in Ankunftslokalen (Café, Bar) |

Nie enthalten: Kontostand, Wissensstufe, Beruf oder Vorhaben des Spielers. Das steht als ausdrücklicher Fakt dabei – die Figur erfährt es nur, wenn der Spieler es erzählt. Der Koch im Restaurant bekommt weder Raumaufbau noch Gäste, weil er sie nicht sieht.

Die Liste bleibt innerhalb der Grenzen der Gesprächsroute (höchstens 16 Fakten mit je 140 Zeichen). Das ist geprüft, weil die Route sonst still abschneidet.

Änderung gegenüber vorher: Der Weg in die Welt hing am Platzhalter-Wirt. Seit der Migration `20261010090000_earth_cafe_host.sql` steht im Startcafé eine echte Person mit Arbeitszuweisung – sie ersetzte den Platzhalter und hatte dieses Wissen nicht mehr. Jetzt hängt es an der Rolle im Raum (Personal eines Ankunftslokals), nicht am Platzhalter.

## 5. Anschlussstellen – nicht gebaut

### 5.1 Wirt als echter Bewohner (`NOXIA-LIVING-0010`)

- **Eingang ins Raummodell:** `VenueResidentInput.worksHere`. Der Wert kommt aus `person_assignments` (`assignment_type = 'work'`, `tile_entity_id` = dieses Gebäude). Mehr braucht das Raummodell nicht.
- **Stellenzahl:** Die Personalplätze je Lokal (1 / 2 / 3) sind die natürliche Zahl offener Stellen. `Vacancy` in `lib/game/population/employment.ts` kann sie aus `VENUE_LAYOUTS[kind].spots` mit `kind === 'staff'` ableiten statt eine zweite Zahl zu führen.
- **Anwesenheit:** `/api/game/population?tileEntityId=…` liefert alle Personen mit Zuweisung zum Gebäude, unabhängig davon, ob sie gerade da sind. Der Raum zeigt deshalb auch Personal, das laut Tagesrhythmus schläft. Abhilfe ist `person_interior_presence`: Das Raummodell wertet `presenceRoomId` bereits aus. Offen ist, dass die Schicht diesen Eintrag verlässlich schreibt.
- **Platzhalter:** Er verschwindet, sobald mindestens eine Person hier arbeitet (`hostResident` im Bauteil). Ist die einzige Kraft nicht anwesend, wäre der Raum leer – diese Entscheidung (Platzhalter zurück oder Lokal geschlossen) gehört in den anderen Strang.
- **Rollenname:** Die Gesprächsroute nimmt `people.public_role`, sobald die Person bekannt ist. Das Raummodell vergibt keine Berufsbezeichnung.

### 5.2 Bestellung und Bezahlung (`NOXIA-FIN-0001`)

- **Ort im Raum:** `VenueLayout.servicePoint` (vor Tresen bzw. Empfang). Dort erscheint heute ein Knopf, der nur meldet, dass Bestellen noch nicht möglich ist.
- **Fähigkeiten:** Die Vorlagen tragen `order`, `serve`, `pay` am Tresen bzw. im Speiseraum. Diese Kennungen stehen noch nicht in `INTERIOR_CAPABILITY_REGISTRY`; `validateInteriorTemplate` meldet sie deshalb als unbekannt – beim Café schon vor dieser Arbeit. Wer Bestellung baut, trägt sie dort ein.
- **Angebot und Preis:** `npc_service_catalog` kennt bereits `cafe` / `cafe_meal` (8 Credits, Bedürfnis `sustenance`). Für `bar` und `restaurant` fehlen Zeilen.
- **Buchung:** Spieler → Betreiber als besteuerter Transfer nach `taxedTransfer` (`lib/game/financeSemantics.ts`), so wie `run_npc_consumption` es für Bewohner tut. Keine Geldschöpfung, Steuer aus dem Bruttopreis.
- **Nicht dafür verwenden:** den Marker `[[ACTION:ACCEPT_CREDITS]]` der Gesprächsroute. Er ist ein Geschenk an eine Person, kein Kauf beim Betrieb.
- **Gespräch:** Zwei Fakten sagen heute ausdrücklich, dass nichts ausgeschenkt oder kassiert wird (`venueConversationFacts`, Kommentar an der Stelle). Mit der Bestellung werden sie durch Angebot und Preise ersetzt – für das Personal vollständig, für Gäste nur das, was sie selbst bestellt haben.

### 5.3 Wirkung auf Stimmung (`NOXIA-LIVING-0006`)

- **Entscheidung steht:** keine Bar-eigene Affektlogik, sondern ein allgemeiner Mechanismus für soziale Orte (`settlement-tiers.md`). Der Anker dafür ist `SOCIAL_INFRASTRUCTURE` in `lib/game/settlements/tiers.ts`; `restaurant` ist dort jetzt eingetragen (Begegnungsort, kein Ankunftspunkt, keine Erfüllung der Standardausstattung).
- **Auslöser:** ein Besuchsereignis der Bevölkerung, das `applyEventAffect` (`lib/game/population/affectRuntime.ts`) bewertet. Das Raummodell erzeugt keine Ereignisse.
- **Wer wen wahrnimmt:** `interiorPresenceObservations` wertet Personen im selben Raum als gemeinsam anwesend. Das Raummodell rechnet großzügiger mit Sichtbereichen (Gastraum und Tresen gehören zusammen). Bevor Begegnungen im Lokal auf Stimmung wirken, sollte eine der beiden Regeln gelten – `sightAreas` ist dafür als reine Funktion verfügbar.
- **Gespräch:** Stimmung fließt heute nicht in die lokalen Fakten ein. Wenn sie es soll, dann nur die eigene der Figur und was sie an anderen sehen kann (gezeigte, nicht empfundene Stimmung – Abschnitt 5 von LIVING-0006).

## 6. Offen

1. Café und Bar teilen sich noch die Frage aus `settlement-tiers.md`: eine Gebäudedefinition mit zwei Namen oder zwei Definitionen. Das Raummodell trägt beides.
2. Die Begrüßung des Platzhalter-Wirts ist für alle drei Lokale gleich.
3. Der Raum zeigt Personen ohne Bewegung; Wege zwischen Plätzen gibt es nicht.
