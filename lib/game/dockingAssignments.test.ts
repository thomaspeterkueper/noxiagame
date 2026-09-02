import assert from 'node:assert/strict'
import {
  isPadEligibleForPlayer,
  operationalDockingPads,
  selectFreeDockingPad,
} from './dockingAssignments'

const pads = operationalDockingPads({
  basePads: [
    { id: 'pad-a', status: 'active', condition: 100 },
    { id: 'pad-broken', status: 'active', condition: 0 },
    // Private pad of another player — must never be offered to p1/p2.
    { id: 'pad-c', status: 'active', condition: 100, profileId: 'p3' },
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

assert.deepEqual(pads.map(p => p.id), ['pad-a', 'pad-b', 'pad-c'])
// Ownership metadata is carried through: public pads have profileId null.
assert.equal(pads.find(p => p.id === 'pad-a')?.profileId, null)
assert.equal(pads.find(p => p.id === 'pad-b')?.profileId, 'p1')

// Eligibility: public pads + own pads only.
assert.equal(isPadEligibleForPlayer(pads[0], 'p1'), true)
assert.equal(isPadEligibleForPlayer(pads[1], 'p1'), true)
assert.equal(isPadEligibleForPlayer(pads[2], 'p1'), false)
assert.equal(isPadEligibleForPlayer(pads[2], 'p3'), true)

const first = selectFreeDockingPad({ pads, assignments: [], arrivingShipId: 'ship-1', playerProfileId: 'p1' })
assert.equal(first?.id, 'pad-a')

// A foreign private pad is never offered, even when every eligible pad is full.
const foreignPad = selectFreeDockingPad({
  pads,
  assignments: [
    { shipId: 'ship-1', locationId: 'moon', padEntityId: 'pad-a' },
    { shipId: 'ship-2', locationId: 'moon', padEntityId: 'pad-b' },
  ],
  arrivingShipId: 'ship-3',
  playerProfileId: 'p3',
})
assert.equal(foreignPad?.id, 'pad-c')

const second = selectFreeDockingPad({
  pads,
  assignments: [{ shipId: 'ship-1', locationId: 'moon', padEntityId: 'pad-a' }],
  arrivingShipId: 'ship-2',
  playerProfileId: 'p1',
})
assert.equal(second?.id, 'pad-b')

// p2 has no private pads: pad-b (p1's) must not be offered once pad-a is taken.
const scopedOut = selectFreeDockingPad({
  pads,
  assignments: [{ shipId: 'ship-1', locationId: 'moon', padEntityId: 'pad-a' }],
  arrivingShipId: 'ship-2',
  playerProfileId: 'p2',
})
assert.equal(scopedOut, null)

const full = selectFreeDockingPad({
  pads,
  assignments: [
    { shipId: 'ship-1', locationId: 'moon', padEntityId: 'pad-a' },
    { shipId: 'ship-2', locationId: 'moon', padEntityId: 'pad-b' },
  ],
  arrivingShipId: 'ship-3',
  playerProfileId: 'p1',
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
  playerProfileId: 'p1',
})
assert.equal(sameShip?.id, 'pad-a')

console.log('Docking assignment domain: OK')
