# NOXIA-FIN-0002 – Haushalt der Kolonien

Status: **weitgehend entschieden** – A1–A3, B, C, Miete und Linienfracht live (06.11.2026); Teil D live seit 07.11.2026; offen: Erde in der Anlaufhilfe, Spieler in der Versorgung
Datum: 29.10.2026
Bezug: NOXIA-FIN-0001 (Geldregeln), NOXIA-OMNI-0001 (Spielraum), NOXIA-ETHICS-0001, Essay „Warum der Mars Henry George recht gibt“, population-economy Aufgabe 23 (Zuzug mit der Fracht)
Wunsch Thomas (29.10.2026): „ja bitte“ – ein Vorschlag, wie die Kolonien zu einem Haushalt kommen, damit der Zuzug in Gang kommt.

## Anlass

Seit dem 29.10. kann mit jeder Fracht von der Erde eine Person in eine Kolonie ziehen. Sie kommt nur, wenn ihr Arbeitgeber sieben Tage Lohn decken kann. Die öffentlichen Kassen von Mond, Mars und Phobos sind leer; deshalb kommt niemand.

## Befund (Live-Datenbank, Woche bis 29.10.2026)

| | Mond | Mars | Phobos |
|---|---:|---:|---:|
| Öffentliche Stellen (besetzt) | 4 | 13 | 2 |
| Lohnbedarf je Woche | 2 135 Cr | 7 980 Cr | 945 Cr |
| Einnahmen je Woche (nur Hafenkantine) | 108 Cr | 1 020 Cr | 192 Cr |
| Kasse heute | 26 Cr | 118 Cr | 54 Cr |
| Gezahlte Löhne, letzte 28 Tage | 4 490 Cr | 17 180 Cr | 2 220 Cr |
| Startreserve (einmalig, 2026-07) | 4 270 Cr | 14 910 Cr | 1 890 Cr |
| Mieten in staatlichen Wohnungen | keine | keine | keine |
| Steuersätze | 0 % | 0 % | 0 % |

**Was das heißt:**
- Die Kolonien haben ihre Startreserve aufgebraucht. Seitdem zahlen sie nur, was die Kantine einbringt: Auf dem Mond bekommen die vier Beschäftigten zurzeit etwa ein Zehntel ihres Lohns, auf dem Mars gut ein Viertel.
- Die Erde steht anders da: Konsumsteuer 19 % (seit 25.10.), Grundstücksverkäufe, mehrere ausgewiesene Reserven; Kasse 20 500 Cr.

**Nebenbefunde:**
1. **Wasser ohne Käufer.** Die Firma Boann bekommt für Wasser, das am Mars ins Lager geht, 13 094 Cr je Woche gutgeschrieben – ohne dass jemand zahlt (`lib/game/tick.ts`, `produce`). Das ist die größte Geldquelle im Spiel, und sie ist nicht als Emission ausgewiesen (gegen NOXIA-FIN-0001). Boann beschäftigt niemanden.
2. **Eisbohrer auf dem Mond.** Boann besitzt 16 Eisbohrer auf dem Mond; sie stehen still, weil das Wasserlager voll ist (1 300 von 1 300). In den Daten sind sie als Spielereigentum (`owner_class = 'PLAYER'`) geführt, obwohl eine Firma sie besitzt. Deshalb zählen sie auch beim Zuzug nicht als Arbeitgeber.
3. **Wohnen ohne Miete.** In den staatlichen Habitaten der Kolonien zahlt niemand Miete; auf der Erde sind es 200 Cr je 30 Tage.

## Grundsätze

- **Geldregeln (NOXIA-FIN-0001):** Jede Einnahme der Kolonie ist ein Transfer oder eine ausgewiesene Emission mit Emittent, Ursache, Obergrenze und Beleg.
- **Boden und Eis gehören allen (Henry George):** Wer Rohstoffe aus dem Boden einer Siedlung holt, nutzt, was niemand geschaffen hat. Ein Teil des Erlöses gehört dem Gemeinwesen. In der Kuppel ist das nicht Theorie, sondern Alltag.
- **Spielraum (NOXIA-OMNI-0001):**
  - Ein Haushalt soll vor allem den Gemeinraum tragen: Versorgung, Kantine, Werkstatt, Funk. Dazu kommt der Folgeraum: Zuzug, neue Beziehungen, neue Orte.
  - Eine Abgabe, die Erzeuger erdrückt, verengt Eigenraum; deshalb maßvoll und an den echten Erlös gebunden.
  - Eine Anlaufhilfe ohne Ende macht abhängig; deshalb befristet und abnehmend.

