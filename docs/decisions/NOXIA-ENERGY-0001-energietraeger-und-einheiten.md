# NOXIA-ENERGY-0001 – Strom, Energieträger und Einheiten

Status: Richtung akzeptiert (10.10.2026); Zahlen vorläufig bis zur Kanonisierung
Version: 0.2 (10.10.2026) – Entscheidungen, Kanon-Abgleich und geprüfte Kennzahlen eingearbeitet
Ergänzt: `docs/gameplay/NOXIA-RESOURCE-0001.md` (Ressourcenontologie)
Baut auf: `lib/game/seeds/tharsisHubPowerModel.ts`, `lib/game/vehicles/types.ts`, `docs/core/REACTOR_RUNTIME_E2A.md`
Belege: `docs/research/energy-canon-check-2026-10-10.md`, `docs/research/energy-parameters-and-sf-2026-10-10.md`

Dieses Dokument legt die Richtung fest. Es ändert noch kein Verhalten der Simulation.

## Ausgangslage

„Energie" ist heute ein Gut in Tonnen (`resource_type = 'energy'`). Solarfelder und Reaktoren erzeugen es,
Kolonien verbrauchen es, Schiffe laden es als Fracht und verbrennen es beim Flug. Damit sind drei
physikalisch verschiedene Dinge in einer Zahl vermischt:

- **Strom** hat keine Masse, lässt sich nicht in einen Frachtraum laden und nur begrenzt speichern.
- **Energieträger** (Akkupacks, Brennstäbe, chemischer Treibstoff) haben Masse, werden gelagert,
  transportiert und gehandelt.
- **Reaktionsmasse** ist das, was ein Antrieb ausstößt. Bei chemischen Antrieben ist sie zugleich der
  Energieträger; bei nuklearen und elektrischen Antrieben ist sie ein anderer Stoff als die Energiequelle.

## Grundsatz

> **Energie ist kein Gut. Energie ist eine Eigenschaft von Trägern – und Strom ist ein Fluss, kein Bestand.**

1. **Strom wird in MW (Leistung) und MWh (Arbeit) gerechnet.** Er existiert nur im Netz eines Ortes.
2. **Energieträger und Reaktionsmasse sind Handelsgüter in Tonnen, Kilogramm oder Stück** mit festen
   physikalischen Eigenschaften.
3. **Jeder Übergang zwischen Strom und Träger ist eine Umwandlung in einem Gebäude** mit Wirkungsgrad
   kleiner als 1.
4. **„Woher kommt die Energie?" und „Was erzeugt den Schub?" sind getrennte Fragen** und getrennte Felder.

Flüssigkeiten und Gase werden in **Masse** geführt, nicht in Volumen. Für Strom gilt **MWh statt kWh**;
das entspricht den Einheiten des Kanons (MW, MWh). Solange ein Tick eine Spielstunde ist, liefert eine
Anlage mit 4 MW genau 4 MWh je Tick.

## Entscheidungen vom 10.10.2026

| Frage | Entscheidung |
|---|---|
| Energiekanon um 2100 | Solarenergie und Kernspaltung sind etablierte Quellen. Fusion und X-Technologie gelten nur entsprechend ihrer Entwicklungsstufe. |
| Alte Energiebestände | Erhalten, gesondert bilanzieren und den künstlichen Überhang transparent bereinigen. |
| Treibstoffarten | Für Spieler zunächst ein Begriff „Treibstoff (t)"; intern von Anfang an ein Treibstofftyp. |
| SF-Recherche | Parallel durchgeführt; übernommen werden Konsequenzen, keine Leistungswerte. |

## Abgleich mit dem Kanon

Der Abgleich steht ausführlich in `docs/research/energy-canon-check-2026-10-10.md`. Das Wesentliche:

- **Bestätigt:** Auf dem Mars trägt Kernspaltung die Grundlast, Solar ist Ergänzung. Tharsis Hub hat sechs
  Reaktormodule in drei Erzeugungsdomänen, 7–8 MW installiert und 6–10 MWh Schwarzstart-Speicher. Der
  Kanon rechnet in MW und MWh.
- **Bestätigt:** Fusion ist 2091 nur Labor und als Kraftwerk nirgends vorausgesetzt. Fusionsantriebe
  beginnen 2110. X-Technologie ist um 2150 real, aber knapp; ihre Physik ist nicht definiert.
- **Wichtig für Schiffe:** Chemische Antriebe sind laut Kanon ab 2055 nur noch für Oberflächen üblich.
  Zwischen den Welten fliegen nuklearthermische Antriebe (Reaktionsmasse Wasserstoff) und Plasmaantriebe
  (Argon oder Wasserstoff). Was ein Frachter „tankt", ist dort Reaktionsmasse, nicht Brennstoff.
- **Treibstoffe im Kanon:** Methan/Sauerstoff auf dem Mars (Sabatier, 2091 rund 400 t im Jahr),
  Wasserstoff/Sauerstoff im Erde-Mond-Raum. „Wer H₂ kontrolliert, kontrolliert die Routen."

