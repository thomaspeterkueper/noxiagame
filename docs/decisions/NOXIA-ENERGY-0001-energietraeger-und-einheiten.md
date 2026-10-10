# NOXIA-ENERGY-0001 – Strom, Energieträger und Einheiten

Status: proposed
Datum: 10.10.2026
Ergänzt: `docs/gameplay/NOXIA-RESOURCE-0001.md` (Ressourcenontologie)
Baut auf: `lib/game/seeds/tharsisHubPowerModel.ts`, `lib/game/vehicles/types.ts`, `docs/core/REACTOR_RUNTIME_E2A.md`

Dieses Dokument ist ein Vorschlag. Es ändert noch keinen Code und keine Daten.

## Ausgangslage

„Energie" ist heute ein Gut in Tonnen (`resource_type = 'energy'`). Solarfelder und Reaktoren erzeugen es,
Kolonien verbrauchen es, Schiffe laden es als Fracht und verbrennen es beim Flug. Damit sind zwei
physikalisch verschiedene Dinge in einer Zahl vermischt:

- **Strom** hat keine Masse, lässt sich nicht in einen Frachtraum laden und nur begrenzt speichern.
- **Energieträger** (Treibstoff, Akkupacks, Brennstäbe) haben Masse, werden gelagert, transportiert und gehandelt.

Folgen im Live-Stand (Tick 2135): 48.619 t „Energie" auf dem Mars bei 3 t Verbrauch je Tick, ein Preis am
Boden, und keine Möglichkeit, Fragen wie „reicht der Strom für die Elektrolyse?" überhaupt zu stellen.

Zwei Bausteine für die Lösung liegen bereits im Repository, sind aber nicht mit der Wirtschaft verbunden:

- Das Tharsis-Lastmodell rechnet in MW und MWh: 3–5 MW Normallast, 5–8 MW Spitzenlast, 7–8 MW
  installierte Leistung, 6–10 MWh Schwarzstart-Speicher, Lastklassen A/B/C mit Abwurfreihenfolge.
- Das Fahrzeugmodell kennt Energieträger (`electricity`, `chemical-fuel`, `hydrogen`, `methane`,
  `reaction-mass`) mit den Einheiten kWh, kg und t.

## Grundsatz

> **Energie ist kein Gut. Energie ist eine Eigenschaft von Trägern – und Strom ist ein Fluss, kein Bestand.**

Daraus folgen drei Regeln:

1. **Strom wird in MW (Leistung) und MWh (Arbeit) gerechnet.** Er existiert nur im Netz eines Ortes.
   Er steht nie in einem Frachtraum und nie auf einem Markt zwischen Welten.
2. **Energieträger sind Handelsgüter in Tonnen (oder Stück)** mit einem festen Energieinhalt je Einheit.
   Wer Energie transportieren will, transportiert einen Träger.
3. **Jeder Übergang zwischen Strom und Träger ist eine Umwandlung in einem Gebäude** mit Wirkungsgrad.
   Bei jeder Umwandlung geht Energie verloren, nie wird welche gewonnen.

Für die Einheit von Flüssigkeiten und Gasen gilt: **Masse (t), nicht Volumen.** Laderaum, Schub und
Treibstoffbedarf rechnen in der Raumfahrt in Masse; das Volumen hängt von Temperatur und Druck ab.
Volumen wird erst dann eine eigene Größe, wenn Tankgrößen eine Spielentscheidung werden sollen
(`volumeCapacityM3` ist im Fahrzeugmodell dafür schon vorgesehen).

Für Strom gilt **MWh statt kWh**: Die Größenordnung einer Kolonie sind Megawatt. Solange ein Tick eine
Spielstunde ist, liefert eine Anlage mit 4 MW genau 4 MWh je Tick – Leistung und Arbeit je Tick haben
dieselbe Zahl.

## Größenordnungen

Die Tabelle zeigt, warum die Träger sich im Spiel verschieden anfühlen müssen. Bezugsgröße ist die
Normallast von Tharsis Hub (4 MW, also rund 96 MWh je Tag).

