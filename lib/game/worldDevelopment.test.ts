import {
  deriveWorldDevelopmentProjection,
  getWorldDevelopmentPhase,
  WORLD_DEVELOPMENT_DOMAINS,
  WORLD_DEVELOPMENT_DRIVERS,
} from './worldDevelopment'
import {
  buildOrbitalStationCapabilitySnapshot,
  deriveBufferedResourceSecurity,
  deriveFirmEnergySignal,
  deriveOrbitalLogisticsSignal,
  deriveWaterSecuritySignal,
} from './worldDevelopmentSignals'
import { buildTharsisEnergyGridObservation } from './energyGridObservation'
import { THARSIS_HUB_BUILDINGS } from './seeds/tharsisHubSeed'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

assert(WORLD_DEVELOPMENT_DOMAINS.length === 6, 'NOXIA world development must expose exactly six macro domains')
assert(new Set(WORLD_DEVELOPMENT_DRIVERS.map(driver => driver.id)).size === WORLD_DEVELOPMENT_DRIVERS.length, 'driver ids must be unique')

assert(getWorldDevelopmentPhase(2045)?.id === 'electrification_autonomy', '2045 must begin the electrification/autonomy phase')
assert(getWorldDevelopmentPhase(2060)?.id === 'offworld_bootstrap', '2060 must begin off-world bootstrap')
assert(getWorldDevelopmentPhase(2080)?.id === 'earth_moon_system', '2080 must begin the Earth-Moon industrial phase')
assert(getWorldDevelopmentPhase(2100)?.id === 'solar_logistics', '2100 must begin the solar-system logistics phase')
assert(getWorldDevelopmentPhase(2126) === null, 'baseline phase model must not silently extrapolate beyond 2125')

const projection = deriveWorldDevelopmentProjection({
  year: 2091,
  signals: [
    { driverId: 'grid_capacity', value: 0.31, sourceRef: 'core:grid-snapshot' },
    { driverId: 'climate_stress', value: 0.83, sourceRef: 'earth:hazard-projection' },
    { driverId: 'orbital_logistics', value: 0.78, sourceRef: 'core:orbital-throughput' },
    { driverId: 'water_security', value: 1.2, sourceRef: 'core:water-balance' },
  ],
})

assert(projection.phase?.id === 'earth_moon_system', '2091 must project into the Earth-Moon industrial phase')
assert(projection.bottlenecks.some(signal => signal.driverId === 'grid_capacity'), 'weak grid capacity must be exposed as a bottleneck')
assert(projection.bottlenecks.some(signal => signal.driverId === 'climate_stress'), 'high climate stress must be exposed as a bottleneck')
assert(projection.strengths.some(signal => signal.driverId === 'orbital_logistics'), 'mature orbital logistics must be exposed as a strength')
assert(projection.strengths.some(signal => signal.driverId === 'water_security'), 'capacity values above 1 must clamp to strong rather than overflow')
assert(projection.signals.find(signal => signal.driverId === 'water_security')?.normalizedValue === 1, 'signals must clamp to 0..1')

let duplicateRejected = false
try {
  deriveWorldDevelopmentProjection({
    year: 2050,
    signals: [
      { driverId: 'grid_capacity', value: 0.4, sourceRef: 'a' },
      { driverId: 'grid_capacity', value: 0.5, sourceRef: 'b' },
    ],
  })
} catch {
  duplicateRejected = true
}
assert(duplicateRejected, 'duplicate driver inputs must fail closed')

let missingSourceRejected = false
try {
  deriveWorldDevelopmentProjection({
    year: 2050,
    signals: [{ driverId: 'ai_automation', value: 0.5, sourceRef: '   ' }],
  })
} catch {
  missingSourceRejected = true
}
assert(missingSourceRejected, 'macro signals without provenance must fail closed')

const sustainableWater = deriveWaterSecuritySignal(
  { stock: 400, production: 100, consumption: 100 },
  'core:location_resources:water:test',
)
assert(Boolean(sustainableWater), 'water balance with real activity must produce a signal')
assert((sustainableWater?.signal.value ?? 0) >= 0.75, 'balanced water production must reach the strong-capacity band')
assert(sustainableWater?.evidence.sustainable === true, 'balanced water production must be marked sustainable')

const deficitWater = deriveWaterSecuritySignal(
  { stock: 80, production: 60, consumption: 100 },
  'core:location_resources:water:test',
)
assert(Boolean(deficitWater), 'deficit water balance with stock must produce a signal')
assert((deficitWater?.signal.value ?? 1) < 0.75, 'a structurally deficit water flow must never be classified strong from stock alone')
assert(deficitWater?.evidence.sustainable === false, 'deficit water production must be marked unsustainable')

const emptyResource = deriveBufferedResourceSecurity({ stock: 0, production: 0, consumption: 0 })
assert(emptyResource === null, 'empty resource rows must remain unresolved rather than invent neutral security')

const firmEnergy = deriveFirmEnergySignal(
  { storedEnergy: 250, firmProduction: 120, demand: 100 },
  'core:firm-energy:test',
)
assert(Boolean(firmEnergy), 'explicit firm-energy inputs must produce a signal')
assert(firmEnergy?.signal.driverId === 'firm_energy', 'firm-energy adapter must map only to the firm_energy driver')
assert((firmEnergy?.signal.value ?? 0) >= 0.75, 'firm generation above demand must be strong with reserve')

