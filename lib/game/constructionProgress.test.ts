import assert from 'node:assert/strict'
import { constructionState } from './constructionProgress'

const start = Date.parse('2026-09-23T10:00:00Z')
const halfway = constructionState({
  buildable_id: 'solar-array',
  tile_row: 0,
  tile_col: 0,
  status: 'building',
  created_at: new Date(start).toISOString(),
  completes_at: new Date(start + 60_000).toISOString(),
}, start + 30_000)

assert.equal(halfway.progress, 0.5)
assert.equal(halfway.phaseLabel, 'Rohbau')
assert.equal(halfway.remainingSeconds, 30)
assert.equal(halfway.timed, true)

const indeterminate = constructionState({
  buildable_id: 'habitat',
  tile_row: 0,
  tile_col: 0,
  status: 'building',
}, start)
assert.equal(indeterminate.progress, 0.08)
assert.equal(indeterminate.timed, false)

console.log('construction progress tests passed')
