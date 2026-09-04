import { overlaps, normalizeRotation } from './geometry'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const base = { xM: 0, yM: 0, widthM: 20, depthM: 20 }
assert(overlaps(base, { xM: 10, yM: 0, widthM: 20, depthM: 20 }), 'overlapping footprints must collide')
assert(!overlaps(base, { xM: 25, yM: 0, widthM: 20, depthM: 20 }), 'separated footprints must not collide')
assert(overlaps(base, { xM: 25, yM: 0, widthM: 20, depthM: 20 }, 3), 'clearance must enlarge the protected area')
assert(normalizeRotation(-90) === 270, 'negative rotation must normalize')
assert(normalizeRotation(450) === 90, 'rotation over 360 must normalize')

console.log('spatial geometry tests passed')
