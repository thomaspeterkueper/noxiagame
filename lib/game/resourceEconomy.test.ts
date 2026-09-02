import assert from 'node:assert/strict'
import {
  isPopulationSupplied,
  populationResourceConsumption,
  projectResourceStock,
} from './resourceEconomy'

assert.deepEqual(populationResourceConsumption(0), {
  water: 0,
  energy: 0,
  metal: 0,
  components: 0,
})

assert.deepEqual(populationResourceConsumption(1), {
  water: 1,
  energy: 1,
  metal: 1,
  components: 0,
})

assert.deepEqual(populationResourceConsumption(100), {
  water: 1,
  energy: 1,
  metal: 1,
  components: 0,
})

assert.deepEqual(populationResourceConsumption(497), {
  water: 5,
  energy: 3,
  metal: 1,
  components: 0,
})

assert.equal(isPopulationSupplied({ water: 5, energy: 3, metal: 1 }, 497), true)
assert.equal(isPopulationSupplied({ water: 4, energy: 99, metal: 99 }, 497), false)
assert.equal(projectResourceStock(2, 3, 8), 0)
assert.equal(projectResourceStock(10, 4, 3), 11)

console.log('Population resource economy: OK')
