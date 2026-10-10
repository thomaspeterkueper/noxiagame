# Energie im NOX-Kanon – Abgleich für NOXIA-ENERGY-0001

Stand: 10.10.2026. Gelesen: `overtime-archive.org` (Commit `bb0a055`), `noxia-universe` (Commit `92d87a0`),
`noxiagame` (docs, Seeds). Pfadkürzel: `OTA/` = `overtime-archive.org/src/content/documents/`,
`OTAdocs/` = `overtime-archive.org/docs/`, `NXU/` = `noxia-universe/`, `GAME/` = `noxiagame/`.
Jede Aussage ist mit Datei und Zeile belegt, sofern nicht als Vermutung markiert.

## Was der Kanon festlegt

### Stromerzeugung

- **Spaltung trägt die Grundlast auf dem Mars.** Tharsis Hub hat ein „nuklear dominiertes Hybridnetz"
  (`OTA/OTA-TEC-0038-2026-DE.md:69-71`, Status Entwurf) mit „6 unabhängige[n] Reaktormodule[n] in 3 räumlich
  getrennten Erzeugungsdomänen" (`OTA/OTA-TEC-0094-2026-DE.md:49`).
- **Solar ist auf dem Mars Ergänzung,** „zulässig, aber keine lebenserhaltende Primärquelle"
  (`OTA-TEC-0094:55`). Die Station Q1 (um 2150) „nutzt die Sonne als wesentliche Energiequelle"
  (`NXU/spaces/noxia/infrastructure/NXU-Q1-QUADRATURE-STATION.md:231`). Im Mondorbit steht ein Cluster aus
  zwölf Solarkraftwerks-Satelliten mit 2,4 GW (`OTA/OTA-TEC-0025-2050-DE.md:434-435`).
- **Fusion ist 2091 nur Labor:** „2091 existiert sie nur in Laboren, nicht auf Schiffen"
  (`OTA/OTA-TEC-0022-2025-DE.md:788-789`). Als Kraftwerk ist sie nirgends kanonisiert: „Fusion wird
  ausdrücklich nicht vorausgesetzt" (`NXU-Q1…:243`).
- **Helium-3** ist 2091 „Experimental (für Fusion)" (`OTA-TEC-0022:659`).
- **Exotisches:** RESO/Casimir-Drift ist „NICHT verfügbar vor 2135" (`OTA-TEC-0022:347-349`).
  Antimaterie kommt nicht vor.

### Speicher und Transport

- **Batterien:** Tharsis hat „Kurzzeitspeicher gesamt 6–10 MWh" in drei Schwarzstart-Knoten
  (`OTA-TEC-0094:53-54`). Ein Rover fährt mit Batterie „ca. 8 Betriebsstunden"
  (`OTA/OTA-TEC-0036-2026-DE.md:81`).
- **Treibstoffdepots:** Gateway-Depot mit 500 t Wasserstoff/Sauerstoff
  (`OTA-TEC-0025-2050:649`). Ceres Station hält 10.000 t Wasser (`OTA-TEC-0022:671`).
- **Methan auf dem Mars:** Sabatier-Prozess, „Gesamt (2091) ~400 t/Jahr" (`OTA-TEC-0022:631-643`),
  „erfordert mehrere Kernreaktoren" (`:647-648`).

### Antriebe

Das Stufensystem steht in `OTA-TEC-0022:105-119`:

| Stufe | Typ | Ära | Reaktionsmasse / Quelle |
|---|---|---|---|
| I | Chemisch | 2025–2055 | Methan/Sauerstoff, Wasserstoff/Sauerstoff |
| II | Nuklearthermisch | 2045–2120 | Wasserstoff, Reaktor 1,5–3,5 GW thermisch |
| III | Plasma (VASIMR) | 2035–2150 | Argon/Wasserstoff, Solar oder Reaktor |
| IV | Fusion | 2110–2180 | D-T, D-He³ |
| V | RESO | 2140+ | „Kein Treibstoff-Ausstoß" |

