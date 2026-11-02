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

test('one Core source event cannot both demolish and restore the same parcel', () => {
  const result = replay([
    demolish,
    { ...demolish, id: 'premature-meadow', worldYear: 2031, sequence: 2,
      change: { action: 'restore_meadow' } },
  ])
  assert.equal(result.parcels[0].surface, 'cleared')
  assert.equal(result.transitions.length, 1)
  assert.deepEqual(result.rejected, [{ eventId: 'premature-meadow', reason: 'duplicate_source_event' }])
})

test('one Core source event may legitimately affect distinct parcels', () => {
  const result = projectParcelLifecycle({
    settlementId: 'seelenberg', baselineYear: 2026, year: 2030,
    baseline: [
      { parcelId: 'plot-1', surface: 'occupied', buildingId: 'old-house' },
      { parcelId: 'plot-2', surface: 'occupied', buildingId: 'other-house' },
    ],
    receipts: [
      demolish,
      { ...demolish, id: 'second-demolition', parcelId: 'plot-2',
        change: { action: 'demolish', buildingId: 'other-house' } },
    ],
  })
  assert.deepEqual(result.parcels.map(parcel => parcel.surface), ['cleared', 'cleared'])
  assert.equal(result.transitions.length, 2)
  assert.equal(result.rejected.length, 0)
})

test('invalid transitions do not reserve Core event IDs or source references', () => {
  const invalid = { ...demolish, worldYear: 2029,
    change: { action: 'restore_meadow' } }
  const result = replay([invalid, demolish])
  assert.equal(result.parcels[0].surface, 'cleared')
  assert.equal(result.transitions.length, 1)
  assert.deepEqual(result.rejected, [{ eventId: demolish.id, reason: 'invalid_transition' }])
})

test('different committed source events allow demolition followed by restoration', () => {
  const result = replay([
    demolish,
    { ...demolish, id: 'restoration', worldYear: 2031, sequence: 2,
      sourceEventRef: 'core:restoration', change: { action: 'restore_meadow' } },
  ])
  assert.equal(result.parcels[0].surface, 'meadow')
  assert.equal(result.transitions.length, 2)
  assert.equal(result.rejected.length, 0)
})

test('malformed building identities cannot crash replay or hide valid later events', () => {
  for (const buildingId of [null, 0, 42, true, {}, [], ['house'], '']) {
    const badDemolition = { ...demolish, id: 'bad-demolition', worldYear: 2029,
      change: { action: 'demolish', buildingId } }
    const badConstruction = { ...demolish, id: 'bad-construction', worldYear: 2031,
      sequence: 2, sourceEventRef: 'core:bad-construction',
      change: { action: 'construct', buildingId } }
    const restoration = { ...demolish, id: 'restoration', worldYear: 2032,
      sequence: 3, sourceEventRef: 'core:restoration',
      change: { action: 'restore_meadow' } }
    const construction = { ...demolish, id: 'valid-construction', worldYear: 2033,
      sequence: 4, sourceEventRef: 'core:valid-construction',
      change: { action: 'construct', buildingId: 'new-house' } }
    const result = replay([badDemolition, demolish, badConstruction, restoration, construction])
    assert.equal(result.parcels[0].surface, 'occupied')
    assert.equal(result.parcels[0].buildingId, 'new-house')
    assert.deepEqual(result.transitions.map(t => t.to), ['cleared', 'meadow', 'occupied'])
    assert.deepEqual(result.rejected.map(r => r.reason), ['invalid_receipt', 'invalid_receipt'])
  }
})

test('malformed parcel baselines fail closed with a domain error, not a runtime crash', () => {
  const invalid = [
    null, 0, [], {},
    { parcelId: 42, surface: 'occupied', buildingId: 'house' },
    { parcelId: 'plot-1', surface: 'occupied', buildingId: 42 },
    { parcelId: 'plot-1', surface: 'occupied', buildingId: [] },
    { parcelId: 'plot-1', surface: 'occupied', buildingId: ' ' },
    { parcelId: 'plot-1', surface: 'cleared', buildingId: 0 },
    { parcelId: 'plot-1', surface: 'meadow', buildingId: null },
    { parcelId: 'plot-1', surface: 'cleared', buildingId: '' },
    { parcelId: 'plot-1', surface: 'unknown' },
  ]
  for (const parcel of invalid) {
    assert.throws(
      () => projectParcelLifecycle({
        settlementId: 'seelenberg', baselineYear: 2026, year: 2030,
        baseline: [parcel], receipts: [],
      }),
      { message: 'Invalid or duplicated parcel baseline' },
    )
  }
})

test('legitimate cleared and meadow baselines remain replayable', () => {
  const result = projectParcelLifecycle({
    settlementId: 'brombach', baselineYear: 2026, year: 2030,
    baseline: [
      { parcelId: 'cleared-plot', surface: 'cleared' },
      { parcelId: 'park', surface: 'meadow' },
    ],
    receipts: [],
  })
  assert.deepEqual(result.parcels, [
    { parcelId: 'cleared-plot', surface: 'cleared' },
    { parcelId: 'park', surface: 'meadow' },
  ])
  assert.deepEqual(result.transitions, [])
  assert.deepEqual(result.rejected, [])
})
