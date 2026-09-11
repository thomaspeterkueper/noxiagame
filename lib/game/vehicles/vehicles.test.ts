import { toEarthSurfaceMobilityEnvelope, validateVehicleFrame, type VehicleFrame } from './index'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const cargoRover: VehicleFrame = {
  id: 'cargo-rover-reference',
  name: 'Cargo Rover Reference',
  role: 'cargo-rover',
  domains: ['surface'],
  mobilityModes: ['wheeled'],
  dryMassKg: 8200,
  cargo: { massCapacityKg: 6000 },
  crew: { minCrew: 0, maxCrew: 2 },
  energyStores: [{ id: 'battery', carrier: 'electricity', capacity: 520, unit: 'kWh' }],
  environment: {
    vacuumCapable: true,
    atmosphereRequired: false,
    pressurized: false,
    dustTolerant: true,
    gravityMs2: { min: 1.0, max: 10.0 },
  },
  surfaceMobility: {
    mode: 'wheeled',
    safeLongitudinalSlopeDeg: 18,
    referenceSpeedKph: 35,
  },
}

assert(validateVehicleFrame(cargoRover).length === 0, 'reference cargo rover frame must validate')

const earthEnvelope = toEarthSurfaceMobilityEnvelope(cargoRover)
assert(earthEnvelope?.role === 'cargo-rover', 'cargo rover must map to existing Earth role')
assert(earthEnvelope?.safeLongitudinalSlopeDeg === 18, 'Earth must receive engineering slope limit unchanged')

const invalid: VehicleFrame = {
  ...cargoRover,
  id: 'invalid-aircraft',
  role: 'aircraft',
  domains: ['atmospheric'],
  mobilityModes: ['flight'],
  surfaceMobility: {
    mode: 'wheeled',
    safeLongitudinalSlopeDeg: 12,
    referenceSpeedKph: 20,
  },
}

const errors = validateVehicleFrame(invalid)
assert(errors.includes('surfaceMobility requires surface domain'), 'surface envelope must require surface domain')
assert(errors.includes('surfaceMobility mode must be declared in mobilityModes'), 'surface mode must be declared by frame')

console.log('shared vehicle domain tests passed')
