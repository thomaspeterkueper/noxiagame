# NOXIA Orbit Architecture v1

Stand: 10.09.2026
Status: Accepted baseline for implementation

## Ziel

NOXIA verwendet genau eine gemeinsame räumliche Architektur für Erde, Mond, Planeten, Monde, Lagrange-Stationen, Orbitstationen und später frei fliegende Schiffe. Die vorhandene Orbital-Engine in `lib/game/orbits.ts` bleibt der mathematische Kern und wird erweitert statt ersetzt.

## Bestehende Bausteine

- `lib/game/orbits.ts`: deterministische Positionen aus Basisparametern + Spieltick, hierarchische Orbits, `{x,y,z}`, Inklination und Knoten vorbereitet.
- `app/dashboard/SolarSystem.tsx`: Visualisierung als Konsument der Orbital-Engine.
- `app/dashboard/StationOverlay.tsx`: Stationsansicht mit Modulen, Ressourcen, Bevölkerung, Eigentum und Bau.
- `app/dashboard/StationTravelDock.tsx`: Stationsseitiger Reise-/Docking-Flow.
- `lib/game/stationModules.ts`: gemeinsamer Stationsmodulkatalog.
- `lib/game/ships.ts`: Reisezeit-/Energiekopplung an den Orbit-Kernel.
- bestehende Surface-/Earth-Architektur: Referenz für Auswahl, Zoom, räumliche Objekte und Bauzonen.

## Identität der bisherigen Prometheus-Station

Die bisher als `Prometheus` bezeichnete Station wird in **Kepler Station** umbenannt.

Kanonisch:

- Name: `Kepler Station`
- Slug: `kepler`
- Typ: Lagrange station
- System: Sonne–Erde
- Punkt: L5
- Phase: 60° hinter der Erde
- Orbit: heliozentrisch, gleiche mittlere Bahnperiode wie die Erde

Der bisherige Slug `prometheus` ist ab 10.09.2026 deprecated und ausschließlich als temporärer Runtime-/Datenkompatibilitätsalias zulässig. Er darf nicht mehr für neue Daten, UI-Texte oder neue Features verwendet werden.

## Architekturprinzip

Persistiert werden stabile Basisdaten und Identitäten. Zeitabhängige Positionen werden berechnet.

```text
Celestial body / orbital object
        +
Orbit definition
        +
Game tick / epoch
        ↓
computed state {x,y,z,...}
        ↓
map / distance / transfer / visibility / docking
```

Keine periodischen Positionsupdates in der Datenbank. Kein `Date.now()` im Simulationskern. Keine zweite Orbit-Engine in UI oder API.

## Objektklassen

### 1. CelestialBody

Sonne, Erde, Mond, Mars, Phobos usw. Körper besitzen physikalische und kartografische Eigenschaften und können Oberflächenkarten haben.

### 2. OrbitalNode

Nicht-surfacegebundene stationäre Infrastruktur:

- Lagrange-Station
- planetare Orbitstation
- Depot
- Werft
- Forschungsplattform
- Relay

### 3. Spacecraft

Bewegliche Objekte. Schiffe dürfen langfristig nicht als `location` missbraucht werden, sondern besitzen einen eigenen dynamischen Zustand und können an Locations/Nodes docken.

### 4. SurfaceLocation

Siedlungen, Basen, Raumhäfen, Minen und andere Orte auf einer Körperoberfläche. Sie benutzen das gemeinsame Body-/Geodäsiesystem und nicht den Orbit-Koordinatenraum als lokale Baukarte.

## Koordinatenebenen

NOXIA trennt drei Ebenen sauber:

1. **System frame** – Positionen der Himmelskörper und orbitalen Objekte.
2. **Body frame** – geodätische Position auf Erde/Mond/Mars usw.
3. **Local frame** – Bau-, Gebäude- und Interaktionsraum eines konkreten Standorts.

Transformationen verbinden die Ebenen. UI-Komponenten speichern keine eigenen konkurrierenden Koordinatenmodelle.

## Orbitmodell v1

Das bestehende Interface wird beibehalten und später additiv erweitert:

```ts
interface OrbitParams {
  parent: string | null
  radius: number
  period: number
  phase: number
  incl?: number
  node?: number
}
```

Nächste additive Felder, sobald echte Orbitmechanik benötigt wird:

