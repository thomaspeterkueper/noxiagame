import assert from 'node:assert/strict'
import { operationalDockingPads, selectFreeDockingPad } from './dockingAssignments'

const pads = operationalDockingPads({
  basePads: [
    { id: 'pad-a', status: 'active', condition: 100 },
    { id: 'pad-broken', status: 'active', condition: 0 },
  ],
  expansions: [
    {
      id: 'pad-b', parentEntityId: 'pad-a', expansionId: 'landing_pad_extra_pad',
      profileId: 'p1', status: 'active', slot: 1, condition: 100,
    },
    {
      id: 'pad-building', parentEntityId: 'pad-a', expansionId: 'landing_pad_extra_pad',
      profileId: 'p1', status: 'building', slot: 2, condition: 100,
    },
  ],
})

assert.deepEqual(pads.map(p => p.id), ['pad-a', 'pad-b'])

const first = selectFreeDockingPad({ pads, assignments: [], arrivingShipId: 'ship-1' })
assert.equal(first?.id, 'pad-a')

const second = selectFreeDockingPad({
  pads,
  assignments: [{ shipId: 'ship-1', locationId: 'moon', padEntityId: 'pad-a' }],
  arrivingShipId: 'ship-2',
})
assert.equal(second?.id, 'pad-b')

const full = selectFreeDockingPad({
  pads,
  assignments: [
    { shipId: 'ship-1', locationId: 'moon', padEntityId: 'pad-a' },
    { shipId: 'ship-2', locationId: 'moon', padEntityId: 'pad-b' },
  ],
  arrivingShipId: 'ship-3',
})
assert.equal(full, null)

// Reallocating the same ship must not make its old pad block itself.
const sameShip = selectFreeDockingPad({
  pads,
  assignments: [
    { shipId: 'ship-1', locationId: 'moon', padEntityId: 'pad-a' },
    { shipId: 'ship-2', locationId: 'moon', padEntityId: 'pad-b' },
  ],
  arrivingShipId: 'ship-1',
})
assert.equal(sameShip?.id, 'pad-a')

console.log('Docking assignment domain: OK')
