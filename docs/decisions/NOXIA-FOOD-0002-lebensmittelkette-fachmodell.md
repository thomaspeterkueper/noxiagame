# NOXIA-FOOD-0002 – Lebensmittelkette als ortsunabhängiges Fachmodell

Status: accepted (Thomas, 27.10.2026) – verbindliche Grundlage für den Pilot Seelenberg; Core-Anbindung offen
Datum: 2026-10-27
Bezug: NOXIA-FOOD-0001 (Lebensmittel als Ware), Pilot Seelenberg (`docs/pilots/seelenberg-living-systems-v1.md` auf `feat/seelenberg-living-systems-pilot`, PR #526), NOXIA-SCHOOL-0001 (Backen, Kochen, Gärtnern als Kompetenzen), NOXIA-ENERGY-0001 (Strom in MWh), `docs/core/RESOURCE_INVENTORY_ECONOMY_MAP.md`

## Auftrag

Aus dem Pilot Seelenberg (Schmitten im Taunus): die Lebensmittelkette so strukturieren, dass sie unabhängig vom Ort funktioniert – mit Eingangs- und Ausgangsgütern, Mengenverhältnissen, Produktionszeiten, Strom- und Wasserbedarf, Lagerfähigkeit und Engpässen. Seelenberg ist Testgebiet, nicht Definition. Kein paralleler Produktions- oder Inventarzustand.

## Grundsatz

- **Ein Katalog, viele Orte.** Verfahren tragen die Umgebungen, in denen sie möglich sind (`earth_open`, `earth_indoor`, `habitat`). Sundern, Seelenberg und Frankfurt nutzen Feld, Mühle, Bäckerei; Mars und Stationen nutzen Hydroponik und dieselbe Mühle und Bäckerei.
- **Kein Gut ohne Eingänge.** Ein Verfahren läuft nur so oft, wie alle Eingänge im Bestand liegen und die Arbeitszeit reicht. Was fehlt, wird als Engpass benannt (`limitedBy`: ein Gut, `labor` oder `season`).
- **Der Core führt den Zustand.** Das Modell rechnet Mengen; Bestände, Lager, Fracht und Tick bleiben im Core. Transport ist für das Modell nur eine Lieferzeit, die Route rechnet das Erdmodell des Ortes.
- **Verderb gehört zur Ware.** Jedes Gut hat eine Haltbarkeit; Brot zählt in Tagen, Mehl in Monaten, Salz nie.
- **Satt wird man von Kalorien, nicht von Tonnen.** Haushalte brauchen 2 200 kcal je Person und Tag; jedes essbare Gut trägt seinen Nährwert bei. Damit zählen Brot, Kartoffeln, Gemüse und die bestehende Grundnahrung (`food`) gleich, und Abwechslung wird messbar.

## Güter (vorläufige Parameter)

| Gut | Einheit | Haltbarkeit | Lagerung | kcal/kg |
|---|---|---|---|---|
| Getreide | kg | 365 Tage | trocken | – |
| Mehl | kg | 180 Tage | trocken | – |
| Kleie (Nebenprodukt) | kg | 90 Tage | trocken | – |
| Brot | kg | 4 Tage | trocken | 2 500 |
| Kartoffeln | kg | 150 Tage | kühl | 770 |
| Gemüse | kg | 10 Tage | kühl | 300 |
| Salz | kg | unbegrenzt | trocken | – |
| Hefe | kg | 14 Tage | kühl | – |
| Saatgut | kg | 365 Tage | trocken | – |
| Wasser | kg | unbegrenzt | Tank | – |
| Strom | MWh | – | Netz | – |
| Grundnahrung (`food`, Bestand) | kg | 365 Tage | trocken | 2 000 |

## Verfahren (je Charge)

| Verfahren | Umgebung | Eingang | Ausgang | Dauer | Arbeit |
|---|---|---|---|---|---|
| Weizenernte, 1 ha | Feld (Erde) | 180 kg Saatgut, 0,3 MWh | 7 500 kg Getreide | 6 h, nur Juli–August | 10 h `farming` |
| Kartoffelernte, 1 ha | Feld (Erde) | 2 500 kg Pflanzkartoffeln, 0,5 MWh | 40 000 kg Kartoffeln | 10 h, nur Sept.–Okt. | 30 h `farming` |
| Mahlen | überall | 1 000 kg Getreide, 0,04 MWh | 750 kg Mehl, 250 kg Kleie | 2 h | 2 h `milling` |
| Backen | überall | 100 kg Mehl, 62 kg Wasser, 2 kg Salz, 2 kg Hefe, 0,05 MWh | 150 kg Brot | 4 h | 8 h `baking` |
| Hydroponik, Modul/Tag | Innenraum, Habitat | 20 kg Wasser, 0,15 MWh | 10 kg Gemüse | 24 h | 1 h `gardening` |

Daraus folgt beispielsweise: 150 kg Brot brauchen 100 kg Mehl, also 133 kg Getreide; ein Dorf mit 554 Personen, das 30 % seiner Kalorien aus Brot deckt, braucht rund 146 kg Brot, 98 kg Mehl und 130 kg Getreide am Tag.

## Engpässe, die das Modell kennt

- Eingang fehlt (Mehl in der Bäckerei, Getreide in der Mühle) – Verfahren läuft weniger oft oder gar nicht.
- Arbeitszeit fehlt – Kompetenzen und Personal aus NOXIA-SCHOOL-0001 werden zur Produktionsgrenze.
- Saison – Felder ernten nur in ihren Monaten; dazwischen trägt der Speicher.
- Lieferzeit – eine gesperrte Straße verlängert die Lieferzeit, die Ware bleibt unterwegs (keine Teleportation).
- Verderb – zu viel Brot verdirbt, zu wenig Lager vernichtet Vorrat.

## Nachweis (`lib/game/food/chain.test.ts`, `pnpm test:food-chain`)

Kette Speicher → Mühle → Bäckerei → Laden → Haushalte, Tag für Tag, deterministisch:

1. **Normalbetrieb:** 60 Tage ohne Fehlmenge; sinkende Bestände lösen Bestellungen die Kette hinauf aus; kein Bestand wird negativ.
2. **Straße gesperrt:** Strecke Mühle → Bäckerei an Tag 8–20 sechs Tage länger. Die Bäckerei meldet Mehl als Engpass, ab Tag 12 fehlt Brot, neue Bestellungen entstehen, nach der Öffnung erholt sich die Versorgung.
3. **Leerer Speicher:** fehlendes Getreide wird gemeldet, Brot geht aus.
4. **Massenbilanz:** Getreide + Mehl + Kleie + Brot (in Getreideäquivalent, inklusive gegessen und verdorben) bleibt in jedem Lauf erhalten – auch während Ware unterwegs ist.

Das entspricht den drei Pilot-Tests (Normalbetrieb, blockierte Straße, Zusatznachfrage über `persons`) und der Invariante „genau ein Buchungsort“.

## Was der Core dafür braucht (Requests)

| Request | Inhalt |
|---|---|
| `coordination/open/20261027-0930-core-to-core-production-input-gating.md` | Gebäude produzieren im Tick nur, wenn ihre Eingänge im Bestand liegen; Engpass wird gespeichert. Heute entsteht Ware auch ohne Eingang. |
| `coordination/open/20261027-0931-core-to-core-food-chain-goods-spoilage-kcal.md` | Neue Güter der Kette, Einheit kg für Lebensmittel, Haltbarkeit und Nährwert je Gut, Verbrauch der Haushalte nach Kalorien. |
| `coordination/open/20261027-0932-core-to-kg-food-chain-parameters.md` | Kanonische Werte (Ausbeuten, Energie, Haltbarkeit, Nährwerte) aus dem Knowledge Graph statt vorläufiger Zahlen. |

## Schnittstelle für den Pilot Seelenberg

- Verfahren je Ort: `processesFor('earth_open')`.
- Lieferzeiten kommen aus der Routenplanung des Pilots (`ChainConfig.leadDays`, Störungen als `Disruption`).
- Für den Live-Betrieb liegt die Kette im Core (Requests oben); das Fachmodell bleibt die gemeinsame Rechenregel und Testgrundlage.
- Hinweis: Der Branch `feat/seelenberg-living-systems-pilot` ist hinter `main` (u. a. NOXIA-SCHOOL-0001 und NOXIA-FOOD-0001). Vor dem Merge auf aktuellen `main` bringen, damit diese Arbeiten nicht überschrieben werden.

## Entscheidungen (Thomas, 27.10.2026)

1. **Einheiten:** Fachmodell und Oberfläche in kg, große Mengen automatisch als t angezeigt (`formatMass`). Persistente Warenbuchungen in **ganzzahligen Gramm** (`toGrams`), damit Salz, Hefe und Teilchargen ohne Rundungsfehler laufen. Strom bleibt MWh; andere Güter werden nicht pauschal umgestellt.
2. **Verbindlich für Seelenberg:** Der Pilot verwendet dieses Fachmodell und entwickelt keine eigenen Produktionsrezepte (`docs/pilots/seelenberg-food-hospitality-integration.md` auf dem Pilot-Branch, Commit `38bda944`).
3. **Hospitality bleibt erhalten** und wird ein zweiter Verbraucher derselben Ware – kein zweites Warenwirtschaftssystem.

## Zwei Versorgungen aus einem Bestand

- **Haushalte:** Getreide → Mühle → Bäckerei → Handel → Haushalte.
- **Gastronomie:** Lokale, Kantine und Hotel ziehen aus demselben Ortsbestand. Ein Gericht ist eine Zutatenliste in Gramm je Portion (`DISH_INGREDIENTS_G`, Schlüssel sind die bestehenden Codes aus `npc_service_catalog` und `hospitality_menu`, z. B. `restaurant_main`: 300 g Kartoffeln, 200 g Gemüse, 80 g Brot).
- **Knappheit:** Regel `households_first` (Grundversorgung zuerst, Gastronomie bekommt den Rest) oder `proportional` (alle anteilig). Vorschlag: `households_first`.
- **Nachweis:** Fällt das Mehl aus, fehlt auch der Gaststätte Brot – erst nach der Sperrung, mit stimmender Massenbilanz.
- **Aktivierung:** Wirkung auf echte Lokale erst nach geprüfter Core-Integration.

## Branchstand Seelenberg (geprüft 27.10.2026)

Der Pilot-Branch ist 17 Commits vor und 49 hinter `main`, ändert 17 Dateien nur additiv (Pilot-Dokumente, `experiments/seelenberg/`). Ein Probe-Merge von `main` in den Pilot-Branch läuft ohne Konflikt.

## Offen für Thomas

1. Knappheitsregel: `households_first` (Vorschlag) oder `proportional`?
2. Weitere Ketten (Milch, Fleisch, Obst, Brauerei) erst nach dem Nachweis in Seelenberg?
