# ADR: Weltarchitektur — Sonnensystem, Grids, Stationen

**Datum:** 20.07.2026
**Status:** Accepted — Implementation ausstehend
**Priorität:** Beta+1 (nach stabiler Beta)

---

## Kontext

Das aktuelle System hat eine flache `locations`-Liste mit fixen 32×24 Grids.
Das skaliert nicht für:
- Mehrere Siedlungen auf demselben Himmelskörper
- Raumstationen in verschiedenen Umlaufbahnen
- Reisezeiten die von tatsächlicher Position abhängen
- Große Spielerzahlen mit vielen Siedlungen
- Oberflächentransportsysteme zwischen benachbarten Grids

---

## Entscheidung: Weg 2 — Saubere Migration

### Ebene 1: celestial_bodies

```sql
CREATE TABLE celestial_bodies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,          -- "Mars", "Mond", "Phobos"
  slug            text UNIQUE NOT NULL,   -- "mars", "moon", "phobos"
  body_type       text NOT NULL,          -- 'star' | 'planet' | 'moon' | 'asteroid' | 'lagrange'
  parent_id       uuid REFERENCES celestial_bodies(id),  -- Phobos → Mars
  orbit_radius_au numeric,               -- Abstand zur Sonne in AE (für Reisezeit)
  orbit_period_d  numeric,               -- Umlaufzeit in Tagen
  surface_gravity numeric DEFAULT 1.0,   -- Relative Schwerkraft (Erde=1)
  has_atmosphere  boolean DEFAULT false,
  map_x           numeric,               -- Position auf der Sonnensystem-Karte (UI)
  map_y           numeric
);
```

### Ebene 2: locations (erweitert)

```sql
ALTER TABLE locations
  ADD COLUMN celestial_body_id  uuid REFERENCES celestial_bodies(id),
  ADD COLUMN location_type      text DEFAULT 'colony',  -- 'colony' | 'station' | 'outpost'
  ADD COLUMN surface_x          integer DEFAULT 0,      -- Position auf dem Körper
  ADD COLUMN surface_y          integer DEFAULT 0,
  ADD COLUMN grid_radius        integer DEFAULT 16,     -- Aktiver Radius in Kacheln
  ADD COLUMN orbit_altitude_km  integer,               -- nur für Stationen
  ADD COLUMN orbit_inclination  numeric,               -- Umlaufneigung (0=equatorial)
  ADD COLUMN owner_id           uuid,                  -- Gründer
  ADD COLUMN founded_at         timestamptz DEFAULT now(),
  ADD COLUMN is_public          boolean DEFAULT true;  -- öffentlich sichtbar
```

### Grid-System: Dynamisch statt Fix

- **Himmelskörper** haben ein logisches Koordinatensystem (Breite/Länge oder x/y)
- **Siedlungen** haben einen `surface_x/y` Ursprung und einen `grid_radius`
- **Grid wächst** mit Bevölkerung und Infrastruktur — kein hartes Limit
- **Benachbarte Grids** können sich berühren → Oberflächentransport möglich
- **Darstellung:** Spieler sieht Karte des Himmelskörpers, wählt freien Punkt

### Reisezeit-Modell

```
Gleicher Himmelskörper (Oberfläche):
  t = surface_distance(A, B) × (1 / surface_speed)
  → Oberflächentransport: Rover, Magnetschwebebahn (später)

Gleiche Umlaufbahn (Station → Station):
  t = orbital_phase_diff × orbital_period / 360

Verschiedene Körper (Interplanetare Reise):
  t ≈ Hohmann_transfer(orbit_a, orbit_b) × ship_speed_factor
  → vereinfacht: sqrt(|orbit_a² - orbit_b²|) × Konstante

Körper → Orbit:
  t = ascent_time(gravity, altitude) × ship_thrust_factor
```

### Gründungsmechanismus

**Voraussetzungen:**
- Wissen: `UNL:NOX:NAV:ORBITAL` (für Stationen) oder `UNL:NOX:COLONY:FOUND` (neu)
- Credits: Mindestkapital (variiert nach Körper und Typ)
- Schiff: Konstruktionsschiff mit Ladekapazität für Baumaterialien

**Ablauf:**
1. Spieler öffnet Sonnensystem-Karte
2. Wählt Himmelskörper → Körper-Karte öffnet sich
3. Klickt auf freien Punkt → Koordinaten werden validiert
4. Bestätigt Gründung + zahlt Startkosten
5. `location` wird angelegt mit `grid_radius=4` (Startgröße)
6. Pflicht-Builds: Landing Pad + Lebenserhaltung (automatisch platziert)
7. Spieler muss erste Versorgungslieferung durchführen (Wasser/Energie)

**Für Stationen im Orbit:**
- Wählt Umlaufhöhe (Low/Medium/High Orbit)
- Umlaufhöhe bestimmt Reisezeit zu anderen Objekten
- Höhere Umlaufbahn = stabiler aber länger zu erreichen

### Bestehende Locations (Migration)

```sql
-- Bestehende locations bekommen celestial_body_id
UPDATE locations SET celestial_body_id = (
  SELECT id FROM celestial_bodies WHERE slug = locations.slug
), surface_x = 0, surface_y = 0, grid_radius = 16;
```

---

## Konsequenzen

- **Rendering:** Sonnensystem-Karte → Körper-Karte → Siedlungs-Grid (3 Ebenen)
- **Reisezeit:** Dynamisch aus Positionen berechnet, nicht hardcodiert
- **Schiffstypen:** Erkundungsschiff + Konstruktionsschiff als neue Klassen
- **Oberflächentransport:** Sobald zwei Grids sich berühren (future)
- **Unlock:** `UNL:NOX:COLONY:FOUND` als neues SSF-Modul (AST + ECO)

## Neue Schiffsklassen (Scope)

| Klasse | Funktion | Voraussetzung |
|--------|----------|---------------|
| Erkundungsschiff | Terrain scannen, Ressourcen sichtbar machen | NAV:ORBITAL |
| Konstruktionsschiff | Baumaterialien transportieren, Basis errichten | NAV:ORBITAL + Credits |
| Oberflächenfahrzeug | Transport zwischen Grids auf gleicher Oberfläche | (später) |

---

## Implementierungsplan

**Phase 1 — Datenbasis (nächster Schritt):**
- `celestial_bodies` Tabelle
- `locations` Migration
- Bestehende moon/mars/phobos migrieren

**Phase 2 — Gründungs-UI:**
- Sonnensystem-Karte (SVG, klickbar)
- Körper-Karte mit freien Punkten
- Gründungs-Flow + Validierung

**Phase 3 — Reisezeit:**
- Dynamische Berechnung statt hardcodierter Werte
- Schiffstypen erweitern

**Phase 4 — Oberflächentransport:**
- Benachbarte Grids verbinden
- Rover/Magnetschwebebahn
