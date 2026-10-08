# NOXIA-LIVING-0010 – Wohnungs- und Stellenmarkt für Personen

Status: proposed (Stufenplan), accepted (reine Regeln, Stufe 1)
Date: 2026-10-08
Code: `lib/game/population/housing.ts`, `employment.ts`, `access.ts`
Test: `npm run test:housing-market`
Bezug: NOXIA-LIVING-0009 (Umzugsentscheidung), NOXIA-OMNI-0001 (Spielraum)

## Kontext

Die Sozialwelt ist bisher symmetrisch: Niemand verfügt über Wohnung oder Arbeit eines anderen, und der gemessene Spielraum ist fast gleich verteilt. Umzüge existieren nur im Forschungslauf, als sofortiger Wechsel auf einen freien Platz.

Personen sollen wie Spieler über Miete, Eigentum und Stellen an Wohnung und Arbeit kommen. Dabei entscheidet nicht die Person allein: Vermieter und Arbeitgeber können ablehnen. Eine Wohnung, die nicht vergeben wird, ist kein realer Spielraum.

## Befund zum Ausgangszustand (Live, 2026-10-08)

| Gruppe | Personen | Lage |
|---|---|---|
| Benannte Leitungen in Tharsis | 7 | Arbeit, aber keine Wohnzuweisung |
| Unbenannte in Tharsis | 8 | „wohnen" im Verwaltungsgebäude, vier arbeiten auch dort |
| Prometheus, Mond, Phobos | 12 | Wohnzuweisung ohne Gebäude. Auf Mond und Phobos steht je ein leeres staatliches Habitat, auf Prometheus keines |
| Erde | 4 | in Wohnblöcken eines Spielers |
| Q1 | 1 | in einem staatlichen Habitat |

Dazu:

- Alle 25 Mietverhältnisse haben den Status `provided` ohne Miete, 12 davon ohne Vermieter.
- Keine Person hat ein Wirtschaftskonto (`person_economic_actors` ist leer). Lohn, Miete, Konsum und Immobilienkauf laufen deshalb für niemanden.
- Wohngebäude haben keine Kapazität. `residential_block` fehlt in `building_definitions`, `habitat` trägt nur `population_bonus = 100`.
- Es gibt 13 Wohngebäude, keines steht zum Verkauf, und kein Hotel.

Ein Markt braucht also zuerst Konten, Kapazitäten und einen bereinigten Bestand.

## Entscheidung

### Wohnformen

| Form | Bedeutung |
|---|---|
| `provided` | zugewiesen ohne Miete, der heutige Zustand |
| `rented` | Miete je Abrechnungsintervall (720 Ticks) an einen Vermieter |
| `owned` | selbstbewohntes Eigentum, gekauft zum Angebotspreis |
| `hotel` | Preis je Nacht, ohne Bindung: bei Ankunft, nach einer Räumung, während der Suche |
| `none` | ohne Wohnung: Ruhe erholt schlechter, das Sicherheitsgefühl sinkt |

### Wer entscheidet was

- **Die Person** sagt, dass sie wechseln will und wohin (`decideRelocation`, `chooseHousing`). Sie zieht nicht freiwillig ins Hotel und nur in etwas deutlich Besseres, außer sie muss.
- **Bezahlbarkeit** begrenzt das Angebot: Miete bis 40 % des Lohns, Kauf nur mit Preis plus sieben Tageslöhnen Reserve (wie `run_npc_property_market`), Hotel nur mit Geld für drei Nächte.
- **Der Vermieter** vergibt oder lehnt ab (`landlordDecision`). Öffentlicher Wohnraum prüft nur den Platz. Private Vermieter lehnen bei zu geringem Einkommen und nach einer Räumung im letzten Jahr ab, außer eine Kaution wiegt sie auf. Wer persönlich vermietet, kann jemanden ablehnen, den er nicht mag.
- **Der Vermieter setzt den Preis** (`adjustRent`): In einer vollen Siedlung steigt die private Miete um 5 % je Intervall, leerstehender Wohnraum wird billiger. Öffentliche Mieten bleiben fest.
- **Mietschulden** führen nach zwei unbezahlten Intervallen zur Räumung (`settleRent`).
- **Der Arbeitgeber** stellt ein oder lehnt ab (`employerDecision`): fehlende Qualifikation, frühere Kündigung, persönliche Abneigung.
- **Die Person** kann ein Stellenangebot ablehnen (`considerJobOffer`).

### Macht als Protokoll, nicht als Wert

Jede Vergabe, Ablehnung und jedes ausgeschlagene Angebot wird als `AccessRecord` festgehalten. `gatekeeperPower` und `summarizeAccess` werten aus, wer über wie viele Menschen entschieden hat, welcher Anteil des Vorhandenen wirklich zugänglich war und wer überall abgewiesen wurde.

