import { applyUsageRestrictions, evaluatePhysicalBuildability } from './buildability'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const policy = { maxBuildableSlopeDeg: 5, maxRestrictedSlopeDeg: 12 }

const unresolved = evaluatePhysicalBuildability({
  xM: 0, yM: 0, gridSizeM: 50, terrainResolved: false,
}, policy)
assert(unresolved.state === 'unresolved' && unresolved.buildabilityReason === 'terrain-unresolved', 'missing terrain must remain unresolved')

const water = evaluatePhysicalBuildability({
  xM: 0, yM: 0, gridSizeM: 50, terrainResolved: true, elevationM: 300, slopeDeg: 0.5, isWater: true,
}, policy)
assert(water.state === 'invalid' && water.buildabilityReason === 'water', 'water must be physically invalid by default')

const steep = evaluatePhysicalBuildability({
  xM: 0, yM: 0, gridSizeM: 50, terrainResolved: true, elevationM: 310, slopeDeg: 16,
}, policy)
assert(steep.state === 'invalid', 'slope above restricted maximum must be invalid')

const mitigated = evaluatePhysicalBuildability({
  xM: 0, yM: 0, gridSizeM: 50, terrainResolved: true, elevationM: 310, slopeDeg: 8,
}, policy)
assert(mitigated.state === 'restricted' && mitigated.buildabilityReason === 'slope-requires-mitigation', 'middle slope band must be restricted')

const buildable = evaluatePhysicalBuildability({
  xM: 0, yM: 0, gridSizeM: 50, terrainResolved: true, elevationM: 312, slopeDeg: 1.2, aspectDeg: 182,
}, policy)
assert(buildable.state === 'buildable', 'resolved gentle terrain must be buildable')

const protectedUsage = applyUsageRestrictions(buildable, [
  { id: 'protected-use', state: 'invalid', reason: 'protected-land-use' },
])
assert(protectedUsage.state === 'invalid' && protectedUsage.buildabilityReason === 'protected-land-use', 'usage rule may downgrade physical buildability')

const stillWater = applyUsageRestrictions(water, [
  { id: 'infrastructure', state: 'restricted', reason: 'utility-clearance' },
])
assert(stillWater.state === 'invalid' && stillWater.buildabilityReason === 'water', 'physical invalid state must outrank softer restrictions')

console.log('physical buildability tests passed')
