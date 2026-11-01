# NOXIA-FIN-0002 – Haushalt der Kolonien

Status: **proposed** – Entscheidung Thomas offen
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

## Entscheidungsfragen an Thomas

1. **Förderabgabe (A1):** ja? Satz 15 % oder anders?
2. **Miete in staatlichen Wohnungen (A2)** und **Konsumsteuer 19 % (A3)** in den Kolonien: ja?
3. **Private Stellen an Förderanlagen (B1)** und **Datenkorrektur (B2):** ja?
4. **Anlaufhilfe (C):** ja? Höhe und Dauer wie vorgeschlagen? Emittent Solar Central Bank, oder lieber die Kasse der Erde als Fiskaltransfer (sie hat 20 500 Cr, ist aber selbst aus Reserven gespeist)?
5. **Wasser ohne Käufer (D):** zuerst ausweisen (Weg 1)?

## Umsetzung nach Freigabe

Je Teil eine Migration (zuerst im Rollback-Block getestet), danach Auswertung in der täglichen Analyse:
- A1: Abgabe in der Buchung des Erlöses (`lib/game/tick.ts`, `produce`) als zweite Zeile: Firma −, öffentliche Kasse +.
- A2: Mietverträge für die Bewohner staatlicher Habitate (`person_tenancies`, Vermieter öffentlicher Akteur).
- A3: `colony_settings.tax_transaction` = 0,19 für Mond, Mars, Phobos.
- B1/B2: `building_staff_roles` und `staff_capacity` für `ice_drill` (1 je 4) und `water_recycler`, `owner_class` korrigieren. Der Zuzug nimmt die Stellen automatisch.
- C: `run_colony_fund_weekly` mit Obergrenze je Ort, Beleg je Woche.
- D Weg 1: `produce`-Gutschrift mit Beleg `emission:supply:<ort>`, Obergrenze je Woche.
