# OTA → NOXIA Request — Tharsis Engineering Release

**ID:** OTA-NOX-REQ-20260901-tharsis-engineering-release  
**Datum:** 2026-09-01  
**Status:** done  
**Priorität:** high  
**Quelle:** Overtime Archive / SSF Evidenzaudit  
**Ziel:** noxiagame  
**Referenz:** OTA `docs/tharsis-hub-engineering-release-20260901.md`, Merge `43753e55eb4b9dae7a372b01d64735b8d475afae`  
**NOXIA-Implementierung:** PR #53, Merge `92021585d92335150f6a548264a8a2edd223d919`  
**Abgeschlossen:** 2026-09-05

## Ergebnis

Die fünf OTA/SSF-abhängigen Engineering-Freigaben sind auf NOXIA-Seite umgesetzt und in `main` integriert.

## 1. Safe Haven / Evakuierung

Umgesetzt in `lib/game/seeds/tharsisHubResilience.ts`:

- 6 Habitatcluster mit lokaler Safe-Haven-/Storm-Shelter-Funktion;
- unabhängige Notreserve über den Medical Annex;
- 14 Evakuierungsplätze je Safe-Haven-Knoten;
- nach Verlust eines beliebigen Habitatclusters verbleiben 84 externe Evakuierungsplätze;
- permanente Habitatkapazität bleibt 504 für 497 Bewohner.

## 2. ECLSS 2-von-3

Umgesetzt in `lib/game/seeds/tharsisHubResilience.ts`:

- 3 regionale ECLSS-Knoten;
- jeder Knoten mit 56 % des kritischen Bedarfs;
- nach Ausfall eines beliebigen Knotens verbleiben rechnerisch 112 % kritische Restkapazität;
- lokale Clusterfähigkeiten für Druckregelung, Umwälzung, Sensorik, Isolation und kurzfristigen Inselbetrieb sind explizit modelliert.

## 3. Mediumspezifische Utility-Redundanz

Umgesetzt in `lib/game/seeds/tharsisHubUtilityNetwork.ts` und `lib/game/seeds/tharsisHubEngineeringPolicy.ts`:

- echte duale A/B-Hauptpfade nur für `power`, `data`, `water`, `o2`;
- physische Feeder und explizite Graphkanten;
- segmentiertes Abwasser mit lokaler Pufferung und mindestens zwei Verarbeitungs-/Umleitungszielen;
- zwei isolierbare Thermik-Hauptkreise und fünf Radiatorfelder;
- getrennte Habitat-/Niedertemperatur- und Prozesswärmekreise;
- Prozessgase nach Gefahren-/Kritikalitätsklasse statt künstlicher Vollring-Dualisierung;
- kein einzelner Prozessgas-Ausfall darf Colony-Life-Support beenden.

## 4. Pflanzenmodul

Umgesetzt im kanonischen Tharsis-Startseed und abgesichert durch `lib/game/seeds/tharsisHubEngineeringPolicy.ts`:

- genau 1 staatliches Pflanzen-/Frischproduktionsmodul im Startbestand;
- nicht survival-critical;
- eigener hygienisch getrennter Wasser-/Nährstoff-Prozessloop;
- strategische Lagerreserve bleibt unabhängig bei mindestens 27 t in drei Reserve-Depots.

## 5. Bottom-up-Energie

Umgesetzt in `lib/game/seeds/tharsisHubPowerModel.ts`:

- explizite Leistungsprofile pro Verbraucher statt `population × kW`;
- Lastklassen A/B/C;
- normale Gesamtlast innerhalb 3–5 MW;
- kritische Dauerlast innerhalb 1,5–2,5 MW;
- Spitzenlast innerhalb 5–8 MW;
- installierte Nennleistung 7–8 MW über 6 Reaktormodule / 3 Energiedomänen;
- 7,5 MWh Black-Start-Speicher über 3 Knoten;
- Lastabwurf C → B → A;
- N-1-Prüfung für alle drei Energiedomänen.

## Abnahme

`lib/game/seeds/tharsisHubSeed.test.ts` enthält deterministische Akzeptanztests für alle fünf Freigaben, darunter:

- 497 Bewohner / 504 permanente Habitatplätze;
- Safe-Haven-Kapazität bei Ausfall jedes Habitatclusters;
- alle drei ECLSS-Einzelausfälle;
- echte Utility-Dualpfade und mediumspezifische Sonderregeln;
- Pflanzenmodul + 27-t-Reserve;
- Bottom-up-Leistungsaggregation, Lastklassen und N-1-Energieprüfung.

Der frühere Datenbank-/Replay-Blocker wurde separat durch PR #55 behoben. PR #53 ist inzwischen gemerged. Der Merge-Commit besitzt erfolgreichen Vercel-Status.

## Eigentumsgrenze

OTA bleibt Source of Truth für die technische Freigabe. NOXIA bleibt Source of Truth für Spielsystem, Seed, Runtime-Logik, Balancing und Darstellung. Nicht durch OTA vorgegebene Detailwerte bleiben NOXIA-eigen.