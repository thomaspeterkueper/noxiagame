---
id: EXT-NOXIA-GRAPHICS-20260911-SURFACE-LOGISTICS-ASSETS
title: Grafik / Assets – game-ready Bodenlogistik, Cargo-Rover, Hauler und Frachtmodule
status: open
source: NOXIA-CORE
target: NOXIA-GRAPHICS
created: 2026-09-11
priority: high
affects: [NOXIA, Graphics, Vehicles, Logistics, Moon]
---

## Verbindliche Produktionsspezifikation

**Vor jeder Bildgenerierung vollständig lesen und befolgen:**

`docs/assets/surface-logistics-vehicle-production-spec.md`

Dieser Request ist **keine Aufforderung zu freiem Concept Art**. Ziel sind direkt nutzbare, integrierte Spielassets.

`done` bedeutet ausdrücklich: **Asset erzeugt + korrekt abgelegt + im Katalog registriert + im realen Spielrenderer geprüft**.

Ein schönes Einzelbild ohne Integration ist nicht erledigt.

## Ausgangspunkt

NOXIA führt physische Surface Logistics ein. Fahrzeuge werden damit erstmals funktionale Spielobjekte: Sie transportieren reale Waren zwischen Mine, Lager, Fabrik, Logistik-Hub und Shuttle-Port.

Moon hat inzwischen die erste konkrete Gameplay-Policy geliefert:

- `docs/design/moon-surface-logistics.md`
- `lib/game/moonSurfaceLogistics.ts`

Dort sind für Shackleton zunächst genau zwei Fahrzeugrollen verbindlich:

- `cargo-rover`
- `heavy-hauler`

Engineering besitzt weiterhin Masse, Nutzlast, Fahrwerk, absolute Geschwindigkeit, Energiebedarf und reale Mobilitätsgrenzen. Diese Werte dürfen im Grafik-Chat nicht erfunden oder durch das Bild kanonisiert werden.

## Pflicht-Preflight vor Generierung

Der Grafik-Chat muss zuerst prüfen:

1. `docs/NOXIA-VISUAL-BIBLE.md`
2. `public/assets/README.md`
3. `lib/assets/catalog.ts`
4. `lib/assets/BuildingVisual.tsx`
5. `docs/assets/mars-vertical-slice.md`
6. `docs/design/moon-surface-logistics.md`
7. `lib/game/moonSurfaceLogistics.ts`
8. vorhandene `public/assets/buildings/*/*/exterior-isometric.webp`
9. den aktuellen Moon-/Shackleton-Renderer und die tatsächliche Darstellungsgröße auf der Karte

Danach ein kurzes Preflight-Protokoll festhalten: Referenzassets, Kamera/Projektion, Rendergröße, Anchor/Footprint-Annahmen und offene technische Punkte.

**Erst danach Bildgenerierung.**

## Arbeitsreihenfolge – nicht überspringen

### Gate 1 – Rollen-/Silhouettenprüfung

Zunächst nur Cargo Rover und Heavy Hauler als gemeinsame technische Vergleichsansicht entwickeln:

- gleiche 3/4-Isometrie,
- gleiche Lichtführung,
- transparenter bzw. neutraler Arbeitsgrund für die Vergleichsansicht,
- klare relative Größenordnung,
- jeweils leerer Ladezustand,
- ein standardisiertes Cargo-Modul als Größenreferenz.

Noch keine zehn Varianten und keine große Bildserie.

### Gate 2 – ein einziger Game-Ready Prototyp

Nur:

`cargo-rover / moon / exterior-isometric`

Dieser Prototyp muss:

- als freigestelltes WebP vorliegen,
- zur bestehenden NOXIA-Bildsprache passen,
- auf der realen Shackleton-Karte lesbar sein,
- korrekt verankert/skaliert sein,
- über die Asset-Pipeline eingebunden sein,
- einen funktionalen Fallback behalten.

Erst nach erfolgreichem In-Game-Test darf der Batch weitergehen.

### Gate 3 – Moon Vertical Slice

Danach:

1. Heavy Hauler,
2. Loader/Umschlaggerät,
3. offener Erz-/Bulkbehälter,
4. geschlossener Standardcontainer,
5. Flatbed-/Palettenladung,
6. Ladezustände `empty`, `partial`, `full`,
7. Karten-/HUD-Symbole für Fahrzeug, Auftrag, Laden, Entladen, blockierte Route.

