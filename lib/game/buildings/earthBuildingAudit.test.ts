import assert from 'node:assert/strict'
import { auditEarthBuildingVisuals } from './earthBuildingAudit'

const audit = auditEarthBuildingVisuals()
const covered = new Set(audit.covered.map(role => role.id))
const missing = new Set(audit.missing.map(role => role.id))

assert.ok(covered.has('housing'))
assert.ok(covered.has('maintenance'))
assert.ok(covered.has('spaceport'))
assert.ok(missing.has('medical'))
assert.ok(missing.has('water'))
assert.ok(missing.has('waste'))
assert.ok(missing.has('transit'))
assert.ok(audit.reusedAssets.some(item => item.buildingIds.includes('habitat') && item.buildingIds.includes('residential_block')))

console.log('earth building visual audit tests passed')
