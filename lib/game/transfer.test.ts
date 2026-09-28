import assert from 'node:assert/strict'
import { transferQuote } from './transfer'

const near = transferQuote('earth', 'mars', 0)
const later = transferQuote('earth', 'mars', 44)
assert.ok(near && later)
assert.notEqual(near.distance, later.distance, 'Earth/Mars distance must vary with orbital geometry')
assert.notEqual(near.energy, later.energy, 'Earth/Mars energy must vary with orbital geometry')

const earthMoon = transferQuote('earth', 'moon', 0)
const moonEarth = transferQuote('moon', 'earth', 0)
assert.ok(earthMoon && moonEarth)
assert.ok(earthMoon.energy > moonEarth.energy, 'Earth departure must remain more expensive than Moon departure')

const novice = transferQuote('earth', 'mars', 30, { navigationProficiency: 0 })
const expert = transferQuote('earth', 'mars', 30, { navigationProficiency: 1 })
assert.ok(novice && expert)
assert.ok(expert.energy < novice.energy, 'navigation knowledge should reduce optimisable energy')
assert.ok(expert.durationSeconds < novice.durationSeconds, 'navigation knowledge should reduce travel time')
assert.equal(expert.gravityEnergy, novice.gravityEnergy, 'navigation knowledge must not discount gravity floor')

const fast = transferQuote('earth', 'mars', 30, { speedMult: 1.5 })
assert.ok(fast && novice)
assert.ok(fast.durationSeconds < novice.durationSeconds, 'faster ships should reduce duration')
assert.equal(fast.energy, novice.energy, 'speed multiplier alone should not change transfer energy')

assert.equal(transferQuote('earth', 'earth', 0), null)
assert.equal(transferQuote('unknown', 'mars', 0), null)

console.log('transfer tests passed')
