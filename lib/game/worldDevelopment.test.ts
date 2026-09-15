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

console.log('world development projection and live-signal tests passed')
