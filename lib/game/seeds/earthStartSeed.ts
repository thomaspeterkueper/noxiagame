// lib/game/seeds/earthStartSeed.ts
// Erstellt: 01.09.2026
// Aktualisiert: 02.09.2026 — Earth-Start kanonisch als Tharsis Hub Sauerland verankert.
// Kanonische NOXIA-Quelle für die öffentliche Earth-Startinfrastruktur.
//
// Der gemeinsame Multiplayer-Start liegt realweltlich im Sauerland (NRW, Deutschland).
// Die Spielkarte bildet keinen Katasterplan ab, sondern eine verdichtete, topografisch
// glaubwürdige 32×24-Repräsentation des Standorts mit Wald, Talraum, Landwirtschaft,
// Siedlungsanschluss und dem modularen Tharsis Hub.

import type { FacilityInstance, FacilityModuleInstance } from '../facilities/types'

export const EARTH_START_LOCATION = 'earth'
export const EARTH_START_SITE_ID = 'tharsis_hub_sauerland'
export const EARTH_START_SITE_NAME = 'Tharsis Hub Sauerland'
export const EARTH_START_REGION = 'Sauerland'
export const EARTH_START_COUNTRY = 'Deutschland'
export const EARTH_START_STATE = 'Nordrhein-Westfalen'
export const EARTH_START_REFERENCE_MUNICIPALITY = 'Sundern (Sauerland)'
export const EARTH_START_ANCHOR_PRECISION = 'regional' as const
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
    name: 'Tharsis Hub Sauerland',
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
    name: 'Tharsis Hub Verwaltung',
    locationSlug: EARTH_START_LOCATION,
    ...EARTH_STATE_OWNERSHIP,
    moduleIds: ['earth_admin_core'],
  },
  {
    id: 'earth_public_academy',
    facilityType: 'education',
    name: 'Tharsis Hub Akademie',
    locationSlug: EARTH_START_LOCATION,
    ...EARTH_STATE_OWNERSHIP,
    moduleIds: ['earth_academy_core'],
  },
  {
    id: 'earth_public_warehouse',
    facilityType: 'warehouse',
    name: 'Tharsis Hub Logistik',
    locationSlug: EARTH_START_LOCATION,
    ...EARTH_STATE_OWNERSHIP,
    moduleIds: ['earth_warehouse_core', 'earth_warehouse_storage_1'],
  },
]

// Südöstlicher Tal-/Infrastrukturraum der Sauerland-Karte. Der Hub liegt auf einer
// vorbereiteten Hardstand-Zone am Rand bestehender Siedlungs- und Verkehrsstruktur.
// Der Waldgürtel und der Fluss/Talzug bleiben sichtbar und machen den Earth-Start
// unverwechselbar gegenüber Mars, Mond und generischen Stadtstandorten.
export const EARTH_START_MODULES: FacilityModuleInstance[] = [
  { id: 'earth_spaceport_core', definitionId: 'spaceport_core', facilityId: 'earth_public_spaceport', row: 19, col: 26, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_pad_standard_1', definitionId: 'spaceport_pad_standard', facilityId: 'earth_public_spaceport', row: 18, col: 26, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_pad_standard_2', definitionId: 'spaceport_pad_standard', facilityId: 'earth_public_spaceport', row: 19, col: 27, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_pad_mini_1', definitionId: 'spaceport_pad_mini', facilityId: 'earth_public_spaceport', row: 20, col: 26, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_spaceport_service', definitionId: 'spaceport_service', facilityId: 'earth_public_spaceport', row: 19, col: 25, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_spaceport_storage', definitionId: 'spaceport_storage', facilityId: 'earth_public_spaceport', row: 20, col: 25, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_admin_core', definitionId: 'administration_core', facilityId: 'earth_public_admin', row: 21, col: 25, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_academy_core', definitionId: 'academy_core', facilityId: 'earth_public_academy', row: 21, col: 26, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_warehouse_core', definitionId: 'warehouse_core', facilityId: 'earth_public_warehouse', row: 21, col: 27, ...EARTH_STATE_OWNERSHIP },
  { id: 'earth_warehouse_storage_1', definitionId: 'warehouse_storage', facilityId: 'earth_public_warehouse', row: 21, col: 28, ...EARTH_STATE_OWNERSHIP },
]

export const EARTH_INITIAL_EXPANSION_RESERVE = [
  { row: 17, col: 26, purpose: 'spaceport-pad' },
  { row: 18, col: 25, purpose: 'spaceport-pad-or-service' },
  { row: 18, col: 27, purpose: 'spaceport-pad' },
  { row: 18, col: 28, purpose: 'spaceport-heavy-or-passenger' },
  { row: 19, col: 28, purpose: 'spaceport-pad-or-cargo' },
  { row: 20, col: 27, purpose: 'spaceport-logistics' },
  { row: 20, col: 28, purpose: 'warehouse-expansion' },
  { row: 22, col: 26, purpose: 'academy-expansion' },
] as const

export function earthStartShipCapacity(): { parking: number; activeOperations: number } {
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
