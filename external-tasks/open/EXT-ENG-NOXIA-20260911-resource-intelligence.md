---
id: EXT-ENG-NOXIA-20260911-RESOURCE-INTELLIGENCE
title: Resource Intelligence – Prospektion vor Deposit-Freischaltung
status: open
source: KUEPER-ENGINEERING
target: NOXIA
created: 2026-09-11
priority: medium
affects: [NOXIA, Resources, Exploration, Moon, Mars, Asteroids, Science, UX]
---

## Ausgangspunkt

KUEPER Engineering hat mit `ENG-REQ-PRR-0001` und `ENG-SYS-PRR-0001` eine erste **Planetary Resource Reconnaissance Architecture** angelegt.

Engineering-Quellen:

- https://github.com/thomaspeterkueper/kueper-engineering/blob/main/requirements/planetary-resource-reconnaissance-0.1.md
- https://github.com/thomaspeterkueper/kueper-engineering/blob/main/systems/planetary-resource-reconnaissance-architecture-0.1.md

Realer Forschungsanker ist die 2026 von NASA NIAC geförderte Phase-I-Studie **Interworld Slingshot Resource Surveys**, die 30–50-km-Raman-Messungen aus Orbit/Flyby als Machbarkeitsfrage untersucht.

Wichtig: Orbitales Raman ist dort **nicht demonstrierte verfügbare Technik**, sondern ein `[H]`-Gate. NOXIA sollte daher keine heutige Scannerfähigkeit daraus ableiten.

## Problem für NOXIA

Die bisherige Materialkette

```text
Material → Deposit → Handelsgut → Produkt
```

benötigt davor eine explizite Erkenntnisschicht:

```text
Remote sensing
→ Anomalie
→ Ressourcenkandidat
→ Zusammensetzungs-Konfidenz
→ Ground Truth
→ Mengen-/Gehaltsmodell
→ bestätigtes Deposit
→ Abbauentscheidung
```

Ein Deposit soll nicht allein deshalb vollständig bekannt sein, weil eine Kartenkachel oder ein Scanner es berührt.

## Auftrag an NOXIA

Bitte prüfen und in NOXIA-eigener Semantik ausarbeiten, wie **Resource Intelligence / Prospektion** als Gameplay- und Datenzustand vor der eigentlichen Deposit-Nutzung abgebildet werden kann.

### 1. Erkenntniszustände

Engineering schlägt als nicht-kanonische Ausgangsfolge vor:

```text
unknown
→ anomaly
→ candidate
→ composition_identified
→ sampled
→ spatially_constrained
→ resource_estimated
→ engineering_characterized
→ economically_characterized
```

NOXIA entscheidet selbst, welche Zustände spielmechanisch sinnvoll sind und wie viele davon tatsächlich sichtbar werden.

### 2. Unsicherheit statt Scheingenauigkeit

Vor Ground Truth sollen keine exakten Tonnenzahlen erzwungen werden.

Mögliche sichtbare Größen:

- confidence,
- estimated material class,
- mineral hypothesis,
- footprint / resolution,
- depth uncertainty,
- grade uncertainty,
- estimated range statt exakter Menge,
- `ground_truth_status`.

Beispiel:

```text
Ilmenit candidate
Composition confidence: high
Footprint: medium confidence
Depth: unknown
Recoverable tonnage: unknown
Ground truth: none
```

### 3. Sensor-Ladder

NOXIA sollte Sensorsysteme nicht nur über `range` unterscheiden, sondern über **welche Art Information sie liefern**.

Mögliche Klassen:

- passive orbital imaging/spectroscopy,
- neutron/gamma resource context,
- radar/geophysics,
- targeted active spectroscopy,
- long-range / orbital Raman `[H]`,
- rover/lander spectroscopy,
- drill/sample ground truth.

### 4. Moon-Integration

Besonders relevant für die geplante echte Mondkarte:

```text
Geologie-/Topografie-Layer
→ spektrale / neutronische Kandidatenzone
→ gezielte Prospektion
→ Rover/Bohrung
→ bestätigter Ressourcen-Node
→ Bau-/ISRU-Entscheidung
```

Bitte vorhandene Moon-Geologie-/Ressourcenarchitektur wiederverwenden und keine zweite parallele Ressourcendatenwelt aufbauen.

### 5. Mars / Phobos / Deimos

Bitte Resource Intelligence auch so modellieren, dass später unterschiedliche Plattformen dieselbe Erkenntniskette bedienen können:

- Mars Orbiter,
- Mars Rover,
- Phobos/Deimos Scout,
- Asteroid Scout,
- stationäre Surface-Instrumente.

### 6. Gameplay-Prinzip

Prospektion soll eine echte Entscheidung erzeugen:

```text
billiger, grober Scan
vs.
teurer, genauer Targeted Scan
vs.
Rover/Bohrmission für Ground Truth
```

Ziel ist **kein zusätzlicher Klick-Zwang**, sondern eine sinnvolle Informationsökonomie: Gute Daten reduzieren das Risiko teurer falscher Bau-/Abbauentscheidungen.

## Abgrenzung

Dieser Request schreibt NOXIA **keine** konkrete Tabelle, API, UI oder Balancingzahl vor.

KUEPER Engineering bleibt Source of Truth für die technische Sensor-/Missionsarchitektur. NOXIA bleibt Source of Truth für Gameplay, Balancing, Persistenz und Runtime.

Orbital Raman aus 30–50 km darf nicht als `[R]` kanonisiert werden; Stand Engineering ist `[H]` / NIAC Feasibility Study.

## Erwartetes Ergebnis

- Entscheidung, ob `Resource Intelligence` als eigene NOXIA-Domäne eingeführt wird,
- NOXIA-eigene minimale Zustandsmaschine für Ressourcenerkenntnis,
- Definition, welche Sensorfamilien welche Erkenntnis verbessern,
- Umgang mit Confidence/Unknown/Range statt exakten Frühwerten,
- Anschluss an Moon/Mars/Asteroid-Karten und bestehende Deposit-/Materialsysteme,
- UX-Prinzip für Prospektionsentscheidungen,
- Liste fehlender Core-/World-Contracts als eigene Handoffs.

## Acceptance Criteria

1. `Deposit` ist nicht mehr automatisch gleich `vollständig bekannte Lagerstätte`.
2. Mindestens `unknown/candidate/confirmed` oder eine funktional gleichwertige mehrstufige Semantik ist vorgesehen.
3. Remote sensing kann Kandidaten erzeugen, ohne automatisch Tiefe/Gehalt/Menge exakt zu kennen.
4. Ground Truth kann die Qualität der Ressourcenschätzung sichtbar erhöhen.
5. Sensoren unterscheiden sich mindestens nach Informationsart und Auflösung, nicht nur nach Reichweite.
6. Moon/Mars/Asteroid können dieselbe gemeinsame Erkenntnislogik wiederverwenden.
7. Orbitales 30–50-km-Raman bleibt als zukünftige `[H]`-Technologie gekennzeichnet.
8. Keine Engineering-ID wird automatisch zu einer NOXIA-ID.

## Referenzen

- NASA NIAC: https://www.nasa.gov/directorates/stmd/niac/niac-studies/interworld-slingshot-resource-surveys/
- SETI Institute: https://www.seti.org/news/a-new-way-to-find-resources-in-space/
- KUEPER Engineering: `ENG-REQ-PRR-0001`, `ENG-SYS-PRR-0001`
