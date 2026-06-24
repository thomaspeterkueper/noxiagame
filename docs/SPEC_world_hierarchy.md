# SPEC — NOXIA World Hierarchy

Stand: 24.06.2026  
Status: Architektur-Spezifikation, noch keine Pflicht-Migration

---

## Ziel

NOXIA soll langfristig nicht nur einzelne Orte im Sonnensystem verwalten, sondern eine skalierbare Weltstruktur:

```text
Sternensystem
  └ Himmelskörper
      └ Region / Orbit
          └ Kolonie / Station / Schiff / Anomalie
```

Das aktuelle `locations`-Modell reicht für Alpha, wird aber zu flach, sobald es viele Mars-Städte, Orbitalstationen, mobile Forschungsschiffe und später extrasolare Systeme gibt.

Diese Spezifikation definiert das Zielmodell, ohne sofort alle bestehenden Daten umzubauen.

---

## Grundidee

Alles, was ein Spieler besuchen, besitzen, untersuchen oder als Bezugspunkt nutzen kann, ist ein `location`.

Dazu gehören:

- Sternensysteme
- Planeten
- Monde
- Asteroiden
- Regionen
- Orbits
- Kolonien
- Raumstationen
- Raumschiffe
- Anomalien
- Forschungscampi

Ein Raumschiff ist damit nicht nur ein Inventarobjekt, sondern ein mobiler Ort.

---

## Vorgeschlagene Felder in `locations`

```sql
alter table public.locations
  add column if not exists location_class text,
  add column if not exists parent_location_id uuid references public.locations(id),
  add column if not exists is_mobile boolean not null default false,
  add column if not exists sort_order integer not null default 0;
```

Optional später:

```sql
alter table public.locations
  add column if not exists orbit_radius numeric,
  add column if not exists body_radius numeric,
  add column if not exists gravity numeric,
  add column if not exists atmosphere_type text,
  add column if not exists discovery_state text default 'known';
```

---

## `location_class`

Vorgeschlagene Werte:

```text
system       Sternensystem
body         Planet, Mond, Zwergplanet, Asteroid
orbit        Orbitraum um einen Körper
region       geografische Region auf einem Körper
settlement   Kolonie, Stadt, Basis, Außenposten
station      Raumstation, Orbitalwerft, Ringstation
ship         mobiles Schiff mit eigenem Ort-/Grid-Charakter
anomaly      Forschungsobjekt, Artefakt, Signal, ungewöhnliche Zone
site         kleiner spezieller Ort, z. B. Campus, Mine, Observatorium
```

Wichtig: `location_class` beschreibt die strukturelle Rolle, nicht zwingend die Darstellung.

Beispiele:

| Name | location_class | is_mobile |
|---|---:|---:|
| Sol | system | false |
| Mars | body | false |
| Mars Orbit | orbit | false |
| Valles Marineris | region | false |
| Camaleo | settlement | false |
| Helios Gateway | station | false |
| SS Horizon | ship | true |
| Horcher-Anomalie | anomaly | false |

---

## Hierarchie-Beispiele

### Sol / Mars

```text
Sol
└── Mars
    ├── Mars Orbit
    │   ├── Helios Gateway
    │   └── Camaleo Orbital Yard
    ├── Valles Marineris
    │   └── Camaleo
    ├── Tharsis
    │   └── Helios Prime
    └── Nordpol
        └── Eisbohrstation Borealis
```

### Sol / Erde

```text
Sol
└── Erde
    ├── Erde Orbit
    │   ├── Gateway One
    │   └── Solar Science Foundation Orbital
    ├── Frankfurt Arcology
    ├── Orbital Elevator Terminal
    └── Earth Campus
```

### Mobile Orte

```text
Sol
└── Deep Space
    ├── SS Horizon
    └── Solar Science Foundation Explorer
```

Ein Schiff kann später selbst ein Grid haben:

```text
SS Horizon
├── Brücke
├── Frachtraum
├── Reaktor
├── Habitat
└── Labor
```

Für Alpha muss das noch nicht umgesetzt werden. Wichtig ist nur: Das Datenmodell darf es nicht verhindern.

---

## Beziehung zu bestehenden Tabellen

### `locations`

Bleibt zentrale Tabelle für Orte.

Neue Logik:

