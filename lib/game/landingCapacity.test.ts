import {
  deriveLandingCapacity,
  hasLandingCapacityForArrival,
} from './landingCapacity'
import type { BuildingExpansionInstance } from './buildingExpansions'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const extraPad: BuildingExpansionInstance = {
  id: 'expansion-pad-2',
  parentEntityId: 'landing-pad-1',
  expansionId: 'landing_pad_extra_pad',
  profileId: null,
  status: 'active',
  slot: 1,
  condition: 100,
}

const buildingPad: BuildingExpansionInstance = {
  ...extraPad,
  id: 'expansion-building',
  status: 'building',
}

const base = [{ id: 'landing-pad-1', status: 'active', condition: 100 }]

const onePad = deriveLandingCapacity({ basePads: base, expansions: [] })
assert(onePad.operationalPads === 1, 'one active base landing pad must provide one physical pad')
assert(onePad.enforceable === false, 'capacity is not enforceable without persistent ship→pad occupancy')
assert(hasLandingCapacityForArrival(onePad) === null, 'unknown occupancy must not reject or approve an arrival')

const expanded = deriveLandingCapacity({ basePads: base, expansions: [extraPad] })
assert(expanded.operationalPads === 2, 'one active extra-pad expansion must add one physical pad')

const whileBuilding = deriveLandingCapacity({ basePads: base, expansions: [buildingPad] })
assert(whileBuilding.operationalPads === 1, 'an expansion still building must not add operational capacity')

const oneOccupied = deriveLandingCapacity({
  basePads: base,
  expansions: [extraPad],
  occupiedPadEntityIds: ['landing-pad-1'],
})
assert(oneOccupied.enforceable === true, 'persistent occupancy makes capacity enforceable')
assert(oneOccupied.occupiedPads === 1, 'one attributed ship must occupy one pad')
assert(oneOccupied.availablePads === 1, 'expanded two-pad facility with one occupant must have one pad free')
assert(hasLandingCapacityForArrival(oneOccupied) === true, 'arrival should be admitted while a pad is free')

const full = deriveLandingCapacity({
  basePads: base,
  expansions: [extraPad],
  occupiedPadEntityIds: ['landing-pad-1', 'expansion-pad-2'],
})
assert(full.availablePads === 0, 'both occupied pads must leave no free capacity')
assert(hasLandingCapacityForArrival(full) === false, 'arrival should be rejected when known physical capacity is full')

console.log('Landing capacity domain: OK')
