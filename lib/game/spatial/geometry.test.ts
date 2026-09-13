import { overlaps, normalizeRotation } from './geometry'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const base = { xM: 0, yM: 0, widthM: 20, depthM: 20 }
assert(overlaps(base, { xM: 10, yM: 0, widthM: 20, depthM: 20 }), 'overlapping footprints must collide')
assert(!overlaps(base, { xM: 20, yM: 0, widthM: 20, depthM: 20 }), 'touching footprint edges must remain allowed')
assert(!overlaps(base, { xM: 25, yM: 0, widthM: 20, depthM: 20 }), 'separated footprints must not collide')
assert(overlaps(base, { xM: 25, yM: 0, widthM: 20, depthM: 20 }, 3), 'clearance must enlarge the protected area')

const horizontal = { xM: 0, yM: 0, widthM: 40, depthM: 10, rotationDeg: 0 }
const nearbyHorizontal = { xM: 0, yM: 15, widthM: 40, depthM: 10, rotationDeg: 0 }
const nearbyVertical = { ...nearbyHorizontal, rotationDeg: 90 }
assert(!overlaps(horizontal, nearbyHorizontal), 'parallel narrow footprints with a gap must not collide')
assert(overlaps(horizontal, nearbyVertical), 'rotating a rectangular footprint must affect collision geometry')
assert(overlaps(
  { xM: 0, yM: 0, widthM: 30, depthM: 8, rotationDeg: 45 },
  { xM: 8, yM: 0, widthM: 30, depthM: 8, rotationDeg: 315 },
), 'SAT must detect collisions between two independently rotated footprints')

assert(normalizeRotation(-90) === 270, 'negative rotation must normalize')
assert(normalizeRotation(450) === 90, 'rotation over 360 must normalize')

console.log('spatial geometry tests passed')
