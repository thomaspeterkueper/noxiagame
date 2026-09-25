import assert from 'node:assert/strict'
import { createSpaceportPlanningOverlay } from './spaceportPlanningOverlay'

const overlay = createSpaceportPlanningOverlay([
  { shortlistLabel: 'A', lat: 51.1, lon: 7.1 },
  { shortlistLabel: 'B', lat: 51.2, lon: 7.2 },
  { shortlistLabel: 'C', lat: 51.3, lon: 7.3 },
])

assert.ok(overlay)
assert.equal(overlay.end.lat, 51.2)
assert.equal(overlay.label, 'Korridor B · Vorprüfung')
assert.equal(overlay.status, 'screening-only')
assert.equal(overlay.canonical, false)
assert.equal(overlay.constructionAuthority, false)
assert.equal(createSpaceportPlanningOverlay([]), null)

console.log('spaceport planning overlay tests passed')
