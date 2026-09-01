// lib/game/seeds/earthStartSeed.ts
// Erstellt: 01.09.2026
// Kanonische NOXIA-Quelle für die öffentliche Earth-Startinfrastruktur.
//
// Earth ist gemeinsamer Multiplayer-Startpunkt. Der Raumhafen wird deshalb
// nicht als einzelner landing_pad modelliert, sondern als staatliche Anlage
// aus physischen Funktionsmodulen. Zusätzliche Module benötigen freie Tiles.

import type { FacilityInstance, FacilityModuleInstance } from '../facilities/types'

export const EARTH_START_LOCATION = 'earth'
export const EARTH_GRID_ROWS = 24
export const EARTH_GRID_COLS = 32

export const EARTH_STATE_OWNERSHIP = {
  ownerClass: 'STATE' as const,
  ownerId: null,
  operatorId: null,
  publicAccess: true,
}

export const EARTH_START_FACILITIES: FacilityInstance[] = [
  {
    id: 'earth_public_spaceport',
    facilityType: 'spaceport',
    name: 'Earth Public Spaceport',
    locationSlug: EARTH_START_LOCATION,
    ...EARTH_STATE_OWNERSHIP,
    moduleIds: [
      'earth_spaceport_core',
      'earth_pad_standard_1',
      'earth_pad_standard_2',
      'earth_pad_mini_1',
      'earth_spaceport_service',
      'earth_spaceport_storage',
    ],
  },
  {
    id: 'earth_public_admin',
    facilityType: 'administration',
    name: 'Earth Public Administration',
    locationSlug: EARTH_START_LOCATION,
    ...EARTH_STATE_OWNERSHIP,
    moduleIds: ['earth_admin_core'],
  },
  {
    id: 'earth_public_academy',
    facilityType: 'education',
    name: 'Earth Public Academy',
    locationSlug: EARTH_START_LOCATION,
    ...EARTH_STATE_OWNERSHIP,
    moduleIds: ['earth_academy_core'],
  },
  {
    id: 'earth_public_warehouse',
    facilityType: 'warehouse',
    name: 'Earth Public Warehouse',
    locationSlug: EARTH_START_LOCATION,
    ...EARTH_STATE_OWNERSHIP,
    moduleIds: ['earth_warehouse_core', 'earth_warehouse_storage_1'],
  },
]

// Nordöstlicher Bereich der 32×24-Earth-Karte. Das Layout nutzt den bereits
// etablierten urban/spaceport-nahen Kartenbereich, lässt aber mehrere direkte
// Erweiterungszellen frei. Keine Erweiterungsreserve ist ein unsichtbarer
// Bonus: sobald ein Spieler/eine Anlage eine benötigte Zelle legal belegt,
// kann dort nicht gleichzeitig ein neues Raumhafenmodul entstehen.
export const EARTH_START_MODULES: FacilityModuleInstance[] = [
  // Raumhafen-Kern und initiale gemeinsame Kapazität.
  { id: 'earth_spaceport_core', definitionId: 'spaceport_core', facilityId: 'earth_public_spaceport', row: 2, col: 26, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_pad_standard_1', definitionId: 'spaceport_pad_standard', facilityId: 'earth_public_spaceport', row: 1, col: 26, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_pad_standard_2', definitionId: 'spaceport_pad_standard', facilityId: 'earth_public_spaceport', row: 2, col: 27, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_pad_mini_1', definitionId: 'spaceport_pad_mini', facilityId: 'earth_public_spaceport', row: 3, col: 26, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_spaceport_service', definitionId: 'spaceport_service', facilityId: 'earth_public_spaceport', row: 2, col: 25, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_spaceport_storage', definitionId: 'spaceport_storage', facilityId: 'earth_public_spaceport', row: 3, col: 25, ...EARTH_STATE_OWNERSHIP },

  // Öffentliche Startservices in direkter, aber nicht raumhafenblockierender Nähe.
  { id: 'earth_admin_core', definitionId: 'administration_core', facilityId: 'earth_public_admin', row: 5, col: 23, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_academy_core', definitionId: 'academy_core', facilityId: 'earth_public_academy', row: 5, col: 24, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_warehouse_core', definitionId: 'warehouse_core', facilityId: 'earth_public_warehouse', row: 5, col: 25, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_warehouse_storage_1', definitionId: 'warehouse_storage', facilityId: 'earth_public_warehouse', row: 5, col: 26, ...EARTH_STATE_OWNERSHIP },
]

/**
 * Zellen, die für den nächsten plausiblen Ausbau bewusst frei gehalten werden.
 * Das ist eine Seed-/Map-Design-Vorgabe, kein ewiger Eigentumsschutz.
 */
export const EARTH_INITIAL_EXPANSION_RESERVE = [
  { row: 0, col: 26, purpose: 'spaceport-pad' },
  { row: 1, col: 25, purpose: 'spaceport-pad-or-service' },
  { row: 1, col: 27, purpose: 'spaceport-pad' },
  { row: 2, col: 28, purpose: 'spaceport-pad' },
  { row: 3, col: 27, purpose: 'spaceport-pad-or-cargo' },
  { row: 4, col: 25, purpose: 'spaceport-logistics' },
  { row: 5, col: 27, purpose: 'warehouse-expansion' },
  { row: 6, col: 24, purpose: 'academy-expansion' },
] as const

export function earthStartShipCapacity(): { parking: number; activeOperations: number } {
  // Aktuell: 2 Standard-Pads (tuning default 4) + 1 Mini-Pad (canonical 2).
  // Der Wert wird absichtlich aus dem Seed dokumentiert, nicht als globale
  // Raumhafenregel behandelt. Später soll die Runtime aus FACILITY_MODULES summieren.
  return { parking: 10, activeOperations: 3 }
}

export function validateEarthStartSeed(): string[] {
  const issues: string[] = []
  const occupied = new Set<string>()

  for (const module of EARTH_START_MODULES) {
    if (module.row < 0 || module.row >= EARTH_GRID_ROWS || module.col < 0 || module.col >= EARTH_GRID_COLS) {
      issues.push(`${module.id}: outside-grid (${module.row},${module.col})`)
      continue
    }
    const key = `${module.row}:${module.col}`
    if (occupied.has(key)) issues.push(`${module.id}: duplicate-cell ${key}`)
    occupied.add(key)
  }

  for (const reserve of EARTH_INITIAL_EXPANSION_RESERVE) {
    const key = `${reserve.row}:${reserve.col}`
    if (occupied.has(key)) issues.push(`expansion-reserve occupied: ${key}`)
  }

  for (const facility of EARTH_START_FACILITIES) {
    for (const moduleId of facility.moduleIds) {
      const module = EARTH_START_MODULES.find(candidate => candidate.id === moduleId)
      if (!module) issues.push(`${facility.id}: missing module ${moduleId}`)
      else if (module.facilityId !== facility.id) issues.push(`${module.id}: wrong facility ${module.facilityId}`)
    }
  }

  return issues
}