## Vorschlag

### Teil A – eigene Einnahmen (Transfers, dauerhaft)

| Baustein | Regel | Ertrag je Woche heute |
|---|---|---|
| **A1 Förderabgabe** | 15 % des Erlöses aus Rohstoffen, die an einem Ort gefördert oder erzeugt werden (Wasser, Metall, Energie), gehen an die öffentliche Kasse dieses Ortes. Gebucht im selben Schritt wie der Erlös. | Mars ≈ 1 960 Cr; Mond 0, solange die Bohrer stehen |
| **A2 Miete in staatlichen Wohnungen** | 200 Cr je 30 Tage wie auf der Erde, an die öffentliche Kasse. Wer weniger als die Miete hat, zahlt, was er kann (wie bisher bei Mieten). | Mond ≈ 190 Cr, Phobos ≈ 190 Cr, Mars nach Anteil staatlicher Wohnungen |
| **A3 Konsumsteuer** | 19 % wie auf der Erde, im Preis enthalten; der Gouverneur kann den Satz ändern. | gering, solange vor allem die staatliche Kantine verkauft |

Nach Teil A bleibt je Woche eine Lücke von etwa:
- Mars: 5 100 Cr (Bedarf 7 980, Einnahmen ≈ 2 900);
- Mond: 1 840 Cr (Bedarf 2 135, Einnahmen ≈ 300);
- Phobos: 660 Cr (Bedarf 945, Einnahmen ≈ 280).

### Teil B – private Stellen (Zuzug ohne öffentliches Geld)

- **B1 Bedienpersonal für Förderanlagen:** Je vier Eisbohrer oder ein Recycler eine Stelle (Technik, 75 Cr/Tag), bezahlt vom Eigentümer aus seinem Erlös.
  - Für Boann hieße das 5 Stellen, rund 2 600 Cr je Woche – ein Fünftel seines heutigen Wassererlöses.
  - Diese Stellen zählen beim Zuzug: Auf dem Mond sind 4 Wohnungen frei, also könnten 4 Menschen mit der nächsten Fracht kommen.
- **B2 Datenkorrektur:** Boanns Bohrer als Firmeneigentum führen (`owner_class = 'NPC'`).

Spielerhäuser stellen weiter nur ein, wenn der Spieler es will.

### Teil C – Anlaufhilfe (ausgewiesene Emission, befristet)

- **Emittent:** Koloniegründungsfonds der Solar Central Bank, im Auftrag der solaren Verwaltung. Beleg `bootstrap:colony-fund:<ort>:<woche>`.
- **Ursache:** Aufbau des öffentlichen Dienstes, bis die eigenen Einnahmen tragen.
- **Regel:** Wöchentlich nur die Lücke nach Teil A, über 8 Wochen abnehmend (zwei Wochen je 100 %, 75 %, 50 %, 25 %).
- **Obergrenze:** etwa das Fünffache der Wochenlücke:
  - Mars 25 500 Cr;
  - Mond 9 200 Cr;
  - Phobos 3 300 Cr;
  - zusammen rund 38 000 Cr. Zum Vergleich: Boanns nicht ausgewiesene Wassergutschrift beträgt drei Wochen à 13 000 Cr.
- **Danach:** Was nicht gedeckt ist, wird nicht mehr bezahlt. Eine Kolonie, die dann noch zu viele öffentliche Stellen hat, muss sie abbauen oder neue Einnahmen finden.

### Teil D – Wasser ohne Käufer (Entscheidung, später)

Der größte Fehler im Geldkreislauf ist Nebenbefund 1. Drei Wege:

1. **Ausweisen:** Die Gutschrift bleibt, wird aber als Emission „Versorgungsauftrag“ mit Obergrenze gebucht (keine Verhaltensänderung, nur ehrlich).
2. **Die Kolonie kauft:** Die öffentliche Kasse zahlt dem Erzeuger das Wasser, das ins Lager geht, finanziert über einen Versorgungsbeitrag der Bewohner je Kopf und Tag. Das ist sauber, aber teuer – Mars bräuchte dann rund 13 000 Cr mehr je Woche.
3. **Weniger Erlös:** Gutschrift nur noch für Wasser, das wirklich verbraucht wird, zum halben Preis (Herstellkosten statt Marktpreis).

