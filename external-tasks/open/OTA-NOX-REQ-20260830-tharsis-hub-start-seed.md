---
id: OTA-NOX-REQ-20260830-THARSIS-HUB-START-SEED
requester: SYS:KUEPER:ota
target: SYS:KUEPER:noxia
priority: high
type: world-seed-layout
created: 2026-08-30
status: open
affects: [NOXIA, OTA, SSF, KG]
requires:
  - OTA-TEC-0038-2026-DE
  - OTA-TEC-0094-2026-DE
  - OTA-TEC-0095-2026-DE
  - OTA-TEC-0096-2026-DE
  - OTA-TEC-0097-2026-DE
  - OTA-TEC-0098-2026-DE
  - OTA-TEC-0099-2026-DE
  - OTA-TEC-0100-2026-DE
  - OTA-TEC-0101-2026-DE
  - OTA-TEC-0102-2026-DE
  - OTA-TEC-0103-2026-DE
  - OTA-TEC-0104-2026-DE
  - OTA-TEC-0105-2026-DE
  - OTA-TEC-0106-2026-DE
  - OTA-TEC-0107-2026-DE
---

# OTA → NOXIA: Tharsis Hub als staatliche Startkolonie neu aufbauen

## Ziel

Aus der nun abgeschlossenen SSF→OTA-Kette soll NOXIA einen neuen kanonischen **Start-Seed für Tharsis Hub mit 497 Bewohnern** ableiten.

NOXIA bleibt Source of Truth für Spielobjekte, konkrete Stückzahlen auf der Karte, Baukosten, Bauzeiten, Balancing, Tile-Footprints, Seed-Daten und Eigentumsmodell. OTA setzt die technischen Redundanz- und Abhängigkeitsgrenzen.

## 1. Physische Startobjekte / minimale Stückzahlen

### Habitat und Lebenserhaltung

1. **6 Habitatcluster**
   - je 84 Auslegungsplätze, zusammen 504 Plätze für 497 Bewohner;
   - je Cluster mindestens zwei interne Druck-/Brandsegmente + Safe-Haven/Storm-Shelter-Funktion;
   - lokale ECLSS-, Druck- und Notabsperrfunktion als integrierte Unterkomponenten, nicht als sechs zusätzliche frei stehende Gebäude.

2. **3 regionale ECLSS-/Utility-Hubs**
   - je Hub versorgt zwei Habitatcluster;
   - zwei von drei Hubs müssen im degradierten Betrieb den kolonieweiten Mindest-O₂-/CO₂-Bedarf tragen können.

### Energie

3. **3 staatliche Energie-Komplexe**
   - je Komplex 2 Reaktormodule = **6 Reaktormodule gesamt**;
   - je Komplex integrierter Black-Start-/Speicherknoten = **3 Black-Start-Knoten**;
   - Energie-Komplexe liegen in drei separaten Schadensdomänen außerhalb des Druckkerns;
   - Gesamtarchitektur technisch auf ca. 7–8 MW Nennleistung ausgelegt; NOXIA bestimmt konkrete Leistung pro Spielobjekt und Balance.

### Wasser / ISRU

4. **3 Wasser-ISRU-/Aufbereitungskomplexe**
   - drei unabhängige Prozessstränge;
   - mindestens zwei räumlich getrennte Entnahme-/Rohwasserbereiche;
   - je Komplex eigener Roh-/Prozesswasserpuffer;
   - zusammen mindestens **24 t gesicherte ECLSS-/Trinkwasser-Nachspeisereserve**, auf mehrere Tanks verteilt;
   - nominale technische Architektur etwa 3 t/Tag aufbereitetes Wasseräquivalent; Spielwert bleibt NOXIA.

### Thermik

5. **5 getrennte Radiatorfelder**
   - nicht zu einem großen Feld zusammenfassen;
   - mindestens zwei getrennte thermische Hauptkreise;
   - Staubdegradation, Reinigbarkeit und Feldisolation sichtbar/technisch abbildbar;
   - Verlust eines Feldes darf kritische ECLSS-/Medizinkühlung nach Lastabwurf nicht beenden.

### Medizin

6. **1 Medical-Core-Komplex**
   - intern zwei getrennte klinische Zellen;
   - zwei unabhängige Medienzuführungen.

7. **1 Emergency Medical Annex**
   - in einem anderen Habitatcluster als der Medical Core;
   - dient Stabilisierung bei Isolation/Ausfall des Hauptkerns.