- `eccentricity`
- `argumentOfPeriapsis`
- `epochTick`
- `orbitClass`
- optional reale Referenzwerte in km/s bzw. SI zusätzlich zur Gameplay-Skalierung

Die Spielzeit darf weiterhin komprimiert sein; Geometrie und Beziehungen sollen jedoch konsistent bleiben.

## Lagrange-Punkte

L4/L5 werden nicht als gewöhnliche planetare Kreisbahn modelliert. Sie sind gebundene orbital nodes relativ zum Primär-/Sekundärsystem. Kepler Station ist der erste kanonische Anwendungsfall.

Für die aktuelle Engine bleibt die vorhandene äquivalente Darstellung über gleiche Periode, gleichen Radius und ±60° Phase zulässig. Die Datenstruktur soll später explizit `lagrange` als Orbit-/Node-Klasse ausdrücken können.

## Stationen

`StationOverlay` und `stationModules.ts` bleiben bestehen. Eine Station besteht logisch aus:

```text
OrbitalNode
  └─ Station
      ├─ modules
      ├─ storage
      ├─ population / staff
      ├─ docking ports
      ├─ ownership
      ├─ energy / life support
      └─ construction state
```

Stationen werden damit nicht als Sonderfall einer Surface-Kolonie behandelt, können aber dieselben Wirtschaft-, Eigentums-, Personal- und Bau-Subsysteme wiederverwenden.

## Reise

`orbitalBaseSeconds()` bleibt vorerst die gemeinsame Basisfunktion. Die heutige euklidische Distanz × Gameplay-Faktor ist eine Alpha-Näherung.

Die spätere Erweiterung trennt:

- geometrische Distanz
- Transferklasse
- Delta-v-/Energiebedarf
- Flugzeit
- Schiffsfähigkeit
- Start-/Ankunftsfenster

Damit verschwindet langfristig die derzeitige Vermischung von Reichweite in Sekunden und echter räumlicher Reichweite.

## Kepler-Migration

Die Umbenennung erfolgt zweistufig, um bestehende Spielstände nicht zu beschädigen.

### Phase A – jetzt

- Anzeigename überall auf `Kepler Station` umstellen.
- `kepler` im Orbit-Kernel als kanonischen Schlüssel einführen.
- `prometheus` als deprecated Alias behalten.
- neue Features und neue Daten ausschließlich mit `kepler` entwickeln.

### Phase B – atomare Persistenzmigration

Vor Entfernung des Alias müssen alle persistierten Referenzen inventarisiert werden, insbesondere:

- `locations.slug`
- Spieler-/Schiffsstandorte
- Transit-/Journey-Ziele
- Cargo-/Market-/Resource-Bezüge mit Location-Slug
- Missions-/Tutorialstatus
- Seed-/Bootstrap-Daten
- FK- oder Check-Constraints
- serverseitige RPCs/Views/Functions

Danach werden alle Referenzen in einer Migration von `prometheus` auf `kepler` umgestellt. Erst nach erfolgreicher Verifikation darf der Alias aus Code, `LocationSlug`, Energie-Matrix und Gravity-Matrix entfernt werden.

## Invarianten

1. Ein kanonisches Objekt besitzt genau eine kanonische ID/Slug.
2. Anzeigenamen sind keine technischen Schlüssel.
3. Zeitabhängige Orbitpositionen werden berechnet, nicht fortgeschrieben.
4. Surface- und Orbitkoordinaten werden nicht vermischt.
5. UI berechnet keine eigene Physik.
6. Reise, Karte und Stationen beziehen ihren Zustand aus derselben räumlichen Quelle.
7. Kompatibilitätsaliases sind temporär und explizit deprecated.

## Nächste Implementierungsschritte

1. Kepler-Anzeigename in Sonnensystem-, Reise- und Stations-UI vollständig ersetzen.
2. Persistierte `prometheus`-Referenzen und DB-Abhängigkeiten inventarisieren.
3. `LocationSlug`/Energie-/Gravity-Konstanten auf `kepler` vorbereiten.
4. atomare Slug-Migration erstellen und testen.
5. Alias entfernen.
6. Orbitobjekte aus der flachen `locations`-Semantik herauslösen bzw. über klaren Typ/Relation differenzieren.
7. Earth-/Moon-Body-Map und Orbit-Map über gemeinsame World-Navigation verbinden.
