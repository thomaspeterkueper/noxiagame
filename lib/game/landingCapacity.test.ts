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
assert(onePad.operationalPads === 1, 'one active base landing pad must provide one physical shuttle pad')
assert(onePad.enforceable === false, 'capacity is not enforceable without persistent shuttle→pad occupancy')
assert(hasLandingCapacityForArrival(onePad) === null, 'unknown shuttle occupancy must not reject or approve a shuttle arrival')
assert(
  hasLandingCapacityForArrival(onePad, 'intersolar') === false,
  'an intersolar vessel must never be admitted to a planetary surface pad even when occupancy is unknown',
)

const expanded = deriveLandingCapacity({ basePads: base, expansions: [extraPad] })
assert(expanded.operationalPads === 2, 'one active extra-pad expansion must add one physical shuttle pad')

const whileBuilding = deriveLandingCapacity({ basePads: base, expansions: [buildingPad] })
assert(whileBuilding.operationalPads === 1, 'an expansion still building must not add operational shuttle capacity')

const oneOccupied = deriveLandingCapacity({
  basePads: base,
  expansions: [extraPad],
  occupiedPadEntityIds: ['landing-pad-1'],
})
assert(oneOccupied.enforceable === true, 'persistent occupancy makes shuttle capacity enforceable')
assert(oneOccupied.occupiedPads === 1, 'one attributed shuttle must occupy one pad')
assert(oneOccupied.availablePads === 1, 'expanded two-pad facility with one shuttle must have one pad free')
assert(
  hasLandingCapacityForArrival(oneOccupied, 'surface-transfer-shuttle') === true,
  'a transfer shuttle should be admitted while a pad is free',
)
assert(
  hasLandingCapacityForArrival(oneOccupied, 'intersolar') === false,
  'free shuttle capacity must never authorize an intersolar vessel to land',
)

const full = deriveLandingCapacity({
  basePads: base,
  expansions: [extraPad],
  occupiedPadEntityIds: ['landing-pad-1', 'expansion-pad-2'],
})
assert(full.availablePads === 0, 'both occupied shuttle pads must leave no free capacity')
assert(
  hasLandingCapacityForArrival(full, 'surface-transfer-shuttle') === false,
  'a shuttle arrival should be rejected when known physical capacity is full',
)

console.log('Landing capacity domain: OK')