Empfehlung: zuerst Weg 1, damit die Geldmenge stimmt; Weg 2 oder 3 entscheiden, wenn A–C laufen.

## Was es für den Zuzug bedeutet

- **Mond:** Mit B1 kommen bis zu 4 Menschen mit den nächsten Frachten (4 freie Wohnungen). Mit A und C werden die 4 öffentlichen Stellen wieder voll bezahlt.
- **Mars:** Mit A1 und C wird der öffentliche Dienst bezahlt; Zuzug kommt über freie Wohnungen bei Figuren und neue Stellen.
- **Phobos:** Mit A2 und C wird der öffentliche Dienst bezahlt; Zuzug erst, wenn dort Förderanlagen oder Betriebe entstehen.

## Entschieden und umgesetzt (06.11.2026)

Thomas: „ja, auch auf Miete sollte es Steuern geben“ – Antwort auf Frage 2. Live mit `20261106010000_colony_rent_and_taxes.sql`:
- **Miete in staatlichen Habitaten (A2):** 24 Wohnungen in Mars (16), Mond (4) und Phobos (4) kosten 200 Cr je 30 Tage. Bisher waren sie kostenfrei. Die erste Miete wird nach einer Woche fällig.
- **Konsumsteuer 19 % (A3)** für Mond, Mars, Phobos und Deimos. Gelesen als Teil derselben Antwort („auch auf Miete“).
- **Mietsteuer 10 %** auf jede abgerechnete Miete, auch auf der Erde. Bei staatlichen Vermietern fließt sie in dieselbe Kasse zurück; spürbar wird sie bei privaten Vermietern.
- **Ertrag der Mieten:** etwa 750 Cr je Woche auf dem Mars, je etwa 190 Cr auf Mond und Phobos.
- **Nicht geändert:** Die kostenfreien Wohnungen auf der Erde (15) bleiben, bis Thomas anders entscheidet.

## Entschieden (06.11.2026, zweite Runde) – live seit 06.11.2026

- **Frage 1 – Förderabgabe:** „ein flexibler Wert, vielleicht entscheiden manche Orte später anders.“
  - `colony_settings.extraction_tax_rate` je Ort, Start 15 %.
  - Gebucht mit dem Erlös der Anlage als Transfer Firma → öffentliche Kasse (`lib/game/tick.ts` 3.12.0).
- **Frage 3 – Bedienung:** „ja, wobei man statt Menschen auch Roboter kaufen kann, jeder muss selbst entscheiden, was sich mehr lohnt.“
  - Eisbohrer (je 4), Recycler und Gruben brauchen einen Menschen oder einen Roboter. Unbedient stehen sie still – ab Tick 2968, also mit einer Woche Vorlauf, für Anlagen von Firmen.
  - Roboter: 4 000 Cr Kauf, 25 Cr Wartung je Tag, beides an die Werkstatt der Siedlung (öffentliche Kasse).
  - Firmen rechnen über 60 Tage. Bei 75 Cr Lohn ist der Mensch billiger (4 500 gegen 5 500 Cr). Findet sich 7 Tage niemand, kaufen sie einen Roboter.
  - Datenkorrektur: Firmenanlagen nicht mehr als Spielereigentum geführt.
  - Gebaut: `lib/game/economy/facilityOperation.ts`, Migration `20261106020000_extraction_tax_and_facility_operation.sql`.
- **Frage 5 und Miete:** „Wohnungen sollten Miete kosten, die Höhe richtet sich nach dem Kaufpreis des Gebäudes. Bei privaten Objekten legt der Besitzer das fest.“ Dazu die Auswahl „Habitate teurer“.
  - Mietsatz je Ort `colony_settings.rent_yield_30d`, Start 11 % des Kaufpreises je Wohnung und 30 Tage.
  - Habitate kosten 16 000 Cr statt 2 000 Cr, also rund 220 Cr Miete je Wohnung.
  - Die kostenfreien Wohnungen der Erde werden vermietet, mit einer Woche Vorlauf.
  - Private Besitzer setzen die Miete selbst (`app/api/game/dwelling-rent`, `noxia_set_dwelling_rent`).
  - Migration `20261106030000_rent_from_purchase_price.sql`.
- **Noch offen:** Spieler-Anlagen (Wahl Mensch/Roboter im Spiel) und eine Oberfläche, in der Besitzer die Miete setzen.

