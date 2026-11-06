import assert from 'node:assert/strict'
import { extractionTax, operatedBuildings, operatorCosts, operatorsNeeded, OPERATION_REQUIRED_FROM_TICK } from './facilityOperation'

assert.equal(operatorsNeeded('ice_drill', 16), 4)
assert.equal(operatorsNeeded('ice_drill', 5), 2)
assert.equal(operatorsNeeded('water_recycler', 1), 1)
assert.equal(operatorsNeeded('solar', 14), 0)

const c = operatorCosts(75)
assert.deepEqual(c, { staff: 4500, robot: 5500, cheaper: 'staff' })
assert.equal(operatorCosts(110).cheaper, 'robot')

const drills = Array.from({ length: 16 }, (_, i) => ({ entity_id: 'ice_drill', location_id: 'moon', location: 'moon', tile_col: i }))
const all = [...drills, { entity_id: 'solar', location_id: 'mars', location: 'mars', tile_col: 1 }, { entity_id: 'water_recycler', location_id: 'mars', location: 'mars', tile_col: 9 }]
assert.equal(operatedBuildings(all, new Map(), OPERATION_REQUIRED_FROM_TICK - 1).length, 18)
const none = operatedBuildings(all, new Map(), OPERATION_REQUIRED_FROM_TICK)
assert.deepEqual(none.map(b => b.entity_id), ['solar'])
const some = operatedBuildings(all, new Map([['moon|ice_drill', 2], ['mars|water_recycler', 1]]), OPERATION_REQUIRED_FROM_TICK)
assert.equal(some.filter(b => b.entity_id === 'ice_drill').length, 8)
assert.equal(some.filter(b => b.entity_id === 'water_recycler').length, 1)

assert.equal(extractionTax(84, 0.15), 13)
assert.equal(extractionTax(84, 0), 0)
assert.equal(extractionTax(0, 0.15), 0)
console.log('facilityOperation ok')
