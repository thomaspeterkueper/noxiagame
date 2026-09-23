import { strict as assert } from 'node:assert'
import {
  buildPassengerJourneyDraft,
  canEnterImmersiveSpace,
  canTransitionPassengerJourney,
  type PassengerArrivalNode,
} from './passengerJourney'

const target = { kind: 'earth-landmark', id: 'earth-de-darmstadt-esoc' }
const unresolved = buildPassengerJourneyDraft({
  intent: { actorId: null, target, mobilityMode: 'mixed' },
  arrivalNode: null,
})
assert.equal(unresolved.ready, false)
assert.deepEqual(unresolved.blockReasons, ['actor-unresolved', 'arrival-node-unresolved'])
assert.equal(unresolved.etaSeconds, null)

const arrivalNode: PassengerArrivalNode = {
  id: 'arrival:esoc:visitor',
  worldId: 'earth',
  worldObject: target,
  authority: 'canonical-world-registry',
}
const noRoute = buildPassengerJourneyDraft({
  intent: { actorId: 'player-1', target, mobilityMode: 'mixed' },
  arrivalNode,
})
assert.deepEqual(noRoute.blockReasons, ['route-unresolved'])

const ready = buildPassengerJourneyDraft({
  intent: { actorId: 'player-1', target, mobilityMode: 'mixed' },
  arrivalNode,
  legs: [
    { id: 'leg-1', mode: 'rail', originNodeId: 'origin', destinationNodeId: 'hub', distanceKm: 100, etaSeconds: 3600, authority: 'test-world-routing' },
    { id: 'leg-2', mode: 'road', originNodeId: 'hub', destinationNodeId: arrivalNode.id, distanceKm: 10, etaSeconds: 900, authority: 'test-world-routing' },
  ],
})
assert.equal(ready.ready, true)
assert.equal(ready.distanceKm, 110)
assert.equal(ready.etaSeconds, 4500)

assert.equal(canTransitionPassengerJourney('planned', 'boarding'), true)
assert.equal(canTransitionPassengerJourney('planned', 'arrived'), false)
assert.equal(canTransitionPassengerJourney('in_transit', 'arrived'), true)
assert.equal(canEnterImmersiveSpace('in_transit', 'space:esoc'), false)
assert.equal(canEnterImmersiveSpace('arrived', null), false)
assert.equal(canEnterImmersiveSpace('arrived', 'space:esoc'), true)

console.log('Passenger journey contract tests passed')
