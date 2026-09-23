import assert from 'node:assert/strict'
import { isEarthMapSurfaceTarget, shouldChooseEarthMapSpot } from './earthMapInteraction'

const svgTarget = { namespaceURI: 'http://www.w3.org/2000/svg' } as unknown as EventTarget
const htmlTarget = { namespaceURI: 'http://www.w3.org/1999/xhtml' } as unknown as EventTarget

assert.equal(isEarthMapSurfaceTarget(svgTarget), true)
assert.equal(isEarthMapSurfaceTarget(htmlTarget), false)
assert.equal(isEarthMapSurfaceTarget({} as EventTarget), false)
assert.equal(isEarthMapSurfaceTarget(null), false)
assert.equal(shouldChooseEarthMapSpot(true, false), true)
assert.equal(shouldChooseEarthMapSpot(true, true), false)
assert.equal(shouldChooseEarthMapSpot(false, false), false)

console.log('Earth map interaction tests passed')