### Gate 4 – Bewegung

Keine frei generierten inkonsistenten Richtungsbilder.

Directional Sprites / Animation erst dann, wenn der aktuelle Renderer sie wirklich nutzt und der statische Vertical Slice integriert ist. Bevorzugt kontrollierte 4-/8-Richtungs-Sätze bzw. Sprite-Strips.

### Gate 5 – Earth/Mars

Erst nach erfolgreichem Moon-Slice. Keine komplett neuen Fahrzeugfamilien; dieselbe funktionale Grundfamilie wird umweltabhängig adaptiert.

## Bildsprache – harte Grenzen

Gesucht:

- Near-Future,
- funktional,
- reparierbar,
- modular,
- industriell,
- wissenschaftlich plausibel,
- helle technische Flächen + dunkle Strukturteile,
- sichtbare Wartungs-/Befestigungspunkte,
- Moon: grauer Regolithstaub, harte Schatten, kein atmosphärischer Dunst.

Nicht akzeptieren:

- Concept-Art-Szene statt freigestelltem Asset,
- Horizont/Landschaft/Himmel im Fahrzeugbild,
- Cyberpunk-Neon,
- Fantasy-Sci-Fi,
- militärische APC-/Panzeroptik,
- Rennfahrzeugästhetik,
- übertriebene Monster-Truck-Räder,
- zufällige Logos/Beschriftungen,
- Personen als fester Bestandteil des Assets,
- wechselnde Kamera oder Fahrzeuggeometrie zwischen Ladezuständen,
- erfundene technische Kenndaten.

## Asset-Ablage

Die bestehende Rasterasset-Pipeline ist verbindlich. Präsentationsassets definieren keine Spielidentität.

Zielstruktur gemäß Produktionsspezifikation, z. B.:

```text
public/assets/vehicles/<role>/<world>/exterior-isometric.webp
public/assets/vehicles/<role>/<world>/load-empty.webp
public/assets/vehicles/<role>/<world>/load-partial.webp
public/assets/vehicles/<role>/<world>/load-full.webp
public/assets/cargo/<cargo-role>/<world>/exterior-isometric.webp
public/assets/ui/logistics/*.svg
```

Falls die vorhandene Pipeline eine Anpassung braucht, `lib/assets/catalog.ts` sauber erweitern oder generalisieren. Keine Bildpfade wild in Komponenten hardcoden.

## Abgrenzung

Nicht definieren oder ändern:

- Fahrzeugkapazitäten,
- Masse,
- technische Abmessungen als Kanon,
- Geschwindigkeit/Energieverbrauch,
- Routing,
- Backend/API/Supabase,
- Transportjob-Zustände,
- Ownership oder Economy.

Der Grafik-Chat darf Präsentationscode/Asset-Katalog für seine Assets anpassen, aber keine Gameplay-Domain bauen.

## Abnahme

Vor `done` mindestens nachweisen:

1. Silhouette bei normaler Kartenzoomstufe lesbar,
2. Cargo Rover und Heavy Hauler sofort unterscheidbar,
3. Größenrelation Fahrzeug ↔ Gebäude ↔ Cargo plausibel,
4. transparenter Hintergrund/saubere Alpha-Kante,
5. Asset steht korrekt am Boden und schwebt nicht,
6. `empty/partial/full` visuell eindeutig,
7. gleiche Kamera/Licht/Materialsprache über Varianten,
8. funktionaler Fallback bleibt erhalten,
9. Dateien sind im Repo referenziert und nicht bloß abgelegt,
10. tatsächlicher In-Game-Test auf Shackleton durchgeführt.

## Rückgabe an Core

Bitte am Ende melden:

- erzeugte Dateien/Pfade,
- visuelle Rollen/Worlds,
- Katalog-/Renderer-Änderungen,
- In-Game-Teststatus,
- Commit/PR,
- bewusst offene technische Details,
- noch benötigte Core-/Engineering-Entscheidungen.

## References

- `docs/assets/surface-logistics-vehicle-production-spec.md`
- `docs/NOXIA-VISUAL-BIBLE.md`
- `docs/design/moon-surface-logistics.md`
- `lib/game/moonSurfaceLogistics.ts`
- `public/assets/README.md`
- `lib/assets/catalog.ts`
- `lib/assets/BuildingVisual.tsx`
- `external-tasks/open/EXT-NOXIA-MOON-20260911-surface-logistics.md`