Drei Stellen im Spiel widersprechen dem Kanon und brauchen eine Entscheidung (siehe unten):
das Stationsmodul „Fusionsreaktor", Belenus AG als Solarstrom-Verkäufer auf dem Mars und die frühere
Annahme, HeliosCorp sei ein Solarkonzern.

## Die Güter

### Strom (kein Handelsgut)

- Einheit: MW und MWh. Bestand gibt es nur als Ladezustand von Speichern.
- Erzeugung: Reaktormodul (Grundlast), Solarfeld (ortsabhängig, auf dem Mars mit Faktor 0,43 gegenüber der
  Erde und mit Staubsturm-Ereignissen).
- Verbrauch: konkrete Anlagen nach Lastprofil (Tharsis-Modell), nicht „je 100 Einwohner".
- Speicher: Batteriespeicher mit Kapazität in MWh.
- **Überschuss entsteht nicht:** Was weder verbraucht noch gespeichert wird, wird nicht erzeugt.
- **Mangel wird nach Lastklassen abgeworfen** (C vor B vor A). Erst wenn Klasse A nicht gedeckt ist, gilt
  ein Ort als unversorgt.

### Treibstoff (Anzeige: „Treibstoff (t)")

- Einheit: t. Handelbar, lagerbar in Tanks, Fracht für Schiffe.
- Intern mit Treibstofftyp, zunächst zwei:
  - **Methan/Sauerstoff** – Mars, aus Wasser und dem CO₂ der Atmosphäre.
  - **Wasserstoff/Sauerstoff** – Erde-Mond-Raum; auf dem Mond zunächst importiert, später aus Wassereis.
- Herstellung in einer Treibstoffanlage: Wasser + Strom → Treibstoff.
- **Treibstoff ist kein Stromspeicher.** Sein Wert ist Schub (siehe Kennzahlen).

### Reaktionsmasse

- Eigenes Feld am Antrieb, getrennt von der Energiequelle (`reaction-mass` existiert bereits im
  Fahrzeugmodell). Wasserstoff für nuklearthermische, Argon oder Xenon für elektrische Antriebe.
- Solange Schiffe im Spiel nur einen Tankwert haben, bleibt das ein internes Feld ohne eigene Anzeige.

### Akkupack

- Einheit: t. Als zwei Güter geführt: **geladen** und **leer**. Laden kostet Strom, die Masse bleibt gleich.
- Für Fahrzeuge, Rover, Notstrom und netzlose Orte – nicht für den Energiehandel zwischen Welten.

### Brennelement

- Einheit: kg. Wird im Reaktormodul über Jahre verbraucht; es bleibt „abgebrannt" zurück.
- Der Kanon schweigt zu Reaktortyp und Brennstoffkreislauf. Bis dahin vorläufig.

### Später

Helium-3 (bereits Material in RESOURCE-0001), Fusion, Strahlungsübertragung und X-Technologie fügen sich
als weitere Träger oder Umwandlungen ein, jeweils an ihre Entwicklungsstufe gebunden.

## Kennzahlen (vorläufig)

Quellen und Prüfstatus jeder Zahl stehen in `docs/research/energy-parameters-and-sf-2026-10-10.md`.
Gegenüber Version 0.1 sind drei Werte korrigiert.

| Größe | Wert | Änderung gegenüber 0.1 |
|---|---|---|
| Akkupack, raumfahrttauglich | 0,075–0,155 MWh/t | vorher 0,2 – das war der Zellwert, nicht der Pack |
| Methan/Sauerstoff-Gemisch, chemisch | rund 2,7 MWh/t | vorher „rund 3" |
| Wasserstoff/Sauerstoff-Gemisch, chemisch | rund 3,6 MWh/t | neu |
| Strom je Tonne Treibstoff (Mars) | 13,6–20,2 MWh | unverändert, jetzt nachgerechnet |
| Wasser je Tonne Treibstoff (Mars) | 0,53 t | unverändert |
| Brennelement, nutzbarer Strom | rund 250–330 MWh je kg Brennelement | vorher 1.000.000 MWh thermisch je Tonne Schwermetall |
| Kleiner Raumreaktor, nutzbarer Strom | rund 4 MWh je kg Kern | neu |
| Brennstoffzelle | rund 55 % | neu |
| Speicherung über Wasserstoff, hin und zurück | 30–40 % | neu |

Zu den Brennelementen: Der Abbrand von 45–60 GWd bezieht sich auf die Tonne Schwermetall, nicht auf das
ganze Brennelement mit Hüllrohren, und er ist thermische Energie. Erst mit Wirkungsgrad (rund 0,33) und
Schwermetallanteil (rund 0,70) ergibt sich der nutzbare Strom.

### Größenordnungen im Vergleich

Bezugsgröße ist die Normallast von Tharsis Hub (4 MW, also rund 96 MWh je Tag).

| 100 t Fracht | Energieinhalt | Als Strom nutzbar | Versorgt Tharsis für |
|---|---:|---:|---|
| Akkupacks | 7,5–15,5 MWh | fast vollständig | 2–4 Stunden |
| Treibstoff Methan/Sauerstoff | 270 MWh chemisch | rund 150 MWh über Brennstoffzelle | rund 37 Stunden |
| Brennelemente | – | rund 25–33 Millionen MWh | Jahrhunderte |