### Nahrung / Lager / Logistik

8. **3 strategische Reserve-Depots**
   - gemeinsam mindestens 27 t lagerfähige 30-Tage-Nahrungsreserve plus kritische Verbrauchsmittel;
   - keines hält mehr als die Hälfte der lebenswichtigen Reserve;
   - dürfen mit den drei allgemeinen strategischen Lagerdomänen aus OTA-TEC-0102 physisch zusammenfallen, sofern Lebensmittel/Medizin/Technik intern getrennte Lagerzonen besitzen.

9. **1 Frischproduktions-/Pflanzenmodul-Komplex**
   - im Startzustand nicht überlebenskritisch;
   - keine vollständige Kalorienautarkie annehmen.

10. **1 zentraler Logistik-/Frachtumschlag-Hub**
    - an Grenze Außenbereich ↔ Drucksystem;
    - eigene Staub-/Dekontaminationslinie;
    - nicht mit allen strategischen Reserven zusammenlegen.

### Werkstatt / Recycling

11. **2 Werkstattzellen**
    - 1 saubere Elektronik/Präzision/ECLSS-Werkstatt;
    - 1 schwere Mechanik/Fertigung/Bau-Werkstatt.

12. **2 Material-/Reststoff-Komplexe**
    - je Komplex ein Nassstrom-Behandlungszug + eine Trocken-/Materialzelle;
    - damit insgesamt 2 Nasszüge und 2 Materialzellen;
    - medizinisch kontaminierter Stoffpfad separat gekapselt.

### Kommunikation / Steuerung

13. **2 lokale Command-&-Control-Knoten**
    - in zwei verschiedenen Habitatclustern;
    - keiner ist alleiniger Master.

14. **3 lokale Oberflächen-Relay-/Navigationspunkte**

15. **2 getrennte Langstrecken-/Erde-Orbit-Kommunikationsstationen**
    - nicht in derselben Schadensdomäne.

## 2. Fahrzeug-Startbestand

NOXIA soll für den staatlichen Startzustand zunächst folgende Minimalflotte anlegen; konkrete Modelle/Kapazitäten bleiben NOXIA-eigen:

- **3 druckbeaufschlagte Rettungs-/Personentransport-Rover**;
- **4 autonome Frachttransporter**;
- **2 schwere Bau-/Erdbewegungsfahrzeuge**;
- **3 modulare Wartungs-/Berge-/EVA-Support-Fahrzeuge**;
- **8 leichte Inspektionsroboter/-drohnen**.

Begründung: Ausfall eines Einzelobjekts darf Rettung, Fracht, schwere Bau-/Bergefähigkeit oder Außeninspektion nicht vollständig eliminieren. Rettung/Personentransport darf eine Plattformklasse sein; Wartung/Bergung/EVA-Support ebenfalls.

## 3. Minimaler Fahrwege-Plan

Das Startlayout erhält kein dekoratives Straßennetz, sondern:

1. **einen inneren Service-Ring** um Habitat-/Logistikkern;
2. **einen Energie-Hauptkorridor** zu den drei Energie-Komplexen;
3. **einen Wasser-/ISRU-Hauptkorridor**;
4. **einen Lande-/Fracht-Hauptkorridor**;
5. nur notwendige Service-Spurs zu Radiatorfeldern, Relays, Kommunikation und Reststoffanlagen.

Anforderung: Sperrung eines einzelnen Ring-/Korridorsegments darf nicht gleichzeitig sämtliche Wege zu Energie und Wasser abschneiden. Medical Core und alle sechs Habitatcluster benötigen einen alternativen Rettungszugang.

Keine Schiene im Startzustand.

## 4. Mediennetz

NOXIA muss Infrastruktur künftig von Fahrwegen trennen:

- **Utility Ring A**
- **Utility Ring B**

Beide physisch getrennt. Jeder Habitatcluster und jede kritische Anlage erhält mindestens zwei sinnvolle Versorgungspfade.

Zu modellierende Medien:
- elektrische Leistung,
- Daten/Steuerung,
- Trink-/Prozesswasser,
- Abwasser,
- O₂,
- relevante Prozessgase,
- thermische Kreise als eigene technische Netzlogik.

Ein Road-Tile darf nicht automatisch alle Medien enthalten.

## 5. Räumliche Zonen

Das Seed soll mindestens diese funktionalen Bereiche erkennbar trennen:

