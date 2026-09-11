---
id: EXT-NOXIA-GRAPHICS-20260911-SURFACE-LOGISTICS-ASSETS
title: Grafik / Assets – Bodenlogistik, Cargo-Rover, Hauler und Frachtmodule
status: open
source: NOXIA-CORE
target: NOXIA-GRAPHICS
created: 2026-09-11
priority: medium
affects: [NOXIA, Graphics, Vehicles, Logistics]
---

## Ausgangspunkt

NOXIA führt physische Surface Logistics ein. Fahrzeuge werden damit erstmals funktionale Spielobjekte: Sie transportieren reale Waren zwischen Mine, Lager, Fabrik, Logistik-Hub und Shuttle-Port.

Dieser Request betrifft ausschließlich **Darstellung und Asset-Produktion**. Gameplay-Werte, Persistenz, Inventare, Fahrzeugzustände, Routing und Transportjobs werden nicht im Grafik-Chat definiert.

## Auftrag

Bitte eine konsistente visuelle Fahrzeug-/Cargo-Familie für NOXIA vorbereiten. Priorität zunächst Moon/Shackleton, danach dieselbe Designsprache für Mars und Earth adaptierbar.

Benötigte Rollen:

1. kleiner Cargo Rover / Utility Transporter,
2. Heavy Hauler für Erz/Metall,
3. modularer Flatbed-/Container-Transporter,
4. Loader bzw. Umschlagfahrzeug für Mine/Lager,
5. standardisierte Cargo-Container/Paletten/Erzbehälter,
6. visuelle Ladezustände: leer, teilweise beladen, voll,
7. Karten-/Cockpit-Symbole für Fahrzeug, Transportauftrag, Laden, Entladen, blockierte Route,
8. optional Trailer/Anhänger als modularer visueller Baustein.

## Gestaltungsanforderungen

- klar NOXIA, technisch plausibel, funktional statt militärisch,
- Fahrzeugrollen müssen schon in kleiner Kartenansicht unterscheidbar sein,
- Assets müssen zur bestehenden Gebäude-/Terrain-Sprache passen,
- Moon-Version staub-/vakuumtauglich und ohne unnötige aerodynamische Formen,
- später Earth/Mars-Varianten möglich, ohne komplett neue Assetfamilie zu benötigen.

## Abgrenzung

Nicht definieren oder ändern:

- Fahrzeugkapazitäten,
- Geschwindigkeit/Energieverbrauch,
- Routing,
- Backend/API/Supabase,
- Transportjob-Zustände,
- Ownership oder Economy.

Der Grafik-Chat liefert nur visuelle Assets und Integrationshinweise.

## Erwartetes Ergebnis

- Asset-Liste und Priorisierung,
- erste Moon/Shackleton-Fahrzeugfamilie,
- Cargo-/Container-Bausteine,
- HUD-/Kartenicons,
- Ablage direkt an den passenden Stellen des `noxiagame`-Repos gemäß bestehender Assetstruktur,
- Response/Handoff an `NOXIA-CORE`, welche Assets/IDs verfügbar sind.

## Acceptance Criteria

1. mindestens Cargo Rover und Heavy Hauler visuell unterscheidbar,
2. Cargo ist am Fahrzeug sichtbar bzw. UI-seitig eindeutig darstellbar,
3. Assets funktionieren für Kartenansicht und Detailansicht,
4. keine Gameplay-Logik wird im Grafik-Chat implementiert,
5. Assetstruktur bleibt für Earth/Mars wiederverwendbar.

## References

- existing NOXIA building/vehicle asset structure
- `lib/game/buildings/visuals.ts`
- Moon/Shackleton visual implementation
- `external-tasks/open/EXT-NOXIA-MOON-20260911-surface-logistics.md`
