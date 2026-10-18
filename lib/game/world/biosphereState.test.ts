import {
  advanceBiosphereState,
  calibrateSifObservation,
  createBiosphereFunctionalState,
  type BiosphereTransitionConfig,
} from './biosphereState'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const config: BiosphereTransitionConfig = {
  activityResponseFraction: 0.5,
  stressResponseFraction: 0.5,
  biomassGrowthFraction: 0.04,
  biomassTurnoverFraction: 0.03,
}

const forest = createBiosphereFunctionalState({
  vegetationType: 'temperate_forest',
  photosyntheticActivity: 0.8,
  biomassState: 0.7,
  soilMoisture: 0.8,
  phenologyState: 'vegetative',
  tick: 100,
  sourceRef: 'world:test:forest',
})

const drought = advanceBiosphereState(
  forest,
  {
    solarAvailability: 0.9,
    waterAvailability: 0.2,
    thermalSuitability: 0.8,
    phenologyFactor: 1,
    disturbanceFactor: 1,
    soilMoisture: 0.18,
    sourceRef: 'weather:test:drought',
  },
  config,
  101,
)

assert(drought.vegetationType === forest.vegetationType, 'functional stress must not rewrite static vegetation class')
assert(drought.photosyntheticActivity < forest.photosyntheticActivity, 'water stress must be able to reduce function over time')
assert(drought.waterStress > forest.waterStress, 'water stress must respond to forcing')
assert(drought.soilMoisture === 0.18, 'soil moisture must remain a distinct state')
assert(drought.biomassState !== drought.photosyntheticActivity, 'standing biomass must remain distinct from instantaneous function')

const recovering = advanceBiosphereState(
  drought,
  {
    solarAvailability: 0.9,
    waterAvailability: 0.9,
    thermalSuitability: 0.9,
    phenologyFactor: 1,
    disturbanceFactor: 1,
    soilMoisture: 0.8,
    sourceRef: 'weather:test:recovery',
  },
  config,
  102,
)

assert(recovering.photosyntheticActivity > drought.photosyntheticActivity, 'functional state must support delayed recovery')
assert(recovering.waterStress < drought.waterStress, 'stress state must recover over later ticks')

const rawSif = {
  kind: 'solar_induced_fluorescence' as const,
  value: 1.37,
  unit: 'mW m-2 sr-1 nm-1',
  observedAt: '2026-10-18T00:00:00Z',
  sourceRef: 'flex:test:observation',
}

const calibrated = calibrateSifObservation(rawSif, {
  photosyntheticActivityProxy: 0.62,
  calibrationModelRef: 'retrieval:test:v1',
  uncertainty: 0.08,
})

assert(rawSif.value === 1.37, 'raw SIF observation must remain unchanged')
assert(calibrated.photosyntheticActivityProxy === 0.62, 'calibrated proxy must be explicit')
assert(calibrated.sourceObservationRef === rawSif.sourceRef, 'derived state must retain observation provenance')
assert(calibrated.calibrationModelRef === 'retrieval:test:v1', 'calibrated proxy must name its retrieval model')

let staleTickRejected = false
try {
  advanceBiosphereState(forest, {
    solarAvailability: 1,
    waterAvailability: 1,
    thermalSuitability: 1,
    phenologyFactor: 1,
    disturbanceFactor: 1,
    sourceRef: 'test',
  }, config, 100)
} catch {
  staleTickRejected = true
}
assert(staleTickRejected, 'biosphere transitions must not invent a second/non-monotonic tick path')
