# Spec: Gebäude-Katalog

Stand: 20.06.2026 · Status: laufend aktualisiert
Zweck: Übersicht aller Gebäudetypen — was baubar ist, was vorbereitet ist,
was nur geplant. Quelle der Wahrheit für BUILDABLE_ITEMS + PLANNED_BUILDINGS.

Prinzip: Ein Gebäude wird erst baubar, wenn es eine ECHTE Funktion hat.
Keine leeren Hülsen — sie kosten Spielgeld ohne Gegenwert und verwässern
den 15-Minuten-Loop. Vorbereitete Typen erscheinen im Bau-Dialog als
ausgegraute „geplant"-Einträge.

Standort-Regel: `allowedLocations` in BUILDABLE_ITEMS schränkt ein.
Undefined = überall baubar. Standortfremde Gebäude: ausgegraut mit Hinweis.

Staatliche Gebäude: `is_state_owned = true`, `profile_id = null`.
Erkennbar an blauem Rahmen im Grid. Werden bei Stationsgründung automatisch
gesetzt (admin immer zuerst, Mitte des Grids row=3, col=5).

## Legende
- **baubar**: in BUILDABLE_ITEMS, hat Funktion, kostet Credits
- **staatlich**: existiert als tile_entity, is_state_owned=true, nicht kaufbar
- **geplant**: in PLANNED_BUILDINGS, ausgegraut sichtbar, noch nicht kaufbar
- **Sprite**: existiert in lib/grid/BuildingSVG.tsx (✓) oder fehlt (—)

---

## Baubare Gebäude (BUILDABLE_ITEMS)

| entity_id       | Name           | Kosten | Ticks | Effekt                        | Standort | Sprite |
|-----------------|----------------|--------|-------|-------------------------------|----------|--------|
| mine            | Mine           | 1.500  | 2     | +5 Metall/Tick                | alle     | ✓      |
| solar           | Solarfeld      | 1.200  | 1     | +4 Energie/Tick               | alle     | ✓      |
| habitat         | Habitat        | 2.000  | 3     | +100 max. Bevölkerung         | alle     | ✓      |
| scanner         | Scanner        | 1.800  | 2     | Anomalien sichtbar            | alle     | ✓      |
| ice_drill       | Eisbohrung     | 2.500  | 3     | +4 Wasser/Tick                | moon     | ✓ (ice)|
| water_recycler  | Wasserrecycler | 2.000  | 2     | +2 Wasser/Tick                | mars     | ✓      |
| school          | Akademie       | 3.000  | 4     | Wissens-Terminal, +Wachstum   | alle     | ✓      |

### Akademie-Details
- Klick → Aufgaben-Overlay (dynamisch generiert, Kolonie-Kontext)
- Richtige Antwort → knowledge_points auf Spieler-Profil
- Stationsbonus: +0–0.5% Wachstum/Tick wenn Spieler Akademie hat + Wissen
- Rate-Limit: 10 Aufgaben/Stunde

---

## Staatliche Gebäude (is_state_owned = true)

| entity_id | Name        | Position        | Funktion                              | Sprite |
|-----------|-------------|-----------------|---------------------------------------|--------|
| admin     | Verwaltung  | row=3, col=5    | AdminOverlay (Aufträge, Finanzen)     | ✓      |

Weitere staatliche Gebäude bei Stationsgründung: zukünftige Stationen
bekommen ggf. Werft, Landeplatz etc. als staatliche Startausstattung.

---

## Geplante Gebäude (PLANNED_BUILDINGS — ausgegraut im Dialog)

| entity_id       | Name           | Geplante Funktion              | Sprite |
|-----------------|----------------|--------------------------------|--------|
| warehouse       | Warenhaus      | Lagerkapazität erhöhen         | ✓      |
| tank            | Silo           | Flüssigkeits-/Gasspeicher      | ✓      |
| oxygen_recycler | O₂-Recycler    | Lebenserhaltung                | ✓      |
| smelter         | Schmelze       | Metall → Bauteile              | ✓      |
| admin           | Verwaltung     | → staatlich, nicht baubar*     | ✓      |
| bar             | Bar            | Zufriedenheit                  | —      |

\* admin ist staatlich vorhanden, nicht durch Spieler kaufbar (zunächst).
  Zukünftig: Spieler kann eigene Verwaltung bauen und Gouverneur werden
  → Transaktionsgebühren fließen dann in die eigene Tasche.

---

## Sprites in BuildingSVG.tsx (vollständig)

Alle Sprites in der Premium-Edition (Stand 20.06.):

**Extraktion:** solar, mine, ice, geothermal, ice_drill (alias ice)
**Verarbeitung:** isru, smelter, electrolysis, water_plant, water_recycler
**Leben:** habitat, hydroponics, oxygen_recycler
**Lager:** tank, warehouse
**Fabrikation:** parts_factory
**Logistik:** landing_pad, relay_tower, trade_depot
**Wissenschaft:** school, scanner
**Administration:** admin, command_center, governor, embassy
**Militär:** barracks, defense
**Infrastruktur:** power_plant, fusion
**Spezial:** monument, temple

Sprites ohne Funktion (vorbereitet für spätere Features):
geothermal, isru, electrolysis, water_plant, hydroponics, oxygen_recycler,
parts_factory, landing_pad, relay_tower, trade_depot, command_center,
governor, embassy, barracks, defense, power_plant, fusion, monument, temple

---

## Nächste Schritte (wenn ein Typ baubar werden soll)

1. Funktion definieren (was bewirkt es pro Tick / im Kolonie-Zustand?)
2. Sprite sicherstellen (BuildingSVG)
3. BUILDABLE_ITEMS-Eintrag (Kosten, Bauzeit, Wirkung, allowedLocations?)
4. Wirkung in tick.ts verdrahten (Produktionsbonus oder neuer Effekt)
5. Aus PLANNED_BUILDINGS entfernen / aus „geplant" in „baubar" verschieben

---

## Querverweise

- Verwaltung (admin): AdminOverlay, Migration 013+014
- Akademie (school): SchoolOverlay, Migration 017, knowledge_route
- Eisbohrung (ice_drill): tick.ts iceDrillBonus, nur moon
- Wasserrecycler (water_recycler): tick.ts recyclerBonus, nur mars
- relay_tower/trade_depot: Backlog „Präsenz-Prinzip"
- warehouse: Backlog Handelszentrale ins Grid
- Werft (shipyard): existiert als ShipyardOverlay, noch kein Grid-Gebäude