### A — geschützter Habitatkern
6 Habitatcluster, Medical Core, Command Nodes, Emergency Annex, saubere Werkstatt, Teile der Reserve-Lager.

### B — Logistik-/Industriekante
Fracht-Hub, schwere Werkstatt, Materialrückgewinnung, unpressurierte Lager, Fahrzeugservice.

### C — Wasser-/ISRU-Zone
Wassergewinnung und Rohwasserbehandlung außerhalb des Wohnkerns; Final-/Trinkwasserbarriere getrennt von Abwasser/Reststoffen.

### D — Energie-Zonen 1–3
Drei räumlich getrennte Reaktorkomplexe außerhalb des Habitatkerns; nicht mit Landezone, Wasserhauptanlage oder untereinander zu einem einzigen Komplex zusammenlegen.

### E — Thermalfelder
Fünf verteilte Radiatorfelder außerhalb Hauptstaub-/Landeverkehr; nicht als zusammenhängender Block.

### F — Lande-/Frachtbereich
Von Habitatverkehr und empfindlicher Thermik getrennt; direkter Schwerlastweg zum Logistik-Hub.

## 6. Staatliches Eigentum

Alle oben genannten Startobjekte, Fahrzeuge, Fahrwege und kritischen Mediennetze beginnen **im staatlichen/öffentlichen Eigentum**.

Bitte das im aktuellen NOXIA-Eigentumsmodell mit dem bestehenden kanonischen öffentlichen Owner-/Owner-Class-Konzept umsetzen; **keine neue Eigentums-ID lokal erfinden**, falls bereits ein öffentlicher/staatlicher Owner existiert. Betreiber/Okkupant darf später vom Eigentümer abweichen, wo das Leasing-/Betreibermodell dies unterstützt.

## 7. Was im Startzustand ausdrücklich NICHT gebaut wird

- kein dekoratives Stadtstraßennetz;
- keine Schiene;
- keine vollständige Lebensmittelautarkie;
- kein zusätzliches Wohnviertel über die sechs Startcluster hinaus;
- keine Reserve-Reaktoranlage als vierte Energie-Domäne;
- keine große Zukunftsfabrik;
- keine zweite vollständige Klinik;
- keine privaten Handels-/Freizeitgebäude nur zur optischen Belebung;
- keine zukünftigen Straßen/Leitungen ohne aktuelle Funktion;
- keine automatische Zusammenlegung von Straßen und Utility-Netzen.

## 8. Implementierungsreihenfolge

1. neue/benötigte NOXIA-Objektklassen und Komplexmodule mappen;
2. staatlichen Startbestand als Datenmodell/Seed definieren;
3. Grid-/Map-Positionen aus Sicherheits- und Abhängigkeitsgraph ableiten;
4. Fahrwege erzeugen;
5. Utility A/B getrennt erzeugen;
6. Fahrzeuge zuordnen;
7. Owner/Occupant setzen;
8. altes Tharsis-Hub-Seed ersetzen, nicht parallel weiterführen;
9. Tests für Objektzahlen, N-1-Pfade, Erreichbarkeit und doppelte Medienanbindung ergänzen.

## 9. Akzeptanzkriterien

- genau 497 Startbewohner, mindestens 504 Habitatplätze;
- sechs voneinander isolierbare Habitatcluster;
- drei unabhängige Energie-Domänen / sechs Reaktormodule;
- drei Wasserstränge;
- drei regionale ECLSS-Hubs;
- fünf Radiatorfelder;
- Medical Core + Emergency Annex;
- drei strategische Reserve-Depots;
- zwei Werkstattzellen;
- zwei Material-/Reststoff-Komplexe;
- Minimalflotte gemäß Abschnitt 2;
- innerer Service-Ring + drei Hauptkorridore;
- zwei physisch getrennte Utility-Netze;
- kein einzelner Tile-/Objekt-/Netzknoten trennt gleichzeitig alle Habitatcluster von Energie oder Wasser;
- kritischer Startbestand staatlich/öffentlich owned;
- altes Tharsis-Startlayout vollständig ersetzt;
- Build/Tests/Vercel grün.

## Quellen

Kanonische OTA-Architektur: `OTA-TEC-0038-2026-DE` sowie `OTA-TEC-0094-2026-DE` bis `OTA-TEC-0107-2026-DE`.
SSF-Evidenzbasis: `solarsciencefoundation/docs/research/minimum-viable-mars-colony-497.md` v0.2 und zugehöriger Evidenzaudit.
