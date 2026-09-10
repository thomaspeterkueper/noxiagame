import { PLANETARY_REFERENCES, planetaryToLocalEnu } from './planetary'
import {
  classifySubsurfaceZone,
  planetaryToSurfaceRelative,
  surfaceRelativeToPlanetary,
  validateDepthInterval,
} from './planetaryVolume'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, tolerance: number, label: string) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`)
}

const moonSurface = {
  body: 'moon' as const,
  latDeg: -89,
  lonDeg: 17,
  surfaceElevationM: 1320,
  depthBelowSurfaceM: 85,
}

const buried = surfaceRelativeToPlanetary(moonSurface)
near(buried.elevationM ?? 0, 1235, 1e-9, 'datum elevation after applying lunar depth')

const restored = planetaryToSurfaceRelative('moon', buried, moonSurface.surfaceElevationM)
near(restored.depthBelowSurfaceM, 85, 1e-9, 'surface-relative depth round trip')

const local = planetaryToLocalEnu(
  buried,
  { latDeg: moonSurface.latDeg, lonDeg: moonSurface.lonDeg, elevationM: moonSurface.surfaceElevationM },
  PLANETARY_REFERENCES.moon,
)
near(local.upM, -85, 0.01, 'lunar local vertical points inward below the surface')

assert(classifySubsurfaceZone(0) === 'surface', 'depth 0 should be surface')
assert(classifySubsurfaceZone(2.5) === 'shallow', '2.5 m should be shallow subsurface')
assert(classifySubsurfaceZone(500) === 'shallow', 'threshold should remain shallow')
assert(classifySubsurfaceZone(500.01) === 'deep', 'beyond threshold should be deep subsurface')

validateDepthInterval({ minDepthM: 0.8, maxDepthM: 3.4 })

let invalidIntervalRejected = false
try {
  validateDepthInterval({ minDepthM: 4, maxDepthM: 3 })
} catch {
  invalidIntervalRejected = true
}
assert(invalidIntervalRejected, 'invalid depth interval must be rejected')

console.log('planetary volume tests passed')
