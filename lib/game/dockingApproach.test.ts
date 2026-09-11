import assert from 'node:assert/strict'
import { getDockingApproachOptions, getSuggestedApproachPort } from './dockingApproach'

const standardAtPhobos = getDockingApproachOptions('phobos', 'intersolar-standard')
assert.equal(standardAtPhobos.length, 3)
assert.equal(standardAtPhobos[0]?.port.id, 'phobos-b1')
assert.equal(standardAtPhobos[1]?.port.id, 'phobos-b2')
assert.equal(standardAtPhobos[0]?.exactClassMatch, true)
assert.equal(standardAtPhobos[2]?.port.id, 'phobos-c1')

const heavyAtPhobos = getDockingApproachOptions('phobos', 'intersolar-heavy')
assert.equal(heavyAtPhobos.length, 1)
assert.equal(heavyAtPhobos[0]?.port.id, 'phobos-c1')

const heavyAtKepler = getDockingApproachOptions('prometheus', 'intersolar-heavy')
assert.equal(heavyAtKepler.length, 0)
assert.equal(getSuggestedApproachPort('prometheus', 'intersolar-heavy'), null)

const shuttleAtPhobos = getDockingApproachOptions('phobos', 'surface-transfer-shuttle')
assert.equal(shuttleAtPhobos[0]?.port.portClass, 'shuttle')
assert.equal(shuttleAtPhobos[0]?.cargoCapable, true)

assert.equal(getDockingApproachOptions('unknown', 'intersolar-standard').length, 0)

console.log('dockingApproach tests passed')
