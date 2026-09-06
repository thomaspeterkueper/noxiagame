import { createTerrainHeightSurface, deriveTerrainHillshade, terrainHeightAt } from './heightSurface'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const samples = [
  { xM: 0, yM: 0, zM: 10 },
  { xM: 10, yM: 0, zM: 11 },
  { xM: 20, yM: 0, zM: 12 },
  { xM: 0, yM: 10, zM: 10 },
  { xM: 10, yM: 10, zM: 11 },
  { xM: 20, yM: 10, zM: 12 },
  { xM: 0, yM: 20, zM: 10 },
  { xM: 10, yM: 20, zM: 11 },
  { xM: 20, yM: 20, zM: 12 },
]

const surface = createTerrainHeightSurface(samples, 10)
assert(surface.columns === 3 && surface.rows === 3, 'surface dimensions must derive from metric sample extent')
assert(surface.originXM === 0 && surface.originYM === 0, 'surface must preserve metric origin')
assert(terrainHeightAt(surface, 2, 1) === 12, 'surface lookup must preserve authoritative z')
assert(terrainHeightAt(surface, 3, 1) === null, 'surface lookup outside extent must stay unresolved')

const hillshade = deriveTerrainHillshade(surface)
assert(hillshade.values.length === 9, 'hillshade must share the exact terrain grid')
assert(hillshade.values.every(value => value >= 0 && value <= 1), 'hillshade must be normalized')

let rejectedIncomplete = false
try {
  createTerrainHeightSurface(samples.slice(0, -1), 10)
} catch {
  rejectedIncomplete = true
}
assert(rejectedIncomplete, 'missing terrain cells must not be synthesized')

let rejectedOffGrid = false
try {
  createTerrainHeightSurface([...samples, { xM: 7, yM: 7, zM: 99 }], 10)
} catch {
  rejectedOffGrid = true
}
assert(rejectedOffGrid, 'off-grid terrain samples must be rejected')

console.log('terrain height surface tests passed')
