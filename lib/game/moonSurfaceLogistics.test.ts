import {
  assessMoonSurfaceRoute,
  deriveMoonRouteMetrics,
  SHACKLETON_SURFACE_LOGISTICS_CHAIN,
} from './moonSurfaceLogistics'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const metrics = deriveMoonRouteMetrics([
  { distanceM: 0, elevationM: 0 },
  { distanceM: 100, elevationM: 5 },
  { distanceM: 200, elevationM: 0 },
])

assert(Math.abs(metrics.distanceM - 200) < 1e-9, 'route distance must follow sampled profile')
assert(Math.abs(metrics.ascentM - 5) < 1e-9, 'route ascent must be accumulated')
assert(Math.abs(metrics.descentM - 5) < 1e-9, 'route descent must be accumulated')
assert(metrics.maxAbsSlopeDeg > 2.8 && metrics.maxAbsSlopeDeg < 2.9, 'route slope must derive from height profile')
assert(SHACKLETON_SURFACE_LOGISTICS_CHAIN[0]?.role === 'mine-buffer', 'chain must begin at mine buffer')
assert(SHACKLETON_SURFACE_LOGISTICS_CHAIN.at(-1)?.role === 'shuttle-port-storage', 'surface chain must end at shuttle-port storage')

const vehicle = { role: 'cargo-rover' as const, safeLongitudinalSlopeDeg: 12 }
const offroad = assessMoonSurfaceRoute({ routeClass: 'offroad', metrics, vehicle, roughness01: 0.5 })
const prepared = assessMoonSurfaceRoute({ routeClass: 'prepared-track', metrics, vehicle, roughness01: 0.2 })
const hardened = assessMoonSurfaceRoute({ routeClass: 'hardened-road', metrics, vehicle })

assert(offroad.passable && prepared.passable && hardened.passable, 'gentle reference route must remain passable')
assert(offroad.speedMultiplier < prepared.speedMultiplier, 'prepared track must be faster than offroad')
assert(prepared.speedMultiplier < hardened.speedMultiplier, 'hardened road must be faster than prepared track')
assert(offroad.energyMultiplier > prepared.energyMultiplier, 'offroad must impose a larger relative energy burden')
assert(prepared.energyMultiplier > hardened.energyMultiplier, 'prepared track must remain more costly than hardened road')


const flatMetrics = {
  distanceM: 1000,
  ascentM: 0,
  descentM: 0,
  meanAbsSlopeDeg: 0,
  maxAbsSlopeDeg: 0,
}
const engineeringVehicle = {
  frameId: 'eng-lunar-cargo-rover-r1',
  role: 'cargo-rover' as const,
  safeLongitudinalSlopeDeg: 10,
}
const engineeringOffroad = assessMoonSurfaceRoute({
  routeClass: 'offroad',
  metrics: flatMetrics,
  vehicle: engineeringVehicle,
})
const engineeringPrepared = assessMoonSurfaceRoute({
  routeClass: 'prepared-track',
  metrics: flatMetrics,
  vehicle: engineeringVehicle,
})
const engineeringHardened = assessMoonSurfaceRoute({
  routeClass: 'hardened-road',
  metrics: flatMetrics,
  vehicle: engineeringVehicle,
})

assert(Math.abs(engineeringOffroad.speedMultiplier - 5 / 12) < 1e-12, 'LCR-6 offroad speed must use Engineering 5 km/h anchor')
assert(Math.abs(engineeringPrepared.speedMultiplier - 10 / 12) < 1e-12, 'LCR-6 prepared-track speed must use Engineering 10 km/h anchor')
assert(Math.abs(engineeringHardened.speedMultiplier - 15 / 12) < 1e-12, 'LCR-6 hardened-road speed must use Engineering 15 km/h anchor')
assert(engineeringOffroad.energyMultiplier === 1.55, 'LCR-6 offroad energy factor must come from Engineering')
assert(engineeringPrepared.energyMultiplier === 1.15, 'LCR-6 prepared-track energy factor must come from Engineering')
assert(engineeringHardened.energyMultiplier === 1, 'LCR-6 hardened-road energy factor must come from Engineering')
assert(engineeringOffroad.wearMultiplier === 1.8, 'LCR-6 offroad wear factor must come from Engineering')
assert(engineeringPrepared.wearMultiplier === 1.2, 'LCR-6 prepared-track wear factor must come from Engineering')
assert(engineeringHardened.wearMultiplier === 1, 'LCR-6 hardened-road wear factor must come from Engineering')
assert(engineeringOffroad.allowedSlopeDeg === 10, 'canonical Engineering frame must use its safe slope without fallback route fractions')
assert(
  engineeringOffroad.engineeringSourceId === 'ENG-LUNAR-SURFACE-LOGISTICS-r1:ENG-VEH-0003',
  'assessment must retain Engineering provenance',
)

const steep = assessMoonSurfaceRoute({
  routeClass: 'offroad',
  metrics: { ...metrics, maxAbsSlopeDeg: 10 },
  vehicle,
})
assert(!steep.passable && steep.reason === 'slope-limit', 'route class and vehicle envelope must reject excessive slope')

let rejected = false
try {
  deriveMoonRouteMetrics([
    { distanceM: 0, elevationM: 0 },
    { distanceM: 0, elevationM: 1 },
  ])
} catch {
  rejected = true
}
assert(rejected, 'non-increasing profile distance must be rejected')

console.log('moon surface logistics tests passed')
