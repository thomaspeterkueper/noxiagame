import assert from 'node:assert/strict'
import {
  MAX_CURRENT_NAVIGATION_PROFICIENCY,
  navigationKnowledgeLabel,
  navigationProficiencyFromUnlocks,
} from './navigationProficiency'

assert.equal(navigationProficiencyFromUnlocks([]), 0)
assert.equal(navigationProficiencyFromUnlocks(['UNL:NOX:NAV:ORBITAL']), 0.35)
assert.equal(navigationProficiencyFromUnlocks(['UNL:NOX:NAV:CURVATURE']), 0.20)
assert.equal(
  navigationProficiencyFromUnlocks(['UNL:NOX:NAV:ORBITAL', 'UNL:NOX:NAV:CURVATURE']),
  MAX_CURRENT_NAVIGATION_PROFICIENCY,
)
assert.equal(
  navigationProficiencyFromUnlocks(['UNL:NOX:NAV:ORBITAL', 'UNL:NOX:NAV:ORBITAL']),
  0.35,
  'duplicate unlock rows must not double-count',
)
assert.equal(navigationKnowledgeLabel(0), 'Grundnavigation')
assert.equal(navigationKnowledgeLabel(0.35), 'orbital geschult')
assert.equal(navigationKnowledgeLabel(0.55), 'fortgeschritten')

console.log('navigation proficiency tests passed')