- Planeten, Monde und Orbits können `locations` sein.
- Kolonien und Stationen sind ebenfalls `locations`.
- Schiffe können perspektivisch ebenfalls `locations` sein oder mit einer Location gekoppelt werden.

### `ships`

Kurzfristig bleiben Schiffe in der Tabelle `ships`.

Langfristig gibt es zwei Optionen:

#### Option A — Schiff bleibt Entity, hat optionale Location

```text
ships.location_slug
ships.current_location_id
```

Das ist einfacher für Alpha.

#### Option B — Großes Schiff wird Location

```text
locations.location_class = 'ship'
locations.is_mobile = true
```

Dann kann ein großes Schiff Gebäude, Crew, Forschung und Lager wie eine Station besitzen.

Empfehlung:

- Kleine Frachter bleiben zunächst `ships`.
- Große Forschungs-, Kolonie- oder Generationsschiffe werden später `locations` mit `location_class = 'ship'`.

---

## Beziehung zu Grids

Nicht jede Location braucht ein `ColonyGrid`.

| location_class | Grid? | Bemerkung |
|---|---:|---|
| system | nein | Systemkarte |
| body | nein oder Übersicht | Planetare Übersicht |
| orbit | nein oder Orbitkarte | Stationen/Schiffe anzeigen |
| region | optional | Regionalkarte |
| settlement | ja | ColonyGrid |
| station | ja | StationGrid / ColonyGrid-Variante |
| ship | optional | ShipGrid bei großen Schiffen |
| anomaly | optional | Forschungs-/Ereignisansicht |
| site | optional | Spezialansicht |

Das aktuelle `ColonyGrid` ist also eine lokale Ansicht, nicht die Weltkarte.

---

## Navigation

Langfristige Navigation:

```text
Sternensystemkarte
  → Körperkarte
      → Region
          → Kolonie / Station / Schiff
```

Kurzfristig darf das Dashboard weiterhin direkt eine Location öffnen.

Später sollte die Zielauswahl beim Reisen wissen:

- aktuelle Location
- Parent-Hierarchie
- erreichbare Nachbarn
- Distanz / Energie
- notwendige Forschung
- politische / wirtschaftliche Zugänge

---

## Forschung und Entdeckung

NOXIA soll Wissen als Fortschrittsmotor nutzen.

Mögliche `discovery_state`-Werte:

```text
unknown       unbekannt
observed      beobachtet
mapped        kartiert
visited       besucht
studied       untersucht
understood    verstanden
exploitable   nutzbar
```

Beispiel:

```text
Tau Ceti e
Status: observed
→ Spektralanalyse möglich
→ Orbitalsonde nötig
→ Landung erst nach Atmosphäre-Forschung
```

Dadurch wird Expansion nicht nur Handel, sondern Erkenntnisfortschritt.

---

## Migrationsstrategie

### Schritt 1 — Spezifikation

Diese Datei.

### Schritt 2 — nicht-invasive Migration

Felder ergänzen:

```sql
location_class
parent_location_id
is_mobile
sort_order
```

Bestehende Orte bleiben gültig.

### Schritt 3 — Startdaten ergänzen

Beispiele:

```text
Sol
Earth
Earth Orbit
Moon
Mars
Mars Orbit
Phobos
Prometheus L5
Camaleo
```

### Schritt 4 — UI liest Hierarchie optional

Dashboard bricht nicht, wenn `parent_location_id` leer ist.

### Schritt 5 — Weltkarte / Systemkarte

Erst später.

---

## Alpha-Regel

Diese Architektur darf Alpha 0.1 nicht blockieren.

Für Alpha gilt:

- Bestehende Location-Slugs funktionieren weiter.
- Reise- und Handelslogik bleiben stabil.
- `ColonyGrid` bleibt lokale Ansicht.
- Neue Hierarchie-Felder sind additive Vorbereitung.

---

## Offene Fragen

1. Werden kleine Frachter dauerhaft nur `ships` bleiben?
2. Ab welcher Größe wird ein Schiff eine eigene Location?
3. Brauchen Regionen eigene Märkte oder nur Kolonien?
4. Werden Orbits echte Karten oder nur Container?
5. Wird `location_class` per SQL-Enum oder bewusst als `text` geführt?

Empfehlung für Alpha: `text`, damit neue Klassen ohne Migration testbar bleiben.
