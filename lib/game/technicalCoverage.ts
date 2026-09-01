// lib/game/technicalCoverage.ts
// NOXIA-eigener Coverage-Katalog fuer technische Spielobjekte.
//
// Er beantwortet:
// 1. Welche technischen Typen kennt NOXIA?
// 2. Ist bereits externe technische Provenienz gebunden?
// 3. Falls nicht: hat NOXIA die Luecke bereits an ein zustaendiges System uebergeben?
//
// Wichtig:
// - NOXIA erfindet hier keine OTA-/KG-/SSF-IDs.
// - "unmapped" beweist nicht, dass extern kein Dossier existiert.
// - Ein Handoff spiegelt NICHT den Live-Status des Ziel-Repositories.
// - Kosten, Leistung, Slots, Unlocks und andere Spielwerte bleiben NOXIA-owned.

import { BUILDINGS } from './buildings'
import { EXPLORATION_ASSET_TYPES } from './explorationAssets'
import { SHIP_FRAMES, SHIP_MODULES } from './ships'
import {
  TECHNICAL_COVERAGE_HANDOFFS,
  type TechnicalCoverageHandoff,
} from './technicalCoverageRequests'

export type TechnicalCoverageKind =
  | 'building'
  | 'ship_frame'
  | 'ship_module'
  | 'exploration_asset'

export type TechnicalCoverageStatus = 'mapped' | 'unmapped'

export type TechnicalCoverageProvenance = {
  sourceSystem: 'OTA'
  sourceDocumentId: string
  canonicalId: string
  objectId: string
  mappingRole: 'buildable' | 'reference'
  evidenceImpactPolicy: 'signal-only'
}

export type TechnicalCoverageEntry = {
  key: string
  localId: string
  name: string
  kind: TechnicalCoverageKind
  status: TechnicalCoverageStatus
  planned: boolean
  sourceFile: string
  provenance: TechnicalCoverageProvenance | null
  handoff: TechnicalCoverageHandoff | null
}

function entryKey(kind: TechnicalCoverageKind, localId: string) {
  return `${kind}:${localId}`
}

function handoffFor(kind: TechnicalCoverageKind, localId: string) {
  return TECHNICAL_COVERAGE_HANDOFFS[entryKey(kind, localId)] ?? null
}

export function getTechnicalCoverageEntries(): TechnicalCoverageEntry[] {
  const buildings: TechnicalCoverageEntry[] = Object.values(BUILDINGS).map((building) => ({
    key: entryKey('building', building.id),
    localId: building.id,
    name: building.name,
    kind: 'building',
    status: building.externalTechnicalObject ? 'mapped' : 'unmapped',
    planned: Boolean(building.planned),
    sourceFile: 'lib/game/buildings/index.ts',
    provenance: building.externalTechnicalObject ?? null,
    handoff: handoffFor('building', building.id),
  }))

  const shipFrames: TechnicalCoverageEntry[] = Object.values(SHIP_FRAMES).map((frame) => ({
    key: entryKey('ship_frame', frame.id),
    localId: frame.id,
    name: frame.name,
    kind: 'ship_frame',
    status: 'unmapped',
    planned: false,
    sourceFile: 'lib/game/ships.ts',
    provenance: null,
    handoff: handoffFor('ship_frame', frame.id),
  }))

  const shipModules: TechnicalCoverageEntry[] = Object.values(SHIP_MODULES).map((module) => ({
    key: entryKey('ship_module', module.id),
    localId: module.id,
    name: module.name,
    kind: 'ship_module',
    status: 'unmapped',
    planned: false,
    sourceFile: 'lib/game/ships.ts',
    provenance: null,
    handoff: handoffFor('ship_module', module.id),
  }))

  const explorationAssets: TechnicalCoverageEntry[] = Object.values(EXPLORATION_ASSET_TYPES).map((asset) => ({
    key: entryKey('exploration_asset', asset.id),
    localId: asset.id,
    name: asset.name,
    kind: 'exploration_asset',
    status: 'mapped',
    planned: false,
    sourceFile: 'lib/game/explorationAssets.ts',
    provenance: asset.provenance,
    handoff: handoffFor('exploration_asset', asset.id),
  }))

  return [...buildings, ...shipFrames, ...shipModules, ...explorationAssets]
    .sort((a, b) => a.key.localeCompare(b.key))
}

export type TechnicalCoverageSummary = {
  total: number
  mapped: number
  unmapped: number
  handedOff: number
  actionableGaps: number
  activeTotal: number
  activeMapped: number
  activeUnmapped: number
  activeActionableGaps: number
  byKind: Record<TechnicalCoverageKind, {
    total: number
    mapped: number
    unmapped: number
    handedOff: number
    actionableGaps: number
  }>
}

export function getTechnicalCoverageSummary(entries = getTechnicalCoverageEntries()): TechnicalCoverageSummary {
  const byKind: TechnicalCoverageSummary['byKind'] = {
    building: { total: 0, mapped: 0, unmapped: 0, handedOff: 0, actionableGaps: 0 },
    ship_frame: { total: 0, mapped: 0, unmapped: 0, handedOff: 0, actionableGaps: 0 },
    ship_module: { total: 0, mapped: 0, unmapped: 0, handedOff: 0, actionableGaps: 0 },
    exploration_asset: { total: 0, mapped: 0, unmapped: 0, handedOff: 0, actionableGaps: 0 },
  }

  let mapped = 0
  let handedOff = 0
  let actionableGaps = 0
  let activeTotal = 0
  let activeMapped = 0
  let activeActionableGaps = 0

  for (const entry of entries) {
    const bucket = byKind[entry.kind]
    bucket.total += 1

    if (entry.status === 'mapped') {
      mapped += 1
      bucket.mapped += 1
    } else {
      bucket.unmapped += 1
      if (entry.handoff) {
        handedOff += 1
        bucket.handedOff += 1
      } else {
        actionableGaps += 1
        bucket.actionableGaps += 1
      }
    }

    if (!entry.planned) {
      activeTotal += 1
      if (entry.status === 'mapped') activeMapped += 1
      if (entry.status === 'unmapped' && !entry.handoff) activeActionableGaps += 1
    }
  }

  return {
    total: entries.length,
    mapped,
    unmapped: entries.length - mapped,
    handedOff,
    actionableGaps,
    activeTotal,
    activeMapped,
    activeUnmapped: activeTotal - activeMapped,
    activeActionableGaps,
    byKind,
  }
}

export function getTechnicalCoverageReport() {
  const entries = getTechnicalCoverageEntries()
  return {
    schemaVersion: '1.1',
    generatedFrom: [
      'lib/game/buildings/index.ts',
      'lib/game/ships.ts',
      'lib/game/explorationAssets.ts',
      'lib/game/technicalCoverageRequests.ts',
    ],
    semantics: {
      mapped: 'NOXIA has an explicit read-only external technical provenance binding.',
      unmapped: 'NOXIA has no explicit provenance binding yet; this does not prove that the external dossier is missing.',
      handoff: 'NOXIA recorded an outbound request for the gap. Target-repository live status remains target-owned.',
      actionableGap: 'An unmapped NOXIA object for which no outbound handoff is recorded yet.',
    },
    summary: getTechnicalCoverageSummary(entries),
    entries,
  }
}