## Entschieden (06.11.2026, dritte Runde) – live seit 06.11.2026

Thomas: „Ich denke 4 ist wichtig, damit dann auch 1 gelöst werden kann – wenn kein Käufer für Wasser da ist, kauft niemand und es gibt kein Geld.“ Auf den Vorschlag (Linienfracht, Anlaufhilfe, danach Wasser): „Ja mach das“.

- **Frage 7 – Linienfracht:** Epona Fracht fährt jede Woche, auch ohne Handelsware.
  - Montags gegen Mittag von der Erde zu Mond (2 h), Mars (61 h) und Phobos (62 h); donnerstags zurück.
  - Tabelle `liner_routes` (Abfahrtsstunde in der Woche, Dauer), Funktion `run_liner_sailings`. Die Fahrt ist eine echte Sendung (`npc_shipments.service = 'liner'`, Menge 0).
  - Crew geht mit an Bord; mit jeder Ankunft von der Erde kann eine Person zuziehen.
  - Zugezogene zahlen 100 Cr Ticket an Epona (Transfer).
  - Zuzug nimmt jetzt die günstigste Stelle bei einem Arbeitgeber, der zahlen kann. Vorher versperrte die leere öffentliche Kasse des Mondes die vier freien Stellen an Boanns Eisbohrern (im Rollback-Test kam die erste Person genau dorthin).
  - Noch nicht gebucht: Energie für die Fahrt. Die Linie kostet Epona bisher nur die Heuer.
  - Migration `20261106140000_weekly_liner_sailings.sql`.
- **Frage 4 – Anlaufhilfe (C):** wie vorgeschlagen, ohne die Erde.
  - `colony_fund` (Beginn Tick 2815, 8 Wochen, Obergrenze Mars 25 500, Mond 9 200, Phobos 3 300 Cr) und `colony_fund_payments` (eine Zeile je Woche, auch bei 0).
  - `run_colony_fund` läuft jeden Tick und zahlt höchstens einmal je Woche, vor dem Zuzug.
  - Gemessen beim Test für Woche 1: Mars Bedarf 7 980, Einnahmen 1 187, Zahlung 6 793 Cr; Mond 2 135 / 140 / 1 995; Phobos 945 / 142 / 803.
  - Beleg `bootstrap:colony-fund:<ort>:<woche>`, Emittent Koloniegründungsfonds der Solar Central Bank.
  - Migration `20261106150000_colony_fund.sql`.

## Teil D – neu gerechnet (06.11.2026)

- Boann bekam in der letzten Woche 15 364 Cr für 334 t Wasser vom Mars-Recycler gutgeschrieben, ohne Zahler. Auch Verkäufe der Handelsfirma an einen Ort werden gutgeschrieben, ohne dass jemand zahlt.
- Wollte die Kolonie alles verbrauchte Wasser zum Marktpreis kaufen, kostete das je Woche: Mars 54 096 Cr, Mond 32 760 Cr, Phobos 7 392 Cr.
- Dagegen stehen auf dem Mars 16 Menschen mit eigenem Konto bei 651 Einwohnern. Je Kopf sind es etwa 12 Cr am Tag – für jemanden mit Lohn tragbar. Die übrigen 635 Einwohner haben aber kein Konto, also gibt es für ihren Anteil keinen Zahler.
- Weg 2 („die Kolonie kauft“) ist darum so nicht machbar. Vorschlag in der Antwort an Thomas: Wer ein Konto hat, zahlt seinen Anteil selbst (Transfer). Der Anteil der Einwohner ohne Konto wird als Emission „Haushalte ohne Konto“ ausgewiesen, mit Obergrenze je Woche.

## Entschieden (06.11.2026) – Teil D „Teilen nach Konto“, live seit 07.11.2026

- **Regel:** Was Firmen ins Lager eines Ortes liefern (`produce`, `sell`), bezahlen die Einwohner nach Köpfen, einmal am Tag (`run_supply_settlement`).
  - Wer ein Konto hat, zahlt seinen Anteil selbst, höchstens sein Guthaben. Das ist ein Transfer.
  - Den Anteil der Einwohner ohne Konto zahlt die Versorgungskasse des Ortes aus ausgewiesener Emission (`bootstrap:supply-households:<ort>:<tick>`).
  - Obergrenze der Emission ist das, was die Einwohner ohne Konto in der Zeit wirklich verbrauchen. Was darüber geliefert wird, kauft niemand – die Firmen geben es zurück (`supply-unpaid`).