const phobos = buildOrbitalStationCapabilitySnapshot({ slug: 'phobos' })
const kepler = buildOrbitalStationCapabilitySnapshot({ slug: 'kepler' })
const unknownStation = buildOrbitalStationCapabilitySnapshot({ slug: 'invented-station' })
assert(Boolean(phobos && kepler), 'known canonical stations must resolve structural orbital capabilities')
assert(unknownStation === null, 'unknown station slugs must fail closed rather than inherit a generic physical topology')

const orbitalSignal = deriveOrbitalLogisticsSignal(
  [phobos, kepler].filter((station): station is NonNullable<typeof station> => station !== null),
  'core:station-capabilities:test',
)
assert(Boolean(orbitalSignal), 'known operational station capability set must produce an orbital-logistics signal')
assert((orbitalSignal?.evidence.cargoPorts as number) >= 2, 'orbital evidence must preserve actual cargo-port count')
assert((orbitalSignal?.evidence.servicePorts as number) >= 1, 'orbital evidence must preserve actual service-port count')
assert(!Object.prototype.hasOwnProperty.call(orbitalSignal?.evidence ?? {}, 'shipyardCount'), 'unknown shipyard runtime capability must not be invented or scored')

const canonicalTharsisEnergyAssets = THARSIS_HUB_BUILDINGS.filter(
  asset => asset.entityId === 'reactor_module' || asset.entityId === 'black_start',
)
const liveCanonicalTharsisEnergyAssets = canonicalTharsisEnergyAssets.map(asset => ({
  entityId: asset.entityId,
  tileRow: asset.row,
  tileCol: asset.col,
}))

const tharsisEnergy = buildTharsisEnergyGridObservation({
  locationId: 'mars-test',
  liveAssets: liveCanonicalTharsisEnergyAssets,
})
assert(tharsisEnergy.domains.length === 3, 'Tharsis energy observation must preserve three canonical energy domains')
assert(tharsisEnergy.generation.observedReactorModules === 6, 'all six persisted canonical reactor modules must be observed')
assert(tharsisEnergy.generation.canonicalReactorModules === 6, 'Tharsis canonical energy model must contain six reactor modules')
assert(tharsisEnergy.generation.liveInstalledNominalPowerMw === 7.5, 'six canonical 1.25 MW reactors must expose 7.5 MW installed nominal power')
assert(tharsisEnergy.storage.observedBlackStartNodes === 3, 'all three persisted black-start/storage nodes must be observed')
assert(tharsisEnergy.grid.canonicalPowerRings === 2, 'Tharsis canonical utility topology must expose two power rings')
assert(tharsisEnergy.grid.ringIds.includes('A') && tharsisEnergy.grid.ringIds.includes('B'), 'both canonical power rings must retain their identities')
assert(tharsisEnergy.generation.availablePowerMw.status === 'unresolved', 'nominal MW must not be promoted to available power')
assert(tharsisEnergy.storage.energyMWh.status === 'unresolved', 'black-start nodes must not invent storage depth')
assert(tharsisEnergy.grid.transmissionCapacityMw.status === 'unresolved', 'power-ring existence must not invent transmission capacity')
assert(tharsisEnergy.demand.totalDemandMw.status === 'unresolved', 'abstract game consumption must not be presented as MW demand')
assert(tharsisEnergy.derivedDrivers.firmEnergy.status === 'unresolved', 'nominal reactor power alone must not emit firm-energy truth')
assert(tharsisEnergy.derivedDrivers.gridCapacity.status === 'unresolved', 'ring topology alone must not emit grid-capacity truth')

const degradedTharsisEnergy = buildTharsisEnergyGridObservation({
  locationId: 'mars-test',
  liveAssets: canonicalTharsisEnergyAssets
    .filter(asset => asset.id !== 'reactor_module_1')
    .map(asset => ({ entityId: asset.entityId, tileRow: asset.row, tileCol: asset.col })),
})
assert(degradedTharsisEnergy.generation.observedReactorModules === 5, 'missing persisted reactor must reduce observed reactor count')
assert(degradedTharsisEnergy.generation.liveInstalledNominalPowerMw === 6.25, 'missing canonical reactor must reduce installed nominal MW')
assert(degradedTharsisEnergy.domains.some(domain => !domain.complete), 'a missing domain asset must make its energy domain incomplete')

const unprovenExtraReactor = buildTharsisEnergyGridObservation({
  locationId: 'mars-test',
  liveAssets: [
    ...liveCanonicalTharsisEnergyAssets,
    { entityId: 'reactor_module', tileRow: 0, tileCol: 0 },
  ],
})
assert(unprovenExtraReactor.generation.observedReactorModules === 6, 'off-seed reactor must not inherit canonical nominal power')
assert(unprovenExtraReactor.generation.liveInstalledNominalPowerMw === 7.5, 'unproven reactor must not inflate installed nominal MW')
assert(unprovenExtraReactor.unmatchedLiveEnergyAssets === 1, 'off-seed energy assets must remain visible as unmatched provenance')

console.log('world development projection, live-signal and energy-grid observation tests passed')