Die Treibstoffzeile ist eine Modellrechnung. Sie zeigt zugleich, warum das niemand tut: Die Herstellung
dieser 100 t kostet 1.360–2.020 MWh Strom, zurück kommen rund 150.

## Prüfregeln

1. **Energieerhaltung:** Abgegebene Energie ≤ aufgenommene Energie × Wirkungsgrad, Wirkungsgrad < 1.
2. **Massenerhaltung:** Masse der Ausgangsstoffe = Masse der Erzeugnisse.
3. **Kein Strom im Frachtraum:** Kein Lager, kein Frachtraum und kein Markt führt Strom als Menge.
4. **Kein Bestand ohne Speicher:** Gespeicherter Strom ≤ Summe der Speicherkapazitäten.
5. **Ableitung statt Zustand:** Erzeugung, Last und Kapazität ergeben sich aus den Gebäuden.
6. **Technologie nur in ihrer Epoche:** Keine Anlage und kein Antrieb vor seiner kanonischen
   Entwicklungsstufe.

## Zustand und Protokoll des Stromnetzes

- Je Ort gibt es eine abgeleitete Sicht (Erzeugung, Last, Speicherkapazität) und einen gespeicherten
  Wert: den Ladezustand.
- **Netzereignisse stehen in einem kompakten Ereignisprotokoll:** Lastabwurf einer Klasse, Ausfall oder
  Drosselung eines Reaktors, leerer Speicher, Wiederherstellung. Geschrieben wird nur bei
  Zustandswechsel, nicht je Tick. So bleiben Ausfälle und ihre gesellschaftlichen Folgen
  untersuchbar, ohne redundante Tick-Datensätze.
- Der vorhandene Weg `simulation_events → entity_states` (Reaktor-Betriebszustand, E2a) ist dafür der
  naheliegende Ort.

## Umgang mit den Altbeständen

- **Schiffsladungen** (heute 122 t in sechs Schiffen) gelten 1 : 1 als Treibstoff. Kein Schiff wird
  flugunfähig.
- **Ortsbestände** werden als Altbestand erfasst: Herkunft, Menge, ursprünglicher Wert, Migrationsgrund.
  Überzählige Mengen werden nicht als physisch vorhandener Treibstoff anerkannt.
- **Die Korrektur** wird später als eigene Buchungsart „Modellbereinigung" ausgewiesen, getrennt von
  Verbrauch, Handel und Verlust. Weder die Wirtschaftsgeschichte noch die Beobachtung des neuen Systems
  werden verfälscht.

## Reihenfolge

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | Kanon-Abgleich | erledigt, siehe Belegdokument |
| 2 | Kennzahlen mit Quellen und Unsicherheiten | erledigt, siehe Belegdokument; Kanonisierung offen |
| 3 | Anzeige vorbereiten | vorbereitet: Name und Symbol des Guts stehen an einer Stelle (`lib/constants.ts`) |
| 4 | Stromnetz als Schattenmodell: Versorgung, Speicher und Lastabwurf je Ort berechnen, ohne Eingriff in die Wirtschaft | offen |
| 5 | Vergleichsläufe über mehrere simulierte Wochen: Treibstoff, Wasser, Preise, Produktion, Infrastrukturkosten | offen |
| 6 | Umstellung: Solarfeld und Reaktor liefern Leistung statt Tonnen; Treibstoffanlage; Altbestände | offen, braucht Migrationen |

Zu Schritt 3: Die Umbenennung für Spieler wird mit Schritt 6 zusammen geschaltet, nicht vorher. Solange
Solarfelder das Gut in Tonnen erzeugen, stünde sonst „Solarfeld: +4 Treibstoff je Tick" im Baumenü.
Der Schalter ist eine Zeile.

## Offene Entscheidungen

1. **Epoche des Spiels und Antriebsstufe der Frachter:** Die Erdkarte nennt 2086. Laut Kanon fliegen
   zwischen den Welten dann nuklearthermische und Plasmaantriebe; 2087 stoppt die „Große Stille" die
   nuklearthermische Flotte. Was tanken die Frachter des Spiels – Wasserstoff als Reaktionsmasse?
2. **Stationsmodul „Fusionsreaktor"** (+20 Energie je Tick): entfernen, umbenennen oder an eine spätere
   Epoche binden? OTA hat dazu bereits eine Entscheidung angefordert.
3. **Belenus AG** verkauft Solarstrom auf dem Mars, wo Solar laut Kanon nur Ergänzung ist. Wird Belenus
   Betreiber von Reaktormodulen, Ergänzungsversorger, oder zieht die Firma um?
4. **Leistung der vorhandenen Anlagen:** Im Spiel stehen „Solarfeld 4, Reaktormodul 8" in Tonnen je Tick,
   im Kanon-Seed 1,25 MW je Reaktormodul.
5. **Reaktortyp und Brennstoffkreislauf:** Der Kanon schweigt. Ohne Festlegung bleiben Brennelemente
   vorläufig.
