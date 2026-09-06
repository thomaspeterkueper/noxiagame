import { buildabilityGridVisible, placementCanCommit } from './mapLayers'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

assert(!buildabilityGridVisible(10, 50), '50 m grid must stay hidden at regional zoom')
assert(buildabilityGridVisible(4, 50), '50 m grid must appear once cells are readable')
assert(buildabilityGridVisible(2, 25), '25 m grid must use the same screen-space threshold')

assert(placementCanCommit({
  active: true,
  buildTypeId: 'BLD:NOX:test',
  footprint: { xM: 100, yM: 200, widthM: 50, depthM: 50 },
  state: 'buildable',
  canPlace: true,
  canCancel: true,
}), 'complete buildable placement may commit')

assert(!placementCanCommit({
  active: true,
  buildTypeId: 'BLD:NOX:test',
  footprint: { xM: 100, yM: 200, widthM: 50, depthM: 50 },
  state: 'restricted',
  reason: 'slope exceeds preferred limit',
  canPlace: false,
  canCancel: true,
}), 'restricted placement must not silently commit')

assert(!placementCanCommit({ active: false, state: 'unresolved', canPlace: false, canCancel: false }), 'inactive placement cannot commit')

console.log('map layer/buildability contract tests passed')