Macht wird damit nicht eingebaut, sondern beobachtet: Sie zeigt sich als Asymmetrie in diesem Protokoll oder gar nicht.

## Stufenplan

| Stufe | Inhalt | Stand |
|---|---|---|
| 1 | Reine Regeln für Wohnen, Stellen und Zugangsprotokoll | fertig |
| 2 | Forschungslauf: Markt mit Löhnen, Mieten, Eigentum, Hotels. Spielraum zählt nur zugängliche Plätze. Über Spieljahre beobachten | fertig (`lib/research/colony/colonyMarket.ts`) |
| 3 | Live-Bestand bereinigen: Wohnungen für die sieben Leitungen, Gebäude für die zwölf ohne Gebäude, Verwaltung nicht als Wohnung. Kapazität je Wohngebäude, Hotel als Gebäudetyp, Konten und Lohn für Personen | entschieden, Migration geschrieben, noch nicht angewendet |
| 4 | Schattenbetrieb live: Personen treffen echte Entscheidungen gegen den Live-Bestand, protokolliert werden Zusage, Ablehnung und Spielraum. Nichts wird ausgeführt | offen |
| 5 | Atomarer Wohnungswechsel als Datenbankfunktion: Platz reservieren, alte Zuweisung beenden, neue anlegen, Mietverhältnis synchronisieren, bei Fehler alles zurück. Keine direkte Änderung von `current_location_id` | offen |
| 6 | Stellenwechsel entsprechend | offen |

Über Spieljahre lässt sich nur im Forschungslauf beobachten. Der Live-Schattenbetrieb läuft in Echtzeit und zeigt, ob die Entscheidungen auf dem echten Bestand plausibel sind.

## Entscheidungen für Stufe 3 (2026-10-08)

Leitlinie: Der Staat garantiert Existenzfähigkeit, aber nicht Gleichwertigkeit. Reihenfolge: staatliche Habitate als historische Grundversorgung, echte Kapazitäten, ökonomische Identität aller Personen, Mindestunterkunft – danach erst Markt und Macht.

1. **Die sieben Tharsis-Leitungen wohnen in einem neuen staatlichen Habitat**, nicht im Wohnblock eines Spielers. Eine Datenlücke soll keinem Spieler Vermietermacht verschaffen, die nicht aus dem Spiel entstanden ist.
2. **Prometheus bekommt ein staatliches Habitat.** Die vier dort Arbeitenden bleiben.
3. **Kapazität ist ein eigener Wert:** `tile_entities.residential_capacity`, Habitat 8, Wohnblock 12. Sie wird nicht aus `population_bonus` abgeleitet. Die Belegung ergibt sich aus aktiven `home`-Zuweisungen (Sicht `residential_occupancy`).
4. **Hotels dürfen Staat, Unternehmen und Spieler betreiben.** Jeder relevante Ort hat zusätzlich eine staatlich garantierte Mindestunterkunft, damit kein einzelner Eigentümer den Zugang zu einer Siedlung sperren kann.
5. **Alle 32 Personen erhalten einen `person_economic_actor`.** Der Startbestand stammt aus der Lohnhistorie. Wo es keine gibt, wird ein ausdrücklich gekennzeichneter Bootstrap-Betrag gebucht (Ledger-Typ `endowment`, Referenz `bootstrap:person:<id>`).

### Backfill ist keine Marktentscheidung

Zuweisungen aus der Datenbereinigung dürfen in der Spielraum- und Machtanalyse nicht als freiwillige Entscheidungen zählen. Sonst würde die Bereinigung später als gesellschaftliches Verhalten gemessen.

- `person_tenancies.origin` unterscheidet `backfill`, `provided` und `market`. Alle bestehenden Mietverhältnisse sind `backfill`.
- `AccessRecord.origin` trägt dieselbe Herkunft. `gatekeeperPower` und `summarizeAccess` werten nur `market` aus (`marketRecords`).

### Umsetzung

Migration `20261008120000_housing_capacity_and_backfill.sql`.

Abweichung von der Vorlage: Die Mindestunterkunft ist vorerst kein eigener Gebäudetyp, sondern `transient_capacity` – zwei Gästeplätze in einem staatlichen Habitat je Ort. Die Oberfläche kennt bisher nur `habitat`. Kommerzielle Hotels kommen als eigener Gebäudetyp mit Stufe 5.

### Arbeitgeberfinanzierung (2026-10-08)

Migration `20261008150000_employer_funding.sql`.