| Träger | Energieinhalt | 100 t Fracht entsprechen | Versorgt Tharsis für |
|---|---:|---:|---|
| Akkupack (Lithium-Ionen) | 0,2 MWh/t | 20 MWh | rund 5 Stunden |
| Treibstoff Methan/Sauerstoff | rund 3 MWh/t chemisch | 300 MWh chemisch | rund 1,5 Tage (über Brennstoffzelle, ~50 %) |
| Brennstäbe (Spaltung) | rund 1.000.000 MWh/t thermisch | – | Jahrzehnte je Tonne |

Herkunft der Zahlen:

- **Akkupack:** 200 Wh/kg nennt die ESA als Stand raumfahrttauglicher Lithium-Ionen-Batterien; große
  regenerative Brennstoffzellen-Systeme sollen mehr als das Doppelte erreichen.
- **Treibstoff:** Lehrbuchwerte – Methan hat einen Heizwert von rund 13,9 kWh/kg; bei einem
  Mischungsverhältnis von etwa 3,6 Teilen Sauerstoff auf 1 Teil Methan ergibt das rund 3 kWh je kg
  Gemisch. Vor dem Festschreiben nachprüfen.
- **Brennstäbe:** Lehrbuchwert für üblichen Abbrand von rund 45 GWd je Tonne Schwermetall. Vor dem
  Festschreiben nachprüfen.

Zwei weitere Anker aus aktuellen Studien:

- **Reaktor:** NASAs Fission-Surface-Power-Projekt verlangt 40 kW elektrisch bei unter sechs Tonnen Masse
  und zehn Jahren Betrieb ohne Eingriff. Das ist ein Hundertstel der Tharsis-Normallast – ein Reaktormodul
  mit mehreren MW ist also eine deutlich spätere Technikgeneration als der heutige Stand.
- **Treibstoffherstellung auf dem Mars:** Eine NASA-Studie zur Betankung eines Aufstiegsfahrzeugs rechnet
  mit 29,7 t Methan und Sauerstoff aus 15,7 t Wasser in 480 Tagen Dauerbetrieb bei 35–52 kW. Daraus
  folgen (eigene Rechnung) **rund 14–20 MWh Strom je Tonne Treibstoff** und **rund 0,5 t Wasser je Tonne
  Treibstoff**; der Kohlenstoff kommt aus dem CO₂ der Marsatmosphäre.

Die Folgerung für das Spiel:

- **Akkupacks lohnen sich nicht für den Energiehandel zwischen Welten.** Sie sind der Träger für
  Fahrzeuge, Rover, Notstrom und Orte ohne eigenes Netz.
- **Treibstoff ist das Massengut der Energie.** Seine Herstellung ist ein großer Strom- und
  Wasserverbraucher – genau die reale Nachfrage, die der Wirtschaft heute fehlt.
- **Brennstäbe sind das hochwertige Energie-Handelsgut:** wenig Masse, sehr hoher Wert, wenige
  Hersteller, strenge Regeln.

## Die Güter

### Strom (kein Handelsgut)

- Einheit: MW und MWh. Bestand gibt es nur als Ladezustand von Speichern.
- Erzeugung: Solarfeld, Reaktormodul. Jede Anlage hat eine Nennleistung in MW.
- Verbrauch: konkrete Anlagen nach Lastprofil (Tharsis-Modell), nicht „je 100 Einwohner".
- Speicher: Batteriespeicher mit Kapazität in MWh.
- **Überschuss entsteht nicht:** Was weder verbraucht noch gespeichert wird, wird nicht erzeugt
  (Abregelung). Dafür ist kein Zustand nötig.
- **Mangel wird nach Lastklassen abgeworfen** (C vor B vor A). Erst wenn Klasse A nicht mehr gedeckt
  ist, gilt ein Ort als unversorgt. Die Reihenfolge existiert im Tharsis-Modell bereits.

### Treibstoff (`propellant`)

