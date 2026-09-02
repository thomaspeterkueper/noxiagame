# OTA → NOXIA Request — Tharsis Engineering Release

**ID:** OTA-NOX-REQ-20260901-tharsis-engineering-release  
**Datum:** 2026-09-01  
**Status:** open  
**Priorität:** high  
**Quelle:** Overtime Archive / SSF Evidenzaudit  
**Ziel:** noxiagame  
**Referenz:** OTA `docs/tharsis-hub-engineering-release-20260901.md`, Merge `43753e55eb4b9dae7a372b01d64735b8d475afae`

## Zweck

Die fünf in NOXIA/PR #53 als OTA/SSF-abhängig markierten Engineering-Blocker sind fachlich entschieden. NOXIA soll diese Entscheidungen jetzt in den kanonischen Tharsis-Seed und die Systemlogik übernehmen.

## 1. Safe Haven / Evakuierung

- Alle 6 Habitatcluster besitzen lokale Safe-Haven-/Storm-Shelter-Funktion.
- Zusätzlich kolonieweite Evakuierungsreserve für **mindestens 84 Personen**.
- Die 84 Plätze sind Not-/Evakuierungskapazität, nicht 84 zusätzliche permanente Bewohnerplätze.
- Verteilte Umsetzung über übrige Cluster, Emergency Annex und geeignete Mehrzweckräume ist zulässig.

### Abnahme
- Verlust eines kompletten Habitatclusters lässt 84 Personen evakuierbar.
- Normalkapazität bleibt 504 Plätze für 497 Bewohner; Evakuierungsreserve wird separat modelliert.

## 2. ECLSS 2-von-3

- 3 regionale ECLSS-Knoten bleiben kanonisch.
- Zwei beliebige Knoten müssen gemeinsam den kritischen degradierten Betrieb für 497 Personen tragen.
- Engineering-Ziel je Knoten: **55–60 %** des kolonieweiten kritischen Bedarfs; absolute Leistungswerte aus NOXIA-Lastmodell ableiten.
- Lokale Cluster-ECLSS decken Druckregelung, Umwälzung, Sensorik, Isolation und kurzfristigen Inselbetrieb.

### Abnahme
- Ausfall eines beliebigen Regional-ECLSS erzeugt degradierten Betrieb, nicht sofort Colony Failure.
- Tests für alle drei Einzel-Ausfallszenarien.

## 3. Mediumspezifische Utility-Redundanz

### Echte duale A/B-Hauptpfade
- power
- data
- water
- O2

### Abwasser
- segmentierte Sammelpfade;
- lokale Pufferung je Cluster;
- mindestens zwei unabhängige Verarbeitungs-/Umleitungsoptionen;
- kein Zwang zu zwei identischen permanenten Vollringen.

### Thermik
- kritische Verbraucher mit zwei isolierbaren Wärmeabfuhrpfaden;
- fünf getrennte Radiatorfelder;
- Segmentisolation und Bypass/Alternative;
- Habitat-/Niedertemperatur- und Prozesswärmekreise getrennt.

### Andere Prozessgase
- keine pauschale Dualisierung;
- nach Gefahren- und Kritikalitätsklasse;
- kein einzelner Ausfall darf kolonieweite Lebenserhaltung beenden.

### Abnahme
PR #53 darf die vorläufige Redundanzlogik entsprechend präzisieren. Utility-Graph muss tatsächliche alternative Pfade prüfen und darf Redundanz nicht allein aus Knotenzugehörigkeit ableiten.

## 4. Pflanzenmodul

- **1 staatliches Pflanzen-/Frischproduktionsmodul** gehört zum Startbestand.
- nicht survival-critical innerhalb der 30-Tage-Reserve;
- strategische Reserve weiterhin mindestens 27 t lagerfähige Nahrung in 3 Lagerdomänen;
- eigener Wasser-/Nährstoffkreis, hygienisch vom Trinkwasser getrennt.

### Abnahme
Ausfall des Pflanzenmoduls reduziert Frischproduktion/Komfort/Forschung, verursacht aber keinen unmittelbaren Colony Failure.

## 5. Bottom-up-Energie

Freigegebene Engineering-Enveloppe:

- kritische/degradierte Dauerlast: **1,5–2,5 MW**
- normaler Mittelbereich: **3–5 MW**
- Spitzen: **5–8 MW**
- installierte Nennleistung: **7–8 MW** über 6 Reaktormodule / 3 Domänen
- Kurzzeitspeicher/Black Start: **6–10 MWh** über 3 Knoten

Keine `population × kW`-Formel.

Lastklassen:
- A: ECLSS, kritische Kühlung, Wasser, Kommunikation, Medizin, Steuerung
- B: Habitat-Grundbetrieb, Lager/Kühlung, normale Logistik
- C: Fertigung, Pflanzenlicht, schwere ISRU-Chargen, nichtkritische Fahrzeugladung

Lastabwurf: C zuerst, B teilweise, A erhalten.

### Abnahme
- Verbraucher besitzen explizite Last-/Klassenbeiträge.
- Gesamtlast wird bottom-up aggregiert.
- N-1-/degradierter Zustand hält Klasse A innerhalb der freigegebenen Enveloppe.

## Reihenfolge

1. PR #53 Utility-Topologie gegen diese Freigabe aktualisieren und Supabase-Migrationsdrift bereinigen.
2. Safe-Haven-/Evakuierungsmodell ergänzen.
3. ECLSS-2-von-3-Ausfalllogik ergänzen.
4. Pflanzenmodul in staatlichen Startseed aufnehmen.
5. Bottom-up-Energieaggregation und Lastabwurf implementieren.
6. Tharsis-Akzeptanztest um alle fünf Freigaben erweitern.

## Nicht durch OTA vorgegeben

Tile-Footprints, konkrete Meterabstände, Kosten, Bauzeiten, Progression, UI-Darstellung und Spielbalance bleiben NOXIA-eigen. Detailengineering wie Rohrdurchmesser, Pumpenleistung und exakte Radiatorfläche blockiert den spielbaren Start nicht.