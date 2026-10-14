# NOXIA-ROBOTICS-0002 — Automatisierte Küchen als Versorgungsinfrastruktur

Version 1.0 · 2026-10-13 · Status: Forschungsreferenz / Simulationspfad vorgeschlagen

## Zweck

Reale 2026er Evidenz für robotisierte Speisenzubereitung wird als Technologiepfad für NOXIA dokumentiert.
Der Kern ist nicht ein humanoider "Roboterkoch", sondern eine **kompakte automatisierte Prozesszelle für Grundversorgung**:
Bestellung, Zutatenbereitstellung, paralleles Kochen, Zusammenstellung und Ausgabe.

Diese Referenz begründet noch keine Spielwerte. Baukosten, Energiebedarf, Wasserbedarf, Personalbedarf,
Durchsatz, Lebensmittelverluste und Wartungsintervalle müssen vor einer Aktivierung separat gemessen bzw.
balanciert werden.

## Primär-/Sekundärbefund 2026

### Allguth / goodBytz in München

Sekundärquelle:
Dominik Göttler: "Roboterkoch an Münchner Tankstelle – warmes Essen auch mitten in der Nacht",
Merkur, 13.10.2026:
https://www.merkur.de/lokales/muenchen/roboterkoch-an-muenchner-tankstelle-warmes-essen-auch-mitten-in-der-nacht-94539254.html

Beobachteter Einsatz:
- Allguth-Tankstelle, Chiemgaustraße 185, München-Giesing.
- Betrieb seit Mitte September 2026.
- warme Speisen rund um die Uhr.
- acht Gerichte im beschriebenen Angebot.
- Bestellung über Terminal, Zahlung vor Ort, Ausgabe nach wenigen Minuten.
- zwei Roboterarme, mehrere Induktionskochstellen und automatisierte Ausgabe.
- Zutaten sind teilweise vorverarbeitet bzw. tiefgekühlt; der Bericht belegt damit keine vollständig autonome Lebensmittelkette vom Rohprodukt bis zur Reinigung.

Die Quelle stützt daher **autonome Zubereitung innerhalb einer vorbereiteten Prozesskette**, nicht die Behauptung einer vollständig menschenfreien Gastronomie.

### goodBytz emma.

Herstellerquelle, 09.09.2026:
https://www.goodbytz.com/de/press/goodbytz-neues-produkt-emma.

Vom Hersteller angegeben:
- 80–120 Mahlzeiten pro Stunde,
- rund 40 % geringerer Flächenbedarf gegenüber Vorgängersystemen mit ähnlichem Funktionsumfang,
- automatisiertes Hinzufügen verschiedener Komponenten,
- automatisiertes Bowl-Assembling,
- Auslegung auf kompaktere Integration in bestehende Food-Service-Flächen.

Herstellerangaben sind als Produktangaben zu behandeln und nicht als unabhängig validierte Leistungsgrenze.

### goodBytz SAM

Herstellerquelle, 12.03.2026:
https://www.goodbytz.com/de/press/goodbytz-pr%C3%A4sentiert-sam-die-weltweit-erste-robotische-k%C3%BCche-im-container-f%C3%BCr-einsatzorte-ohne-infrastruktur

Für NOXIA besonders relevant:
- integrierte robotische Küche im transportierbaren Container,
- Plug-and-Play-Ansatz,
- vor Ort nur Strom sowie Zu- und Abwasser als explizit genannte Anschlüsse,
- vorbereitete Lebensmittel werden eingesetzt und über Feeder zugeführt,
- integrierte Kühlung während des Transports.

Das ist ein plausibles reales Vorbild für modulare Versorgungseinheiten in abgelegenen,
temporären oder infrastrukturell begrenzten Siedlungen.

## Abgeleitetes NOXIA-Prinzip

**Automatisierte Küche ist Infrastruktur, kein bloßes Dekorationsobjekt.**

Prozesskette:

food inventory
  -> preparation / feeder loading
  -> robotic cooking cell
  -> order orchestration
  -> payment
  -> meal output
  -> consumption
  -> maintenance / refill

Jeder Schritt soll später auf reale Systemzustände zurückgeführt werden können.

## Technologiepfad

### Stufe 1 — robotic_kitchen_2026

Eigenschaften:
- standardisierte Rezepte,
- vorbereitete Zutaten,
- automatisiertes Kochen und Portionieren,
- menschliches Nachfüllen,
- menschliche bzw. teilautomatisierte Reinigung,
- reguläre Wartung,
- begrenzte Reaktion auf ungewöhnliche Zutaten-/Prozesszustände.

Einsatzorte:
Tankstelle, Hotel, Supermarkt, Kantine, Klinik, Campus, Schichtbetrieb.

### Stufe 2 — automated_food_service

