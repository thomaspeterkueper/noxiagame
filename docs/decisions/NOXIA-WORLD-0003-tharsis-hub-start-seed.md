# ADR: Tharsis Hub — kanonischer Start-Seed (497 Bewohner)

**Datum:** 30.08.2026
**Status:** Accepted
**Auftrag:** OTA-NOX-REQ-20260830-THARSIS-HUB-START-SEED
            (`external-tasks/open/OTA-NOX-REQ-20260830-tharsis-hub-start-seed.md`)

---

## Kontext

Aus der abgeschlossenen SSF→OTA-Kette (Minimum Viable Mars Colony, 497 Personen,
Evidenzaudit) leitet NOXIA einen neuen kanonischen Start-Seed für Tharsis Hub ab.
NOXIA bleibt Source of Truth für Spielobjekte, Stückzahlen, Tile-Positionen,
Baukosten/-zeiten, Balancing, Seed-Daten und Eigentumsmodell; OTA setzt die
technischen Redundanz- und Abhängigkeitsgrenzen (OTA-TEC-0094-2026-DE bis
OTA-TEC-0107-2026-DE).

## Entscheidung

### 1. Kanonische Quelle ist eine TS-Seed-Datei

`lib/game/seeds/tharsisHubSeed.ts` ist die kanonische Quelle des Seeds
(Gebäude, Fahrzeuge, Fahrwege, Utility-Ringe, fachliche Verknüpfungen).
Die SQL-Migration `20260830190000_tharsis_hub_start_seed.sql` ist daraus
generiert und im Dateikopf als abgeleitetes Artefakt markiert.

### 2. Eigentumsmodell — bestehendes Owner-Konzept, keine neue ID

Alle Startobjekte, Fahrzeuge, Fahrwege und Mediennetze beginnen im bestehenden
kanonischen öffentlichen Konzept:

- `owner_class = 'STATE'`
- `is_state_owned = true`
- `owner_id = NULL`

Es wird **keine** neue Eigentums-ID erfunden. Betreiber/Okkupant darf später
über das bestehende Leasing-/Konzessionsmodell (`concessions`, `occupant_id`)
vom Eigentümer abweichen. Konsequenz: `tile_entities.profile_id` wird nullable
(war NOT NULL aus der Alt-Schema-Ebene; Code/UI behandeln NULL bereits heute
als „staatlich“).

### 3. Fahrwege sind persistente STATE-Infrastruktur

Das alte prozedurale Mars-Straßennetz (`addRoadNetwork` bei population ≥ 200)
wird für Tharsis Hub **vollständig ersetzt** durch den Seed-Fahrwegeplan
(innerer Service-Ring + drei Hauptkorridore + notwendige Service-Spurs, keine
Schiene). Die Fahrwege werden zugleich als `tile_entities`-Zeilen
(`entity_id='road'`, STATE) persistiert — der in
`ADR-strassen-infrastruktur` beschriebene Migrationsschritt A' für Tharsis.
`generateGrid()` zeichnet DB-Straßenzeilen als Fahrwege, nicht als Gebäude.

### 4. Utility-Netze sind von Fahrwegen getrennte Netzlogik

Utility Ring A und Ring B sind physisch getrennte Netze (zellfremd zu Straßen,
Gebäuden, Fahrzeugen und untereinander). Ein Road-Tile enthält **nicht**
automatisch alle Medien. Jeder Habitatcluster und jede kritische Anlage erhält
zwei Versorgungspfade (Ring A + Ring B). Modellierte Medien: elektrische
Leistung, Daten/Steuerung, Trink-/Prozesswasser, Abwasser, O₂, Prozessgase,
thermische Kreise (eigene Netzlogik). Persistenz: Tabelle `location_utilities`
(Ring-Knoten mit Medienbelegung + Anbindungen, STATE).

### 5. Zonen und Redundanz

Zonen A (Habitatkern), B (Logistik-/Industriekante), C (Wasser/ISRU),
D1–D3 (drei getrennte Energie-Domänen außerhalb des Druckkerns),
E (fünf verteilte Radiatorfelder, zwei Thermalkreise), F (Lande-/Frachtbereich).
N-1-Garantie: Die Sperrung eines einzelnen Fahrweg-Tiles trennt nie alle
Habitatcluster gleichzeitig von Energie **oder** Wasser. Medical Core und alle
sechs Cluster haben alternative Rettungszugänge.

### 6. Alt-Seed wird ersetzt, nicht parallel geführt

- `locations.mars`: 497 Einwohner, 504 Plätze, `base_population_max = 0`
  (Kapazität kommt vollständig aus 6 Habitatclustern × 84 über den regulären
  Tick-Pfad — künftige Cluster erweitern die Kapazität nach denselben Regeln).
- Alte STATE/NPC-Produktions- und Wohn-Seedbauten werden entfernt
  (PLAYER-Eigentum bleibt unangetastet).
- Die Terrain-Marker H/I (Mars Terrain v3) entfallen; Terrain täuscht keine
  Bauten mehr vor.
- Staatsservices (bank, school, shipyard, admin, scanner) bleiben als laufende
  Service-Schicht erhalten und sind nicht Teil des physischen Startlayouts.

## Akzeptanzprüfung

`npx tsx lib/game/seeds/tharsisHubSeed.test.ts` prüft exakte Stückzahlen,
497/504, Zonenregeln, N-1-Straßenpfade, Rettungszugänge, doppelte
Medienanbindung und physische Trennung der Utility-Netze.
