// lib/game/seeds/tharsisHubPowerModel.ts
// Erstellt: 02.09.2026
// Bottom-up-Energie- und Lastabwurfmodell für Tharsis Hub gemäß OTA-Freigabe.

import { THARSIS_HUB_BUILDINGS } from './tharsisHubSeed'

export type PowerLoadClass = 'A' | 'B' | 'C'

export interface PowerLoadProfile {
  class: PowerLoadClass
  normalMw: number
  peakMw: number
}

/**
 * Explizite Verbraucherprofile pro gebautem Seed-Objekt.
 * Keine population×kW-Näherung: Gesamtlast entsteht ausschließlich durch
 * konkrete Anlagen plus separat benannte betriebliche Lasten.
 */
export const THARSIS_BUILDING_POWER_PROFILES: Record<string, PowerLoadProfile> = {
  habitat_cluster:  { class: 'A', normalMw: 0.12, peakMw: 0.14 },
  eclss_hub:        { class: 'A', normalMw: 0.22, peakMw: 0.24 },
  water_isru:       { class: 'A', normalMw: 0.08, peakMw: 0.10 },
  medical_core:     { class: 'A', normalMw: 0.12, peakMw: 0.14 },
  medical_annex:    { class: 'A', normalMw: 0.06, peakMw: 0.08 },
  command_node:     { class: 'A', normalMw: 0.05, peakMw: 0.06 },
  longrange_comms:  { class: 'A', normalMw: 0.03, peakMw: 0.04 },
  reactor_module:   { class: 'A', normalMw: 0.03, peakMw: 0.03 },
  black_start:      { class: 'A', normalMw: 0.02, peakMw: 0.02 },
  radiator_field:   { class: 'A', normalMw: 0.03, peakMw: 0.04 },

  logistics_hub:    { class: 'B', normalMw: 0.20, peakMw: 0.28 },
  reserve_depot:    { class: 'B', normalMw: 0.03, peakMw: 0.04 },
  workshop_clean:   { class: 'B', normalMw: 0.15, peakMw: 0.20 },
  material_complex: { class: 'B', normalMw: 0.15, peakMw: 0.22 },
  surface_relay:    { class: 'B', normalMw: 0.02, peakMw: 0.03 },
  landing_pad:      { class: 'B', normalMw: 0.08, peakMw: 0.12 },

  workshop_heavy:   { class: 'C', normalMw: 0.25, peakMw: 0.50 },
  plant_module:     { class: 'C', normalMw: 0.25, peakMw: 0.45 },
}

export interface OperationalPowerLoad extends PowerLoadProfile {
  id: string
  label: string
}

export const THARSIS_OPERATIONAL_POWER_LOADS: OperationalPowerLoad[] = [
  {
    id: 'vehicle_charging',
    label: 'Nichtkritische Fahrzeugladung',
    class: 'C',
    normalMw: 0.30,
    peakMw: 1.00,
  },
  {
    id: 'heavy_isru_batch',
    label: 'Schwere ISRU-/Fertigungscharge',
    class: 'C',
    normalMw: 0.70,
    peakMw: 1.50,
  },
]

export const THARSIS_BLACK_START_STORAGE = [
  { id: 'black_start_1', storageMwh: 2.5 },
  { id: 'black_start_2', storageMwh: 2.5 },
  { id: 'black_start_3', storageMwh: 2.5 },
] as const

export const THARSIS_LOAD_SHEDDING_ORDER: PowerLoadClass[] = ['C', 'B', 'A']

export interface PowerTotals {
  classA: number
  classB: number
  classC: number
  total: number
}

function roundMw(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function calculateTharsisPower(mode: 'normal' | 'peak' = 'normal'): PowerTotals {
  const totals: Record<PowerLoadClass, number> = { A: 0, B: 0, C: 0 }

  for (const building of THARSIS_HUB_BUILDINGS) {
    const profile = THARSIS_BUILDING_POWER_PROFILES[building.entityId]
    if (!profile) continue
    totals[profile.class] += mode === 'normal' ? profile.normalMw : profile.peakMw
  }

  for (const load of THARSIS_OPERATIONAL_POWER_LOADS) {
    totals[load.class] += mode === 'normal' ? load.normalMw : load.peakMw
  }

  return {
    classA: roundMw(totals.A),
    classB: roundMw(totals.B),
    classC: roundMw(totals.C),
    total: roundMw(totals.A + totals.B + totals.C),
  }
}

export function installedTharsisPowerMw(): number {
  return roundMw(
    THARSIS_HUB_BUILDINGS
      .filter(building => building.entityId === 'reactor_module')
      .reduce((sum, building) => sum + (building.nominalPowerMw ?? 0), 0),
  )
}

export function availablePowerAfterDomainFailure(complexId: string): number {
  return roundMw(
    THARSIS_HUB_BUILDINGS
      .filter(building => building.entityId === 'reactor_module' && building.complexId !== complexId)
      .reduce((sum, building) => sum + (building.nominalPowerMw ?? 0), 0),
  )
}

export function blackStartStorageMwh(): number {
  return THARSIS_BLACK_START_STORAGE.reduce((sum, node) => sum + node.storageMwh, 0)
}

export interface TharsisPowerIssue { message: string }

export function validateTharsisPowerModel(): TharsisPowerIssue[] {
  const issues: TharsisPowerIssue[] = []
  const normal = calculateTharsisPower('normal')
  const peak = calculateTharsisPower('peak')
  const installed = installedTharsisPowerMw()

  const uncovered = [...new Set(
    THARSIS_HUB_BUILDINGS.map(building => building.entityId),
  )].filter(entityId => !THARSIS_BUILDING_POWER_PROFILES[entityId])

  if (uncovered.length > 0) {
    issues.push({ message: `Ohne explizites Leistungsprofil: ${uncovered.join(', ')}` })
  }

  if (normal.classA < 1.5 || normal.classA > 2.5) {
    issues.push({ message: `Kritische Dauerlast ${normal.classA} MW außerhalb 1,5–2,5 MW` })
  }
  if (normal.total < 3 || normal.total > 5) {
    issues.push({ message: `Normallast ${normal.total} MW außerhalb 3–5 MW` })
  }
  if (peak.total < 5 || peak.total > 8) {
    issues.push({ message: `Spitzenlast ${peak.total} MW außerhalb 5–8 MW` })
  }
  if (installed < 7 || installed > 8) {
    issues.push({ message: `Installierte Nennleistung ${installed} MW außerhalb 7–8 MW` })
  }

  const storage = blackStartStorageMwh()
  if (storage < 6 || storage > 10) {
    issues.push({ message: `Black-Start-Speicher ${storage} MWh außerhalb 6–10 MWh` })
  }

  for (const complexId of ['energy_complex_1', 'energy_complex_2', 'energy_complex_3']) {
    const remaining = availablePowerAfterDomainFailure(complexId)
    if (remaining < normal.classA) {
      issues.push({ message: `${complexId}: N-1 lässt ${remaining} MW, Klasse A benötigt ${normal.classA} MW` })
    }
  }

  if (THARSIS_LOAD_SHEDDING_ORDER.join('>') !== 'C>B>A') {
    issues.push({ message: 'Lastabwurf-Reihenfolge muss C → B → A sein' })
  }

  return issues
}
