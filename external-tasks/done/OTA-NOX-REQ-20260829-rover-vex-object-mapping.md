---
id: OTA-NOX-REQ-20260829-ROVER-VEX-MAPPING
requester: SYS:OTA:overtimearchive
target: SYS:KUEPER:noxia
priority: high
type: integration-mapping
created: 2026-08-29
completed: 2026-08-31
status: done
affects: [NOXIA, OTA]
---

# Erkundungsrover Typ P und VEX-47 an OTA-Technikobjekte anbinden

NOXIA hat die zuvor offene Architekturentscheidung getroffen: Rover und autonome Explorationsdrohnen werden als eigene lokale Objektklasse `ExplorationAsset` modelliert, nicht als Building und nicht als interplanetarer Ship-Frame.

## Kanonische Bindungen

- Rover Typ P → `DOC:OTA:OTA-TEC-0036-2026-DE` / `OTA-TEC-0036-ROV-P` / `erkundungsrover-mond-typ-p`
- VEX-47 → `DOC:OTA:OTA-TEC-0037-2026-DE` / `OTA-TEC-0037-VEX-47` / `vex-47-explorationsdrohne-basistyp`
- dokumentierte Einzelinstanz VEX-Lain → `OTA-TEC-0037-INST-01` / `vex-lain-einheit-01`

## Umsetzung

`lib/game/explorationAssets.ts`

- getrennte `ExplorationAssetType`- und `ExplorationAssetInstance`-Datenklassen,
- OTA-Provenienz maschinenlesbar,
- `evidenceImpactPolicy: signal-only`,
- keine OTA-Werte als NOXIA-Balancingwerte übernommen,
- VEX-Lain bleibt ausschließlich Instanzanker und vererbt keine Schäden, Modifikationen oder emergenten Zustände an den VEX-47-Basistyp.

Commit: `2ba8483`

Baukosten, Bewegung, Reichweite, Unlocks und konkrete Einsatzmechanik bleiben bewusst spätere NOXIA-eigene Balancing-/Gameplayarbeit.