- **Test (Rollback, Mars, ein Tag):**
  - offen 2 116 Cr;
  - 654 Einwohner, davon 16 mit Konto;
  - je Kopf 3 Cr, also 48 Cr von Figuren;
  - 2 068 Cr Emission, Obergrenze 7 538 Cr, zurück 0.
- **Was das heißt:**
  - Die Geldmenge wächst weiter um rund 14 500 Cr je Woche, ist jetzt aber belegt und durch den Verbrauch gedeckelt.
  - Sie schrumpft in dem Maß, wie mehr Einwohner ein Konto haben – also mit dem Zuzug.
- **Offen:**
  - Spieler zahlen noch nicht mit.
  - Gutschriften vor dem 07.11.2026 bleiben, wie sie sind.
  - Tabellen `supply_settlements` und `supply_household_actors`, Migration `20261107010000_supply_paid_by_households.sql`.

## Nachtrag zum Befund (06.11.2026)

- **Die Erde gerät selbst ins Minus.** In der letzten Woche nahm ihre öffentliche Kasse 786 Cr ein und zahlte 9 955 Cr Lohn. Die Kasse fiel von 20 500 auf 11 357 Cr; in etwa neun Tagen ist sie leer. Ein Fiskaltransfer von der Erde in die Kolonien (Frage 4, zweite Möglichkeit) scheidet damit aus. Die Erde braucht selbst eine Antwort.
- **Seit 13 Tagen läuft keine Fracht aus.** Die letzte Abfahrt war Tick 2479. Mitflug und Zuzug warten deshalb; bisher hat niemand angeheuert, und keine Fracht wurde für den Zuzug geprüft.

## Entscheidungsfragen an Thomas

1. ~~Förderabgabe (A1)~~ – **entschieden 06.11.2026:** je Ort einstellbar, Start 15 %.
2. ~~Miete in staatlichen Wohnungen (A2) und Konsumsteuer 19 % (A3)~~ – **entschieden 06.11.2026**, dazu Mietsteuer 10 %.
3. ~~Private Stellen an Förderanlagen (B1/B2)~~ – **entschieden 06.11.2026:** Mensch oder Roboter, der Eigentümer entscheidet.
4. ~~Anlaufhilfe (C)~~ – **entschieden 06.11.2026:** wie vorgeschlagen, ohne die Erde. Ursprünglich: ja? Höhe und Dauer wie vorgeschlagen? Emittent Solar Central Bank – die Kasse der Erde kommt nicht mehr in Frage (Nachtrag). Und: Soll die Anlaufhilfe auch die Erde einschließen?
5. ~~Wasser ohne Käufer (D)~~ – **entschieden 06.11.2026:** Teilen nach Konto (siehe oben).
6. ~~Kostenfreie Wohnungen auf der Erde~~ – **entschieden 06.11.2026:** Miete nach Kaufpreis, private Besitzer legen sie fest.
7. ~~Frachten~~ – **entschieden 06.11.2026:** Linienfracht jede Woche. Ursprünglich: Die Handelsfirma liefert seit 13 Tagen nichts. Soll ich klären, warum, und eine Mindestverbindung vorschlagen (zum Beispiel eine Fracht je Woche zu Mond und Mars)? Daran hängen Mitflug und Zuzug.

## Umsetzung nach Freigabe

Je Teil eine Migration (zuerst im Rollback-Block getestet), danach Auswertung in der täglichen Analyse:
- A1: Abgabe in der Buchung des Erlöses (`lib/game/tick.ts`, `produce`) als zweite Zeile: Firma −, öffentliche Kasse +.
- A2: Mietverträge für die Bewohner staatlicher Habitate (`person_tenancies`, Vermieter öffentlicher Akteur).
- A3: `colony_settings.tax_transaction` = 0,19 für Mond, Mars, Phobos.
- B1/B2: `building_staff_roles` und `staff_capacity` für `ice_drill` (1 je 4) und `water_recycler`, `owner_class` korrigieren. Der Zuzug nimmt die Stellen automatisch.
- C: `run_colony_fund_weekly` mit Obergrenze je Ort, Beleg je Woche.
- D Weg 1: `produce`-Gutschrift mit Beleg `emission:supply:<ort>`, Obergrenze je Woche.
