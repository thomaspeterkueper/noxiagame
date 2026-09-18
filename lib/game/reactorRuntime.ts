// lib/game/reactorRuntime.ts
// Pure read-only projection helpers for authoritative reactor runtime state.
// Runtime state owns mode/availability only. Nominal MW remains engineering metadata.

export const REACTOR_RUNTIME_SCHEMA_VERSION = 1 as const
export const REACTOR_RUNTIME_SUBJECT_TYPE = 'reactor_runtime' as const

export type ReactorRuntimeMode = 'unknown' | 'online' | 'derated' | 'offline'

export interface ReactorRuntimeAssetInput {
  tileEntityId: string
  nominalPowerMw: number | null
}

export interface ReactorRuntimeStateRow {
  subjectId: string
  properties: unknown
  sourceEvent: string | null
  canonicalStateId: string | null
  validFrom: string | null
}

export interface ReactorRuntimeObservation {
  tileEntityId: string
  status: 'observed' | 'missing' | 'invalid'
  mode: ReactorRuntimeMode | null
  availabilityFactor: number | null
  availablePowerMw: number | null
  reasonCode: string | null
  sourceRef: string | null
  issue: string | null
}

export type AvailableReactorPowerObservation =
  | {
      status: 'observed'
      valueMw: number
      sourceRef: string
    }
  | {
      status: 'unresolved'
      reason: string
    }

export interface ReactorRuntimeSummary {
  totalReactors: number
  observedStates: number
  knownStates: number
  unresolvedStates: number
  reactors: ReactorRuntimeObservation[]
  availablePowerMw: AvailableReactorPowerObservation
}

type RuntimeProperties = {
  schemaVersion: 1
  mode: ReactorRuntimeMode
  availabilityFactor: number | null
  reasonCode: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function runtimeProperties(value: unknown): RuntimeProperties | null {
  if (!isRecord(value)) return null
  if (value.schemaVersion !== REACTOR_RUNTIME_SCHEMA_VERSION) return null

  // Runtime state must not duplicate engineering nameplate data or its own
  // derived MW projection. Those values belong to canonical engineering data
  // and the read model respectively.
  if ('nominalPowerMw' in value || 'availablePowerMw' in value) return null

  const mode = value.mode
  if (mode !== 'unknown' && mode !== 'online' && mode !== 'derated' && mode !== 'offline') return null

  const factor = value.availabilityFactor
  let reasonCode: string | null
  if (value.reasonCode === null) {
    reasonCode = null
  } else if (typeof value.reasonCode === 'string') {
    reasonCode = value.reasonCode
  } else {
    return null
  }

  if (mode === 'unknown') {
    if (factor !== null) return null
    return { schemaVersion: 1, mode, availabilityFactor: null, reasonCode }
  }

  if (typeof factor !== 'number' || !Number.isFinite(factor)) return null
  if (mode === 'online' && factor !== 1) return null
  if (mode === 'offline' && factor !== 0) return null
  if (mode === 'derated' && !(factor > 0 && factor < 1)) return null

  return { schemaVersion: 1, mode, availabilityFactor: factor, reasonCode }
}

function roundMw(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function buildReactorRuntimeSummary(input: {
  assets: readonly ReactorRuntimeAssetInput[]
  currentStates: readonly ReactorRuntimeStateRow[]
}): ReactorRuntimeSummary {
  const rowsBySubject = new Map<string, ReactorRuntimeStateRow[]>()
  for (const row of input.currentStates) {
    const rows = rowsBySubject.get(row.subjectId) ?? []
    rows.push(row)
    rowsBySubject.set(row.subjectId, rows)
  }

  const reactors: ReactorRuntimeObservation[] = input.assets.map(asset => {
    const rows = rowsBySubject.get(asset.tileEntityId) ?? []
    if (rows.length === 0) {
      return {
        tileEntityId: asset.tileEntityId,
        status: 'missing',
        mode: null,
        availabilityFactor: null,
        availablePowerMw: null,
        reasonCode: null,
        sourceRef: null,
        issue: 'No authoritative reactor_runtime state exists for this reactor.',
      }
    }

    if (rows.length !== 1) {
      return {
        tileEntityId: asset.tileEntityId,
        status: 'invalid',
        mode: null,
        availabilityFactor: null,
        availablePowerMw: null,
        reasonCode: null,
        sourceRef: null,
        issue: 'Multiple current reactor_runtime states exist for one reactor.',
      }
    }

    const row = rows[0]
    const parsed = runtimeProperties(row.properties)
    if (!parsed) {
      return {
        tileEntityId: asset.tileEntityId,
        status: 'invalid',
        mode: null,
        availabilityFactor: null,
        availablePowerMw: null,
        reasonCode: null,
        sourceRef: null,
        issue: 'Stored reactor_runtime properties violate the E2a contract.',
      }
    }

    const nominalPowerMw = asset.nominalPowerMw
    const nominalValid = typeof nominalPowerMw === 'number' && Number.isFinite(nominalPowerMw) && nominalPowerMw > 0
    const known = parsed.mode !== 'unknown' && parsed.availabilityFactor !== null

    return {
      tileEntityId: asset.tileEntityId,
      status: 'observed',
      mode: parsed.mode,
      availabilityFactor: parsed.availabilityFactor,
      availablePowerMw: known && nominalValid
        ? roundMw(nominalPowerMw * parsed.availabilityFactor!)
        : null,
      reasonCode: parsed.reasonCode,
      sourceRef: row.canonicalStateId
        ? `core:entity_states:${row.canonicalStateId}`
        : row.sourceEvent
          ? `core:simulation_events:${row.sourceEvent}`
          : `core:entity_states:reactor_runtime:${asset.tileEntityId}`,
      issue: !nominalValid
        ? 'Canonical nominal reactor power is missing or invalid.'
        : parsed.mode === 'unknown'
          ? 'Runtime mode is explicitly unknown.'
          : null,
    }
  })

  const observedStates = reactors.filter(reactor => reactor.status === 'observed').length
  const knownStates = reactors.filter(
    reactor => reactor.status === 'observed' && reactor.mode !== 'unknown' && reactor.availablePowerMw !== null,
  ).length
  const unresolvedStates = reactors.length - knownStates

  let availablePowerMw: AvailableReactorPowerObservation
  if (input.assets.length === 0) {
    availablePowerMw = {
      status: 'unresolved',
      reason: 'No live reactor assets are available for runtime observation.',
    }
  } else if (unresolvedStates > 0) {
    availablePowerMw = {
      status: 'unresolved',
      reason: `${unresolvedStates} of ${reactors.length} reactor runtime states are missing, unknown or invalid; missing state is never interpreted as zero or full power.`,
    }
  } else {
    availablePowerMw = {
      status: 'observed',
      valueMw: roundMw(reactors.reduce((sum, reactor) => sum + Number(reactor.availablePowerMw ?? 0), 0)),
      sourceRef: 'core:entity_states:reactor_runtime+seed:tharsisHubSeed:nominal-reactor-power',
    }
  }

  return {
    totalReactors: reactors.length,
    observedStates,
    knownStates,
    unresolvedStates,
    reactors,
    availablePowerMw,
  }
}
