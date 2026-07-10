# WORLD-0002 — World Model: Orte, Kacheln, Lagerstätten und Prozesse

**Status:** Accepted  
**Version:** 1.0.0  
**Created:** 2026-07-10  
**Scope:** NOXIA world simulation  

## Entscheidung

NOXIA modelliert die Spielwelt primär als Hierarchie von **Orten**. Gebäude sind Werkzeuge, die natürliche Eigenschaften eines Ortes nutzen oder künstlich verändern.

```text
Universe
└── Location
    └── Region
        └── Tile
            ├── Natural State
            │   ├── Terrain
            │   ├── Geology
            │   ├── Environment
            │   └── Deposits
            └── Artificial State
                ├── Infrastructure
                ├── Buildings
                └── Processes
```

Die erste Implementierungsstufe bleibt bewusst einfach. Das Datenmodell muss jedoch spätere Rohstoffkreisläufe, detaillierte Lagerstätten, Scans, Infrastruktur und Terraforming aufnehmen können, ohne das Grundmodell zu ersetzen.

## Zuständigkeiten

### Location

Ein globaler Spielort, zum Beispiel Erde, Mond, Mars, Asteroid oder Raumstation.

Verantwortlich für:

- globale Umweltparameter
- Erreichbarkeit und Reisebeziehungen
- Regionen und Karten
- Standortregeln

Ein `Location`-Typ kann auch ein Raumschiff oder eine Station sein. Nicht jeder Location-Typ besitzt zwingend natürliche Kacheln oder Lagerstätten.

### Region

Makroebene innerhalb einer Location.

Verantwortlich für:

- grobe Klima- und Geologieverteilung
- Karten-/Sektorgrenzen
- spätere Erkundungs- und Besitzlogik

Phase 1 darf Regionen implizit behandeln. Die Ebene wird dennoch im Modell reserviert.

### Tile

Lokale spielbare Fläche.

Ein Tile besitzt zwei klar getrennte Zustände:

1. **Natural State** — vom Ort vorgegebene Eigenschaften
2. **Artificial State** — durch Spieler oder Simulation erzeugte Veränderungen

Natürliche Eigenschaften werden nicht direkt durch ein Gebäude ersetzt. Ein Gebäude liegt auf einem Tile und nutzt dessen Eigenschaften.

### Deposit

Eine konkrete Lagerstätte auf einem Tile.

Ein Deposit ist keine abstrakte Ressource und kein Produkt. Es beschreibt das natürliche Vorkommen, aus dem später Rohstoffe gewonnen werden.

```text
Material
→ Deposit
→ Extracted Resource / Handelsgut
→ Processed Product
→ Component / End Product
```

Ein Deposit trägt mindestens:

- `resourceClass`
- `materialKey`
- `richness`
- `remainingAmount`
- `discoveryState`

Später ergänzbar:

- Tiefe
- Mächtigkeit
- Reinheit
- Temperatur
- Härte
- Förderkosten
- Begleitminerale

### Infrastructure

Künstliche Verbindungen und Flächenzustände, zum Beispiel:

- Straße
- Stromleitung
- Wasserleitung
- Pipeline
- Schiene
- Fundament
- Scanner

Infrastruktur ist nicht automatisch ein Gebäude. Sie kann mehrere Tiles verbinden oder ein Tile vorbereiten.

### Building

Vom Spieler oder NPC errichtetes Bauwerk.

Gebäude:

- belegen Tiles
- starten oder beherbergen Prozesse
- besitzen Inputs und Outputs
- reagieren auf Tile-Eignung
- verändern nicht die natürliche Geologie

### Process

Produktions- oder Umwandlungslogik.

Beispiele:

- Eis fördern
- Wasser aufbereiten
- Elektrolyse
- Erz brechen
- Metall schmelzen
- Komponenten fertigen

Prozesse werden langfristig von Gebäuden getrennt. Dadurch kann dasselbe Gebäude unterschiedliche Technologien oder Produktionsweisen nutzen.

## Phase 1 — vereinfachtes Modell

Für die erste spielbare Runde besitzt jede Oberflächenkachel:

```ts
{
  terrain: 'plain' | 'rock' | 'ice' | 'sand' | 'crater',
  buildSuitability: 'good' | 'normal' | 'poor',
  solarPotential: number,
  deposits: DepositSummary[],
  discoveryState: 'known'
}
```

Phase 1 verwendet nur wenige Materialklassen:

- `water_ice`
- `metal_ore`
- optional `none`