Zusätzliche Fähigkeiten:
- automatische Lagerentnahme,
- flexible Rezeptplanung aus vorhandenem Bestand,
- Selbstreinigung zwischen definierten Zyklen,
- Bestandsprognose und Nachbestellung,
- Zustandsüberwachung der Kochmodule,
- Wartungsbedarf als Teil der Facility-Simulation.

### Stufe 3 — habitat_food_cell

Für Mond, Mars, Orbitalhabitate und abgelegene Basen:
- Kopplung an Habitat-Lebensmittelbestand,
- Wasser-/Energie-/Abwärmebilanz,
- Ernährungsprofile und individuelle Bedürfnisse,
- Recycling-/Abfallpfade,
- Redundanz und Degradationsbetrieb,
- Remote-/Robotikwartung,
- Versorgung auch außerhalb menschlicher Schichten.

Diese Stufe ist eine NOXIA-Extrapolation, keine Aussage über heute verfügbare Technik.

## Simulation

Vorgesehener Building/Fa­cility-Identifier:
- robotic_kitchen
- Alias/Weiterentwicklung: automated_food_service
- spätere Habitatvariante: habitat_food_cell

### Zustände

- ingredient_stock
- chilled_stock
- energy_available
- maintenance_debt
- throughput_limit
- active_orders
- degraded_mode

### Inputs

- food ingredients
- electricity
- replacement parts
- staff/robot maintenance time

### Outputs

- prepared meals
- NPC sustenance satisfaction
- service revenue
- maintenance demand

## Verbindung zum bestehenden NPC-Konsum

Die bestehende NOXIA-Kette

person need -> service offer -> buyer debit -> seller credit -> need satisfaction

ist bereits der passende ökonomische Anschluss.

Für eine robotic_kitchen darf später ein Serviceangebot aber nur dann aktiv sein, wenn:
1. Zutatenbestand vorhanden ist,
2. Facility operational ist,
3. erforderliche Energie verfügbar ist,
4. Kapazität nicht überschritten ist.

Damit entsteht kein Essen aus dem Nichts und kein Umsatz ohne physische Leistung.

## Personal und Automatisierung

Realer Stand 2026 rechtfertigt **keine Null-Personal-Annahme**.

Auch bei hoher Kochautomatisierung bleiben insbesondere Zutatenlogistik/Nachfüllung,
Fehlerbehandlung, Wartung, Qualitätskontrolle und Lieferkettenorganisation relevant.

**Modellierungsgrenze NOXIA:** Reinigung und Abfallentsorgung werden nicht als eigene
Simulationsschleifen geführt. Reinigungsroboter gehören zum Facility-Inventar; Reinigung,
Verbrauchsmittel und Müll laufen zusammen mit normalen Wartungs- und Instandhaltungskosten.
Erst wenn eine spätere Mechanik dafür einen echten spielerischen Engpass erzeugt, wird tiefer modelliert.

## Robotik-Einordnung

Querverweis:
- docs/worldbuilding/technology/robotics-machine-population.md
- docs/research/NOXIA-ROBOTICS-0001-phonebot-mininodes.md

Die bestehende Diffusionsfolge "industry -> logistics -> ... -> food service -> ..." erhält damit einen realen
2026er Referenzpunkt. Robotische Food-Service-Systeme sind ein gutes Beispiel dafür, dass Robotik nicht
humanoid sein muss, sondern aus spezialisierten Prozesszellen entstehen kann.

## Relevanz für Mond, Mars und Orbitalanlagen

In abgelegenen Habitaten steigen die Vorteile von:
- 24/7-Verfügbarkeit,
- kleinem Footprint,
- standardisierten Prozessen,
- kontrollierter Hygiene,
- planbarem Ressourcenverbrauch,
- geringerem Bedarf an dauerhaft besetzten Küchenschichten.

Gleichzeitig steigt die Bedeutung von Ausfallsicherheit. Eine Habitatküche darf deshalb niemals die einzige
Versorgungsmöglichkeit sein. Manuelle oder alternative Notversorgung bleibt ein Resilienzpfad.

## Noch nicht festlegen

Vor Gameplay-Aktivierung offen:
- Baukosten,
- Energie pro Mahlzeit,
- Lebensmittelverlust,
- Personalstunden,
- Wartungsintervalle,
- tatsächlicher Durchsatz unter NOXIA-Bedingungen,
- Servicepreis,
- Produktions-/Versorgungsrezepte.

## Wiederprüfung

Spätestens 13.10.2027, früher bei:
- unabhängigen Betriebsdaten,
- neuen goodBytz-Systemgenerationen,
- belastbaren Energie-/Wasser-/Wartungsdaten,
- breiterem 24/7-Einsatz in Retail/Hospitality/Defense,
- autonomen Reinigungs- oder Rohzutatenprozessen.
