import test from 'node:test'
import assert from 'node:assert/strict'
import { projectParcelLifecycle } from './parcelLifecycle.ts'

const baseline = [{ parcelId: 'plot-1', surface: 'occupied', buildingId: 'old-house' }]
const demolish = {
  id: 'core-demolition', settlementId: 'seelenberg', parcelId: 'plot-1',
  worldYear: 2030, sequence: 1, sourceEventRef: 'core:demolition',
  committed: true, change: { action: 'demolish', buildingId: 'old-house' },
}
const replay = (receipts, settlementId = 'seelenberg', year = 2050) =>
  projectParcelLifecycle({ settlementId, baselineYear: 2026, year, baseline, receipts })

test('malformed persisted JSON never crashes or changes a valid city replay', () => {
  const malformed = [
    null, 0, [], {},
    { ...demolish, id: 42 },
    { ...demolish, parcelId: 42 },
    { ...demolish, sourceEventRef: 42 },
    { ...demolish, worldYear: '2030' },
    { ...demolish, sequence: '1' },
    { ...demolish, change: null },
    { ...demolish, change: [] },
  ]
  for (const rows of [[...malformed, demolish], [demolish, ...malformed].reverse()]) {
    const result = replay(rows)
    assert.equal(result.parcels[0].surface, 'cleared')
    assert.equal(result.transitions.length, 1)
    assert.equal(result.rejected.length, malformed.length)
    assert.ok(result.rejected.every(row => row.reason === 'invalid_receipt'))
  }
})

test('invalid duplicate does not suppress a valid Core receipt with the same ID', () => {
  const invalid = { ...demolish, sourceEventRef: null }
  for (const rows of [[invalid, demolish], [demolish, invalid]]) {
    const result = replay(rows)
    assert.equal(result.transitions.length, 1)
    assert.equal(result.rejected.length, 1)
    assert.equal(result.rejected[0].reason, 'invalid_receipt')
  }
})

test('a genuinely duplicated valid event is still rejected once', () => {
  const result = replay([demolish, { ...demolish }])
  assert.equal(result.transitions.length, 1)
  assert.deepEqual(result.rejected, [{ eventId: demolish.id, reason: 'duplicate_event' }])
})

test('future and other-settlement receipts cannot change Seelenberg', () => {
  const future = { ...demolish, id: 'future', worldYear: 2100 }
  const foreign = { ...demolish, id: 'foreign', settlementId: 'brombach' }
  const result = replay([future, foreign], 'seelenberg', 2050)
  assert.equal(result.parcels[0].surface, 'occupied')
  assert.equal(result.transitions.length, 0)
  assert.equal(result.rejected.length, 0)
  assert.equal(replay([{ ...demolish, settlementId: 'brombach' }], 'brombach').parcels[0].surface, 'cleared')
})

test('unidentified settlement and nonfinite year are rejected rather than silently trusted', () => {
  const result = replay([
    { ...demolish, settlementId: null },
    { ...demolish, id: 'nan-year', worldYear: Number.NaN },
  ])
  assert.equal(result.transitions.length, 0)
  assert.deepEqual(result.rejected.map(row => row.reason), ['invalid_receipt', 'invalid_receipt'])
})