- Einheit: t. Handelbar, lagerbar in Tanks, Fracht für Schiffe.
- Übernimmt die heutige Rolle von „Energie" im Frachtraum: Schiffe verbrauchen ihn beim Flug.
- Herstellung: Wasser + Strom (+ CO₂ auf dem Mars) in einer Treibstoffanlage.
- Rückverstromung über Brennstoffzelle ist möglich, mit Verlust.

### Akkupack (`battery_pack`)

- Einheit: t, 0,2 MWh je Tonne. Als zwei Güter geführt: **geladen** und **leer**.
- Laden wandelt „leer" in „geladen" und kostet Strom; Entladen wandelt zurück. Die Masse bleibt gleich.
- Diese Form passt ohne Sonderlogik in die vorhandenen mengenbasierten Lager und Frachträume.

### Brennstab (`fuel_rod`)

- Einheit: kg oder Stück. Wird im Reaktormodul über lange Zeit verbraucht; es bleibt „abgebrannt" zurück.
- Erst sinnvoll, wenn Reaktoren mehr als eine Kulisse sind (Betriebszustand existiert seit E2a).

### Später

Helium-3 steht bereits als Material in RESOURCE-0001 („Fusionsbrenner, Mond-exklusiv"). Fusion,
Strahlungsübertragung und andere Technologien fügen sich als weitere Träger oder Umwandlungen ein, ohne
dass das Modell sich ändert: neuer Träger, Energieinhalt, Umwandlung, Wirkungsgrad.

## Prüfregeln

Jede Mechanik muss diese Prädikate erfüllen. Sie lassen sich als Tests schreiben.

1. **Energieerhaltung:** Bei jeder Umwandlung ist die abgegebene Energie höchstens die aufgenommene mal
   Wirkungsgrad, und der Wirkungsgrad ist kleiner als 1.
2. **Massenerhaltung:** Die Masse der Ausgangsstoffe einer Umwandlung entspricht der Masse der Erzeugnisse
   (Treibstoff aus Wasser und CO₂; Akkupack geladen und leer).
3. **Kein Strom im Frachtraum:** Kein Lager, kein Frachtraum und kein Markt führt Strom als Menge.
4. **Kein Bestand ohne Speicher:** Die gespeicherte Strommenge eines Ortes ist nie größer als die Summe
   seiner Speicherkapazitäten.
5. **Ableitung statt Zustand:** Erzeugungsleistung, Last und Speicherkapazität ergeben sich aus den
   vorhandenen Gebäuden. Gespeichert wird nur der Ladezustand.

## Rechenaufwand

- Das Stromnetz ist **eine Zeile je Ort**: Erzeugung, Last, Speicherkapazität (abgeleitet) und
  Ladezustand (gespeichert).
- Erzeugung, Last und Kapazität ändern sich nur, wenn sich Gebäude oder Betriebszustände ändern.
  Sie werden ereignisgesteuert neu berechnet, nicht in jedem Tick je Anlage.
- Der Tick aktualisiert je Ort nur den Ladezustand – im selben Schreibvorgang wie die Bestände, ohne
  zusätzliche Abfrage.

## Umgang mit den Altbeständen

Die heutigen „Energie"-Bestände sind Tonnen eines handelbaren Guts, das Schiffe laden. Sie entsprechen
also dem neuen Treibstoff, nicht dem Strom.

| Bestand | Vorschlag |
|---|---|
| Ladung „Energie" in Schiffen und beim Spediteur (heute 122 t in sechs Schiffen) | 1 : 1 zu Treibstoff |
| Ortsbestände bis zur Tankkapazität | 1 : 1 zu Treibstoff |
| Ortsbestände über der Tankkapazität (Mars: rund 48.000 t) | **Entscheidung nötig**, siehe unten |

Für den Überhang gibt es zwei ehrliche Wege:

- **A – stehen lassen:** Der Überhang bleibt als Treibstoff liegen und drückt den Preis auf Jahre.
- **B – einmalige, benannte Bestandsbereinigung:** Der Überhang wird in einem ausdrücklich gebuchten
  Vorgang ausgebucht, mit Begründung „Artefakt des alten Modells". Das entspricht dem Grundsatz, dass
  Sondervorgänge ausdrücklich benannt sein müssen, statt still zu geschehen.

## Reihenfolge

Jeder Schritt ist einzeln auslieferbar und einzeln messbar.

| Schritt | Inhalt | Migration |
|---|---|---|
| 1 | Anzeige: „Energie" heißt für Spieler „Treibstoff (t)". Technischer Bezeichner bleibt vorerst `energy`. Kein Verhalten ändert sich. | nein |
| 2 | Stromnetz je Ort in MW/MWh: Solarfeld und Reaktor liefern Leistung statt Tonnen, Verbrauch nach Lastprofil, Batteriespeicher in MWh, Lastabwurf nach Klassen. | ja |
| 3 | Treibstoffanlage: Wasser + Strom → Treibstoff. Erste reale Senke für Wasser und Strom. | ja |
| 4 | Umbenennung `energy` → `propellant` in Datenbank und Code (16 Tabellenspalten, 8 Funktionen, 37 Dateien). | ja |
| 5 | Akkupacks als Gut (geladen/leer) für Fahrzeuge und netzlose Orte. | ja |
| 6 | Brennstäbe und Brennstoffkreislauf des Reaktors. | ja |

Schritt 1 nimmt die größte Verwirrung sofort weg. Schritt 2 und 3 zusammen lösen das Überangebot an der
Wurzel. Schritt 4 ist reine Aufräumarbeit und kann warten.

Für Spieler bleibt die Oberfläche einfach (15-Minuten-Regel): sichtbar sind „Treibstoff: 57 t" und
„Strom: 3,2 von 4,0 MW". Alles Weitere ist Vertiefung auf Wunsch.

## Offene Entscheidungen

1. **Überhang der Altbestände:** Weg A (stehen lassen) oder Weg B (benannte Bereinigung)?
2. **Leistung der vorhandenen Anlagen:** Heute steht „Solarfeld 4, Reaktormodul 8" in Tonnen je Tick.
   Vorschlag: nicht einfach als MW übernehmen, sondern an das Tharsis-Modell anlehnen (7–8 MW
   installiert für den ganzen Hub).
3. **Welcher Treibstoff:** ein einheitliches Gut „Treibstoff", oder von Anfang an Methan/Sauerstoff
   (Mars) und Wasserstoff/Sauerstoff (Mond) getrennt? Vorschlag: zunächst ein Gut.
4. **Kanon:** Womit wird im NOX-Universum um 2100 Energie erzeugt und transportiert (OTA-Dokumente,
   Buch)? Der Name HeliosCorp deutet auf Solar. Der Kanon geht vor diesem Vorschlag.

## Quellen

Geprüft für diesen Vorschlag:

- NASA, Fission Surface Power: https://www.nasa.gov/centers-and-facilities/glenn/nasas-fission-surface-power-project-energizes-lunar-exploration
- Kleinhenz/Paz, „An ISRU Propellant Production System for a Fully Fueled Mars Ascent Vehicle", AIAA 2017-0423:
  https://sciences.ucf.edu/class/wp-content/uploads/sites/23/2017/02/An-ISRU-propellant-production-system-for-a-fully-fueled-Mars-Ascent-Vehicle-AIAA-2017-0423.pdf
- ESA, „Surviving the Lunar Night with a Regenerative Fuel Cell System":
  https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Shaping_the_Future/Surviving_the_Lunar_Night_with_a_Regenerative_Fuel_Cell_System

Noch nicht geprüft, als Lehrbuchwerte übernommen: Heizwert Methan, Mischungsverhältnis, Abbrand von
Brennstäben.

Noch nicht untersucht: Science-Fiction-Quellen. Lohnende Kandidaten für eine eigene Recherche sind Werke,
in denen Energielogistik die Handlung bestimmt – etwa die batteriebegrenzte Rover-Reichweite und die
Radionuklidquelle als Heizung in „Der Marsianer" oder Fusionsantrieb und Reaktionsmasse in „The Expanse".
