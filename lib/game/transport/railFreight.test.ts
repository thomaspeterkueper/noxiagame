import { strict as assert } from 'node:assert'
import { aggregateRailFreightDemand, allocateRailFreight } from './railFreight'

const aggregated = aggregateRailFreightDemand([
  { originStationId:'mine', destinationStationId:'works', resource:'metal', units:40, valuePerUnit:3 },
  { originStationId:'mine', destinationStationId:'works', resource:'metal', units:20, valuePerUnit:6 },
  { originStationId:'farm', destinationStationId:'city', resource:'food', units:15, valuePerUnit:4 },
])
assert.equal(aggregated.length,2)
assert.equal(aggregated[0].units,60)
assert.equal(aggregated[0].valuePerUnit,4)

const result = allocateRailFreight(aggregated,{maxUnits:50,operatingCost:25})
assert.equal(result.loadedUnits,50)
assert.equal(result.utilization,1)
assert.equal(result.grossRevenue,200)
assert.equal(result.netResult,175)

console.log('railFreight tests passed')
