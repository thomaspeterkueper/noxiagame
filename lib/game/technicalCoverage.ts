// lib/game/technicalCoverage.ts
// Erstellt: 31.08.2026
//
// NOXIA-eigener Coverage-Katalog fuer technische Spielobjekte.
// Er beantwortet nur: Welche technischen Typen kennt NOXIA und ist fuer sie
// bereits eine externe technische Provenienz gebunden?
//
// Wichtig:
// - NOXIA erfindet hier keine OTA-IDs.
// - "unmapped" bedeutet nicht, dass im OTA kein Dossier existiert; nur, dass
//   NOXIA aktuell keine belastbare Provenienzbindung besitzt.
// - Kosten, Leistung, Slots, Unlocks und andere Spielwerte bleiben NOXIA-owned.

import { BUILDINGS } from './buildings'
import { EXPLORATION_ASSET_TYPES } from './explorationAssets'
import { SHIP_FRAMES, SHIP_MODULES } from './ships'

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
}

function entryKey(kind: TechnicalCoverageKind, localId: string) {
  return `${kind}:${localId}`
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
  }))

  return [...buildings, ...shipFrames, ...shipModules, ...explorationAssets]
    .sort((a, b) => a.key.localeCompare(b.key))
}

export type TechnicalCoverageSummary = {
  total: number
  mapped: number
  unmapped: number
  activeTotal: number
  activeMapped: number
  activeUnmapped: number
  byKind: Record<TechnicalCoverageKind, { total: number; mapped: number; unmapped: number }>
}

export function getTechnicalCoverageSummary(entries = getTechnicalCoverageEntries()): TechnicalCoverageSummary {
  const byKind: TechnicalCoverageSummary['byKind'] = {
    building: { total: 0, mapped: 0, unmapped: 0 },
    ship_frame: { total: 0, mapped: 0, unmapped: 0 },
    ship_module: { total: 0, mapped: 0, unmapped: 0 },
    exploration_asset: { total: 0, mapped: 0, unmapped: 0 },
  }

  let mapped = 0
  let activeTotal = 0
  let activeMapped = 0

  for (const entry of entries) {
    const bucket = byKind[entry.kind]
    bucket.total += 1

    if (entry.status === 'mapped') {
      mapped += 1
      bucket.mapped += 1
    } else {
      bucket.unmapped += 1
    }

    if (!entry.planned) {
      activeTotal += 1
      if (entry.status === 'mapped') activeMapped += 1
    }
  }

  return {
    total: entries.length,
    mapped,
    unmapped: entries.length - mapped,
    activeTotal,
    activeMapped,
    activeUnmapped: activeTotal - activeMapped,
    byKind,
  }
}

export function getTechnicalCoverageReport() {
  const entries = getTechnicalCoverageEntries()
  return {
    schemaVersion: '1.0',
    generatedFrom: [
      'lib/game/buildings/index.ts',
      'lib/game/ships.ts',
      'lib/game/explorationAssets.ts',
    ],
    semantics: {
      mapped: 'NOXIA has an explicit read-only external technical provenance binding.',
      unmapped: 'NOXIA has no explicit provenance binding yet; this does not prove that the external dossier is missing.',
    },
    summary: getTechnicalCoverageSummary(entries),
    entries,
  }
}