- **Öffentliche Arbeitgeber** werden aus den Steuereinnahmen ihres Ortes finanziert. Jede Einnahme im `colony_ledger` erscheint beim öffentlichen Akteur als `income` mit Referenz `colony_ledger:<id>`.
- **Ursache der leeren Kassen:** `tick.ts` bucht `tax_payout` und `building_payout`, beide Typen fehlten im Check-Constraint von `colony_ledger`. Die Buchung schlug still fehl. Die Migration ergänzt die Typen.
- **Spielerunternehmen und NPC-Firmen** erhalten keine laufende Finanzierung. Der Eigentümer kapitalisiert über `fund_player_corp`, oder das Unternehmen erwirtschaftet Einnahmen.
- **Einmalige Übergangsreserve:** Jeder bestehende Arbeitgeber, dessen Konto keinen Tageslohn deckt, erhält 14 Tageslöhne als `endowment` mit Referenz `bootstrap:employer:<actor_id>`.
- **Danach gilt:** Reicht das Arbeitgeberkonto nicht, wird kein Lohn gezahlt.

## Stufe 2: Markt im Forschungslauf (2026-10-08)

Code: `lib/research/colony/colonyMarket.ts`, Aufruf `npm run research:colony -- --market`. Test: `npm run test:colony-run`.

Der Lauf führt die reinen Regeln aus Stufe 1 über Spieljahre:

- **Täglich:** Lohn vom Arbeitgeberkonto, Lebenshaltung, Hotelrechnung. Kann der Arbeitgeber nicht zahlen, bleibt der Lohn aus. Ein zahlungsunfähiger Arbeitgeber bietet keine Stelle an.
- **Alle 30 Tage:** Miete, Mietschulden, Räumung, Mietanpassung.
- **Tägliche Prüfung je Person:** `decideRelocation` liefert nur den Wunsch. Danach wählt die Person (`chooseHousing`), der Vermieter oder Arbeitgeber entscheidet, erst dann wird gewechselt. Höchstens ein Wechsel pro Tag.
- **Spielraum:** Als offener Platz zählt nur, was die Person bezahlen kann und was Vermieter oder Arbeitgeber ihr geben würden.
- **Protokoll:** Jede Zusage und Ablehnung ist ein `AccessRecord` mit `origin: 'market'`.

### Erster Befund

Synthetische Kolonie, 36 Personen, 3 Siedlungen, 3 Spieljahre. Je Siedlung ein volles staatliches Habitat, private Mietwohnungen, ein Gästehaus, ein Hotel, zwei Kaufhäuser; ein Unternehmen, das mehr Lohn zahlt, als es einnimmt.

| Größe | Wert |
|---|---|
| Vermögen, Gini | 0,12 am ersten Tag, 0,31 nach drei Jahren |
| Vermögen nach drei Jahren | 0 bis 82.730, Median 42.070 |
| Erster ausgefallener Lohn | Tag 98 |
| Erste Räumung | Tag 331 |
| Räumungen | 6 |
| Ablehnungen wegen früherer Mietschulden | 546, verteilt auf 3 Personen |
| Tage mit Wohnungslosen | 511 von 1.095 |
| Anteil gewährter Anfragen | 41 % |

Spielraum am letzten Tag nach Wohnform:

| Wohnform | Personen | Ortsspielraum | Spielraum gesamt |
|---|---|---|---|
| staatlich | 9 | 0,71 | 0,67 |
| gemietet | 18 | 0,69 | 0,66 |
| Eigentum | 6 | 0,70 | 0,59 |
| ohne Wohnung | 3 | 0,08 | 0,44 |

Die Kette ist: Arbeitgeber wird zahlungsunfähig, Lohn fällt aus, Mietschulden, Räumung. Danach lehnen private Vermieter ein Jahr lang ab. Die drei Betroffenen pendeln zwischen Gästehaus und Straße (330 Hoteleinzüge) und kommen nicht zurück in eine Wohnung. Macht zeigt sich hier als Gedächtnis der Vermieter, nicht als Miethöhe: Die Mieten sind gesunken (407 auf 371).

Einschränkungen: Die Zahlen hängen an den synthetischen Startwerten (Löhne, Mieten, Lebenshaltung 25 pro Tag). Vermögen wächst zu leicht, es gibt außer Miete und Hauskauf nichts, wofür Menschen Geld ausgeben. Ein Lauf mit dem Live-Bestand steht aus.

## Noch offen

1. Ob die Steuereinnahmen die öffentlichen Löhne tragen, ist ungeprüft. Es gab bisher keine einzige Buchung.
2. `residential_block` fehlt in `building_definitions`.
3. Kommerzielle Hotels als eigener Gebäudetyp.