- „Chemisch bleibt für Oberflächen" (`OTA-TEC-0022:785`).
- „Treibstoff ist Politik – Wer H₂ kontrolliert, kontrolliert die Routen" (`:791-792`).

### Einheiten und Zahlen

- Tharsis Hub (497 Bewohner): kritische Dauerlast 1,5–2,5 MW, Normalbetrieb 3–5 MW, Spitzen 5–8 MW,
  installiert 7–8 MW, Speicher 6–10 MWh (`OTAdocs/tharsis-hub-engineering-release-20260901.md:68-72`).
  Die 7–8 MW sind „ausdrücklich keine [R]-Realreferenz" (`OTA-TEC-0094:51`).
- Spiel-Seed: 6 × 1,25 MW und 3 × 2,5 MWh (`GAME/lib/game/seeds/tharsisHubSeed.ts:155-169`,
  `tharsisHubPowerModel.ts:66-68`).
- Wasserextraktion: 0,9–3,9 kWh je kg Wasser (`OTA/OTA-TEC-0034-2026-DE.md:85`).
- Währungsanker: „1 kg LOX/LH2 im LEO" und „1 kW-Jahr Strom" (`OTA/OTA-FND-0008-2025-DE.md:152-154`).
- Einheiten im Kanon: MW, MWh, kW, kWh, t, J. Im Spiel ist „Energie" noch Tonnen je Tick.

### X-Technologie

- „um 2150 … real, aber noch neu, teuer und begrenzt" (`NXU/canon/NXU-EPOCH-REGISTRY.md:199`).
- Ihre Physik ist nicht definiert (`NXU/canon/NXU-CHROMATIC-RENAISSANCE.md:57`).
- Vermutung: Der X-Drive entspricht dem RESO/χ-Feld-Antrieb (`NXU/canon/physics/chi-field.md:37`
  deutet darauf); gleichgesetzt wird es nirgends.

## Widersprüche

- **Fusionsreaktor im Spiel:** Das Stationsmodul „Fusionsreaktor" mit „+20 Energie/Tick"
  (`GAME/lib/game/stationModules.ts:27`) widerspricht dem Kanon. OTA verlangt dazu eine Entscheidung
  (`OTAdocs/noxia-station-module-coverage-20260906.md:22,42`).
- **Belenus AG** verkauft im Spiel Solarstrom auf dem Mars (`GAME/supabase/migrations/20260720100000_npc_seed.sql:8`),
  obwohl Solar dort laut Kanon nur Ergänzung ist.
- **HeliosCorp** ist in OTA kein Energieversorger, sondern Konzern für Logistik, Stationen und Rohstoffe
  (`OTA/OTA-ORG-0003-2089-DE.md:102`). Das Konzernprofil steht aus (`OTA/OTA-ORG-0001-2079-DE.md:341`).
- **Iterius Prime:** „Geothermie (70%), Solar (20%), Nuklear-Backup (10%)"
  (`OTA/OTA-ORG-0002-2091-DE.md:210`) ist auditiert als „unbelegt und für 2091 neu zu modellieren"
  (`OTA/OTA-META-0005-2091-DE.md:98`) und steht gegen das nuklear dominierte Tharsis-Modell.
- **Schumann-Netz:** rund 1 GW (`OTA/OTA-FND-0015-2026-DE.md:426`) gegen 7–8 MW Kolonieleistung.
  Vermutung: anderer Maßstab oder andere Epoche.

## Worüber der Kanon schweigt

- Reaktortyp, Modulleistung, Brennstäbe und Brennstoffkreislauf.
- Fusion als Kraftwerk (Zeitpunkt, Ort) und die Helium-3-Lieferkette.
- Strahlungsübertragung: Die Solarkraftwerks-Satelliten haben keinen genannten Abnehmer.
- Wasserstoff als Stromspeicher.
- Der Energiestand zwischen 2095 und 2110.
- Ob Belenus, Goibniu und Boann Kanon werden – sie existieren nur im Spiel-Repository.
- Eine Kopie des „Omnizedenz-Währungssystems 2024–2150" liegt in keinem der drei Repositories.
