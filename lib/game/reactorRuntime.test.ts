import { buildReactorRuntimeSummary, type ReactorRuntimeStateRow } from './reactorRuntime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const assets = Array.from({ length: 6 }, (_, index) => ({
  tileEntityId: `reactor-${index + 1}`,
  nominalPowerMw: 1.25,
}))

function state(
  subjectId: string,
  mode: 'unknown' | 'online' | 'derated' | 'offline',
  availabilityFactor: number | null,
  reasonCode: string | null = null,
): ReactorRuntimeStateRow {
  return {
    subjectId,
    properties: { schemaVersion: 1, mode, availabilityFactor, reasonCode },
    sourceEvent: `event-${subjectId}`,
    canonicalStateId: `reactor_runtime:${subjectId}:state`,
    validFrom: '2026-09-18T09:00:00.000Z',
  }
}

const allOnline = buildReactorRuntimeSummary({ assets, currentStates: assets.map(asset => state(asset.tileEntityId, 'online', 1)) })
assert(allOnline.availablePowerMw.status === 'observed', 'complete known runtime state must resolve available reactor power')
assert(allOnline.availablePowerMw.valueMw === 7.5, 'six online 1.25 MW modules must derive 7.5 MW available power')
assert(allOnline.knownStates === 6, 'all six online reactors must count as known')

const halfDerated = buildReactorRuntimeSummary({ assets, currentStates: assets.map((asset, index) => index === 5 ? state(asset.tileEntityId, 'derated', 0.5, 'thermal_margin') : state(asset.tileEntityId, 'online', 1)) })
assert(halfDerated.availablePowerMw.status === 'observed', 'valid derating must remain observable')
assert(halfDerated.availablePowerMw.valueMw === 6.875, 'one half-derated module must derive 6.875 MW total')

const oneOffline = buildReactorRuntimeSummary({ assets, currentStates: assets.map((asset, index) => index === 0 ? state(asset.tileEntityId, 'offline', 0, 'maintenance') : state(asset.tileEntityId, 'online', 1)) })
assert(oneOffline.availablePowerMw.status === 'observed', 'explicit offline state is known, not unresolved')
assert(oneOffline.availablePowerMw.valueMw === 6.25, 'one offline module must subtract exactly its 1.25 MW nameplate contribution')

const missing = buildReactorRuntimeSummary({ assets, currentStates: assets.slice(0, 5).map(asset => state(asset.tileEntityId, 'online', 1)) })
assert(missing.availablePowerMw.status === 'unresolved', 'missing runtime state must fail closed')
assert(missing.unresolvedStates === 1, 'one missing state must remain explicitly unresolved')
assert(missing.reactors[5].availablePowerMw === null, 'missing runtime state must never become zero or nominal power')

const unknown = buildReactorRuntimeSummary({ assets, currentStates: assets.map((asset, index) => index === 2 ? state(asset.tileEntityId, 'unknown', null) : state(asset.tileEntityId, 'online', 1)) })
assert(unknown.availablePowerMw.status === 'unresolved', 'explicit unknown runtime mode must keep aggregate availability unresolved')

const invalid = buildReactorRuntimeSummary({ assets, currentStates: assets.map((asset, index) => index === 1 ? state(asset.tileEntityId, 'online', 0.5) : state(asset.tileEntityId, 'online', 1)) })
assert(invalid.availablePowerMw.status === 'unresolved', 'invalid mode/factor combination must fail closed')
assert(invalid.reactors[1].status === 'invalid', 'invalid stored state must remain visible as invalid')

const duplicate = buildReactorRuntimeSummary({ assets, currentStates: [...assets.map(asset => state(asset.tileEntityId, 'online', 1)), state(assets[0].tileEntityId, 'offline', 0)] })
assert(duplicate.availablePowerMw.status === 'unresolved', 'multiple current states for one reactor must fail closed')
assert(duplicate.reactors[0].status === 'invalid', 'duplicate current state must be an integrity issue')

const duplicateAuthority = buildReactorRuntimeSummary({
  assets,
  currentStates: assets.map((asset, index) => index === 3 ? { ...state(asset.tileEntityId, 'online', 1), properties: { schemaVersion: 1, mode: 'online', availabilityFactor: 1, reasonCode: null, nominalPowerMw: 1.25 } } : state(asset.tileEntityId, 'online', 1)),
})
assert(duplicateAuthority.availablePowerMw.status === 'unresolved', 'runtime payload must not duplicate nominal engineering MW')
assert(duplicateAuthority.reactors[3].status === 'invalid', 'duplicated nominal MW must violate the E2a runtime contract')

console.log('reactorRuntime E2a tests passed')