Die Spieleroberfläche zeigt zunächst nur:

- Terrain
- vorhandene grobe Lagerstätte
- Bau-Eignung
- Ertrags- oder Effizienzfaktor

## Phase 1 — Eignungsregeln

| Gebäude | Phase-1-Regel |
|---|---|
| Solarfeld | überall baubar; Ertrag über `solarPotential` |
| Mine | nur sinnvoll bei `metal_ore`; ohne Lagerstätte nicht baubar |
| Eisbohrer | nur bei `water_ice` baubar |
| Habitat | grundsätzlich baubar; Kosten/Effizienz nach Bau-Eignung |
| Servicegebäude | grundsätzlich baubar; Bau-Eignung beeinflusst spätere Wartung |

Die UI muss drei Zustände unterscheiden:

- **optimal** — fachlich sinnvoll und effizient
- **possible** — technisch möglich, aber ineffizient
- **blocked** — Voraussetzung fehlt

## Discovery State

Die natürliche Welt wird später nicht vollständig offengelegt.

Vorgesehene Stufen:

```text
unknown
→ surveyed
→ scanned
→ confirmed
```

Phase 1 darf alle Informationen als `known` beziehungsweise `confirmed` behandeln. Das Modell darf jedoch keine Annahme enthalten, dass Lagerstätten immer sichtbar sind.

## Resource Classes

`resourceClass` liegt auf der **Deposit-Instanz**, nicht nur auf einer globalen Materialdefinition.

Vorgesehene Klassen:

- `ubiquitous` — praktisch überall vorhanden, wirtschaftlich aber unterschiedlich
- `localized` — räumlich begrenzte Lagerstätte
- `unique` — einzigartiges oder strategisches Vorkommen

Diese Klassifikation beeinflusst später:

- Welterzeugung
- Landwert
- Handel
- Konfliktpotenzial
- strategische Infrastruktur

## Kreisläufe

Das Modell muss vollständige Stoff- und Produktionskreisläufe erlauben.

Beispiel Wasser-/Treibstoffkreislauf:

```text
water_ice deposit
→ Eisförderung
→ Wasseraufbereitung
→ Wasser
├── Lebenserhaltung
└── Elektrolyse
    ├── Sauerstoff
    └── Wasserstoff
        → Treibstoffproduktion
        → Raumfahrt
```

Beispiel Metallkreislauf:

```text
metal_ore deposit
→ Erzförderung
→ Aufbereitung
→ Metall
→ Bauteile
→ Maschinen
→ neue Gebäude und Infrastruktur
```

Phase 1 darf `water`, `energy`, `metal`, `components` weiterverwenden. Diese bestehenden Ressourcen sind Übergangs-Handelsgüter, nicht das endgültige Materialmodell.

## Kompatibilitätsregeln

1. Bestehende `BuildingDef`-Einträge bleiben gültig.
2. Bestehende Ressourcen `water`, `energy`, `metal`, `components` bleiben zunächst erhalten.
3. Tile-Eignung ergänzt den Bauprozess, ersetzt ihn nicht sofort.
4. Keine bestehende Kachel erhält durch diese Entscheidung zwingend neue DB-Felder.
5. Datenbankmigrationen erfolgen in einem separaten, kleinen Commit.
6. Bestehende Bauoptionen müssen ohne Tile-Analyse weiterhin einen neutralen Fallback erhalten.

## Source of Truth

- Weltstruktur und Eignungsregeln: NOXIA
- Wissenschaftliche Lerninhalte: SSF
- Wissens-/Claim-Struktur: Knowledge Graph

SSF darf erklären, warum eine Kachel geeignet ist. SSF entscheidet jedoch nicht, welche konkrete Lagerstätte in einer NOXIA-Weltinstanz liegt.

## Nicht Bestandteil dieser Entscheidung

- konkrete DB-Migration
- Weltgenerator
- detaillierte Mineralogie
- Terraforming-Simulation
- Infrastruktur-Netzgraph
- Produktionsrezept-Datenbank
- Landmarkt und Bodensteuer

Diese Punkte bauen später auf WORLD-0002 auf.

## Nächste Implementierungsschritte

1. `lib/game/world/types.ts` als neutrales Domänenmodell
2. deterministischer Phase-1-Tile-Analyzer
3. Bauoptionen um `suitability` erweitern
4. Kachel-Overlay mit „Was ist hier / Wie geeignet / Warum?“
5. erst danach persistente Deposits und Scans
