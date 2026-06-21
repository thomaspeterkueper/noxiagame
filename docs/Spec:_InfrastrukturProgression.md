# Spec: Infrastruktur-Progression

Stand: 21.06.2026 · Status: Konzept, Implementierung läuft
Vorgänger: SPEC_gebaeude_katalog.md, SPEC_solar_academy.md

---

## Vision

Jede Station beginnt als unbewohnter Ort. Infrastruktur entsteht
schrittweise — zuerst Landing, dann Handel, dann Produktion, dann
Wissen. Spieler erschließen neue Orte aktiv statt sie vorzufinden.

Das schafft echte Entscheidungen: Wo baue ich zuerst? Was brauche
ich wirklich? Und es macht Multiplayer interessant — wer erschließt
neue Stationen zuerst?

---

## Erreichbarkeit ohne Landeplatz

Neue Stationen/Monde/Asteroiden ohne Landeplatz:
- Nur erreichbar mit **Lander-Schiff** (späteres Feature)
- Normale Frachter können nicht landen
- Im Reise-Overlay: Station ausgegraut + "Kein Landeplatz — Lander benötigt"
- Spieler kann Landeplatz bauen → dann normal erreichbar

**Ausnahme:** Staatliche Stationen (Erde, Mond, Mars, Phobos) haben
immer einen staatlichen Landeplatz — neue private Stationen nicht.

---

## Staatliche Startausstattung (aktuell)

| Station | Admin | Landeplatz | Werft | Akademie | Warenhaus |
|---------|-------|------------|-------|----------|-----------|
| Erde    | ✅    | ✅          | ✅    | ✅        | ✅         |
| Mond    | ✅    | ✅          | ✅    | —         | —          |
| Mars    | ✅    | ✅          | —     | —         | —          |
| Phobos  | ✅    | ✅          | —     | —         | —          |

Werft nur auf Erde + Mond zu Beginn (Industriestationen).
Kann überall gebaut werden sobald Voraussetzungen erfüllt.

---

## Gebäude-Voraussetzungen

### Aktuell implementiert (keine Prereqs)
- Mine, Solarfeld, Habitat, Scanner, Eisbohrung, Wasserrecycler, Akademie

### Geplant mit Prereqs

| Gebäude | Kosten | Voraussetzung | Standort |
|---------|--------|--------------|---------|
| Landeplatz | 3.000 Cr | — | alle |
| Werft | 12.000 Cr | Landeplatz auf dieser Station | alle |
| Warenhaus | 4.000 Cr | — | alle |
| Geothermie | 5.000 Cr | Landeplatz + 500 Wissenspunkte | Mars, Mond |
| ISRU-Anlage | 8.000 Cr | Werft + 2.000 Wissenspunkte | alle |
| Relay-Turm | 6.000 Cr | 1.000 Wissenspunkte | alle |
| Handelskontor | 10.000 Cr | Warenhaus + 500 Wissenspunkte | alle |
| Fusionsreaktor | 25.000 Cr | Werft + 5.000 Wissenspunkte | alle |

### Prereq-Typen
```typescript
interface BuildPrereq {
  building?:       string    // entity_id eines Gebäudes auf dieser Station
  knowledge?:      number    // min. knowledge_points des Spielers
  location?:       string[]  // erlaubte Standorte (wie allowedLocations)
  shipType?:       string    // benötigter Schiffstyp (für Lander später)
}
```

---

## Dashboard-Vereinfachung

Gebäude ersetzen Dashboard-Buttons:

| Gebäude | Öffnet | Ersetzt aktuell |
|---------|--------|-----------------|
| Landeplatz | Reise-Overlay + Sonnensystem-Karte | Fliegen-Buttons |
| Werft | Schiffskauf/-reparatur/-ausbau | ShipyardOverlay |
| Verwaltung | AdminOverlay | Stationsbüro-Button |
| Akademie | SchoolOverlay | — |
| Warenhaus | Handelszentrale (Kauf/Verkauf) | MarketAuction |

**Was im Dashboard bleibt:**
- Topbar: Position, Credits, Ladung, Energie-Vorrat
- Kolonien-Tab: Grid (Hauptspielfläche)
- Statistiken-Tab: Handelshistorie, Wissen, Impact
- Aufträge-Tab: offene Aufträge

**Was verschwindet:**
- Separate Fliegen-Buttons
- ShipyardCard als Dashboard-Element
- Stationsbüro-Button

---

## Landeplatz-Overlay (Zielzustand)

Klick auf Landeplatz → LandingOverlay:

```
┌─────────────────────────────────────────┐
│ 🛸 Landeplatz · Mond / Shackleton       │
├─────────────────────────────────────────┤
│ [Sonnensystem-Karte mit Live-Positionen]│
│  Erde ──── Mond(hier) ────── Mars       │
│                    \── Phobos           │
├─────────────────────────────────────────┤
│ Ziel      Distanz  Zeit   Energie  Preis│
│ 🌍 Erde   8 AE     8s     8t       —   │
│ 🔴 Mars   45 AE    45s    12t      —   │
│ 🪨 Phobos 10 AE    10s    10t      —   │
├─────────────────────────────────────────┤
│ Ladung: 80t Wasser · 12t Energie       │
│ [Fliegen →]  [Abbrechen]               │
└─────────────────────────────────────────┘
```

Sonnensystem-Karte: SolarSystem.tsx bereits vorhanden — einbinden.

---

## Implementierungs-Reihenfolge

### Sprint 1 (nächste Session): Staatliche Gebäude
1. Migration 021: Werft auf Erde + Mond als state_owned
2. `config.ts`: landing_pad + shipyard mit Kosten/Prereqs
3. `build route`: Prereq-Check

### Sprint 2: Dashboard-Vereinfachung
4. LandingOverlay (Reise + Sonnensystem)
5. ShipyardOverlay ins Grid (Klick auf Werft)
6. MarketOverlay für Warenhaus
7. Dashboard-Buttons entfernen

### Sprint 3: Prereq-System vollständig
8. Prereq-Anzeige im Bau-Dialog
9. Technologie-Freischaltungen (Solar Academy)
10. Lander-Schiff als Konzept vorbereiten

---

## Offene Fragen

- **Schiffsreparatur:** Gibt es Verschleiß? Aktuell nicht implementiert.
  Wenn Werft auch repariert: brauchen wir `condition`-Verfall.
- **Werft-Monopol:** Wenn nur Erde+Mond Werften haben — entstehen
  interessante Handelsrouten (Schiffe kaufen → woanders einsetzen).
- **Private Stationen:** Spieler baut eigene Station auf Asteroid →
  kein staatlicher Landeplatz → Spieler baut als erstes Landeplatz.
  Reihenfolge erzwingt sich von selbst.
- **Lander-Schiff:** Kleines, teures Schiff für unbewohnte Orte.
  Geringes Fassungsvermögen, aber kann ohne Landeplatz landen.
  Wann kommt das? Vermutlich Alpha 0.4-0.5.

---

## Querverweise

- Gebäude-Sprites: BuildingSVG.tsx (landing_pad, shipyard vorhanden)
- Staatliche Gebäude: Migration 013, 019
- Sonnensystem-Karte: SolarSystem.tsx
- Solar Academy Prereqs: SPEC_solar_academy.md
- Orbitalmechanik: lib/game/orbits.ts, lib/game/ships.ts
