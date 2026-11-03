import test from 'node:test'
import assert from 'node:assert/strict'
import { requireChronicleOptional, requireChronicleRows, requireEarthLocationId, requireUnambiguousChronicleSelector, shouldReadChronicleEvents, resolveChronicleReadLimit, requireCompleteChroniclePage, requireChronicleEventRows, requireChronicleTombstoneRows, readCompleteChroniclePages } from './buildingChronicleReadGuard.ts'

test('Core query errors cannot become empty histories', () => {
  for (const source of ['simulation_events', 'earth_cleared_buildings', 'tile_entities.existing']) {
    assert.throws(() => requireChronicleRows({ data: null, error: { message: 'database unavailable' } }, source), /Core read failed/)
    assert.throws(() => requireChronicleRows({ data: [], error: { message: 'partial result' } }, source), /Core read failed/)
    assert.throws(() => requireChronicleRows({ data: null, error: null }, source), /Core read incomplete/)
    assert.deepEqual(requireChronicleRows({ data: [], error: null }, source), [])
  }
})

test('source_ref and Earth lookup failures are not interpreted as not found', () => {
  assert.throws(() => requireChronicleOptional({ data: null, error: { message: 'timeout' } }, 'tile_entities.source_ref'), /Core read failed/)
  assert.throws(() => requireChronicleOptional({ data: null, error: undefined }, 'locations.earth'), /Core read failed/)
  assert.throws(() => requireChronicleOptional({ data: undefined, error: null }, 'locations.earth'), /Core read failed/)
  assert.equal(requireChronicleOptional({ data: null, error: null }, 'tile_entities.source_ref'), null)
  assert.deepEqual(requireChronicleOptional({ data: { id: 'entity-1' }, error: null }, 'tile_entities.source_ref'), { id: 'entity-1' })
})

test('Earth must be resolved before a chronicle can query events', () => {
  assert.throws(() => requireEarthLocationId(null), /locations\.earth/)
  assert.throws(() => requireEarthLocationId({ id: ' ' }), /locations\.earth/)
  assert.equal(requireEarthLocationId({ id: 'earth-uuid' }), 'earth-uuid')
})

test('unresolved source references never fall back to an all-Earth event scan', () => {
  assert.equal(shouldReadChronicleEvents('osm:unknown', null), false)
  assert.equal(shouldReadChronicleEvents('osm:known', 'entity-uuid'), true)
  assert.equal(shouldReadChronicleEvents(null, null), true)
})

test('a caller cannot combine unrelated entity events and source-ref tombstones', () => {
  assert.throws(
    () => requireUnambiguousChronicleSelector('entity-uuid', 'osm:another-building'),
    /ambiguous: building selectors/,
  )
  for (const [entityId, sourceRef] of [
    ['entity-uuid', null],
    [null, 'osm:building'],
    [null, null],
  ]) {
    assert.doesNotThrow(() => requireUnambiguousChronicleSelector(entityId, sourceRef))
  }
})

test('blank building selectors cannot silently broaden the Core event query', () => {
  for (const [entityId, sourceRef] of [
    ['', null], ['   ', null], [null, ''], [null, '  '],
    ['', 'osm:building'], ['entity-uuid', ' '],
  ]) {
    assert.throws(
      () => requireUnambiguousChronicleSelector(entityId, sourceRef),
      /invalid: blank or malformed building selector/,
    )
  }
  assert.doesNotThrow(() => requireUnambiguousChronicleSelector(null, null))
})

test('chronicle page limits reject invalid runtime payloads before querying Core', () => {
  for (const invalid of [NaN, Infinity, -Infinity, '200', {}, [], true]) {
    assert.throws(() => resolveChronicleReadLimit(invalid), /invalid: limit/)
  }
  assert.equal(resolveChronicleReadLimit(undefined), 200)
  assert.equal(resolveChronicleReadLimit(null), 200)
  assert.equal(resolveChronicleReadLimit(0), 1)
  assert.equal(resolveChronicleReadLimit(-10), 1)
  assert.equal(resolveChronicleReadLimit(3.9), 3)
  assert.equal(resolveChronicleReadLimit(501), 500)
  assert.equal(resolveChronicleReadLimit(Number.MAX_VALUE), 500)
})

test('malformed runtime selectors are rejected before constructing Core queries', () => {
  for (const [entityId, sourceRef] of [
    [0, null], [false, null], [{ id: 'entity-uuid' }, null],
    [[], null], [null, 0], [null, true], [null, {}], [null, ['osm:building']],
  ]) {
    assert.throws(
      () => requireUnambiguousChronicleSelector(entityId, sourceRef),
      /invalid: blank or malformed building selector/,
    )
  }
})


test('chronicle page sentinel rejects truncated Core histories instead of silently dropping receipts', () => {
  const rows = [{ id: 'first' }, { id: 'second' }, { id: 'sentinel' }]
  assert.deepEqual(requireCompleteChroniclePage({ data: rows.slice(0, 2), error: null }, 'simulation_events', 2), rows.slice(0, 2))
  assert.throws(
    () => requireCompleteChroniclePage({ data: rows, error: null }, 'simulation_events', 2),
    /Core read incomplete: simulation_events exceeds page limit/,
  )
  assert.throws(
    () => requireCompleteChroniclePage({ data: rows, error: null }, 'earth_cleared_buildings', 2),
    /Core read incomplete: earth_cleared_buildings exceeds page limit/,
  )
  assert.throws(
    () => requireCompleteChroniclePage({ data: null, error: { message: 'timeout' } }, 'simulation_events', 2),
    /Core read failed/,
  )
  assert.throws(
    () => requireCompleteChroniclePage({ data: null, error: null }, 'simulation_events', 2),
    /Core read incomplete/,
  )
  assert.throws(
    () => requireCompleteChroniclePage({ data: [], error: null }, 'simulation_events', 0),
    /invalid: page limit/,
  )
})

test('malformed persisted event receipts fail closed before historical projection', () => {
  const valid = { id: 'event-1', subject_id: 'building-1', event_type: 'entity.deleted', occurred_at: '2026-11-02T20:00:00Z' }
  assert.deepEqual(requireChronicleEventRows({ data: [valid], error: null }, 'simulation_events', 5), [valid])
  for (const invalid of [
    null, {}, { ...valid, id: '' }, { ...valid, subject_id: null },
    { ...valid, event_type: 'unknown' }, { ...valid, occurred_at: '' },
    { ...valid, subject_id: 123 }, { ...valid, occurred_at: null },
    { ...valid, occurred_at: 'yesterday' }, { ...valid, occurred_at: '2026-11-02' },
  ]) {
    assert.throws(
      () => requireChronicleEventRows({ data: [invalid], error: null }, 'simulation_events', 5),
      /Core read invalid: simulation_events event receipt/,
    )
  }
  assert.throws(
    () => requireChronicleEventRows({ data: [valid, valid], error: null }, 'simulation_events', 1),
    /Core read incomplete: simulation_events exceeds page limit/,
  )
})

test('malformed demolition tombstones cannot become authoritative history', () => {
  const valid = { source_ref: 'osm:way/123', profile_id: null, display_name: 'Old house', cleared_at: '2026-11-02T20:00:00+00:00' }
  assert.deepEqual(requireChronicleTombstoneRows({ data: [valid], error: null }, 'earth_cleared_buildings', 5), [valid])
  assert.doesNotThrow(() => requireChronicleTombstoneRows({
    data: [{ ...valid, cleared_at: '2026-11-02T20:00:00.123456Z', profile_id: 'profile-1', display_name: null }],
    error: null,
  }, 'earth_cleared_buildings', 5))
  for (const invalid of [
    null, {}, { ...valid, source_ref: '' }, { ...valid, source_ref: '  ' },
    { ...valid, source_ref: 123 }, { ...valid, cleared_at: null },
    { ...valid, cleared_at: 'not-a-date' }, { ...valid, cleared_at: '2026-11-02' },
    { ...valid, profile_id: 1 }, { ...valid, profile_id: '' },
    { ...valid, display_name: [] },
  ]) {
    assert.throws(
      () => requireChronicleTombstoneRows({ data: [invalid], error: null }, 'earth_cleared_buildings', 5),
      /Core read invalid: earth_cleared_buildings tombstone/,
    )
  }
  assert.throws(
    () => requireChronicleTombstoneRows({ data: [valid, valid], error: null }, 'earth_cleared_buildings', 1),
    /Core read incomplete: earth_cleared_buildings exceeds page limit/,
  )
})

test('Core receipt timestamps reject calendar normalization and invalid UTC offsets', () => {
  const event = { id: 'event-1', subject_id: 'building-1', event_type: 'entity.created', occurred_at: '2024-02-29T23:59:59Z' }
  const stone = { source_ref: 'osm:way/123', profile_id: null, display_name: null, cleared_at: event.occurred_at }
  assert.doesNotThrow(() => requireChronicleEventRows({ data: [event], error: null }, 'simulation_events', 5))
  assert.doesNotThrow(() => requireChronicleTombstoneRows({ data: [stone], error: null }, 'earth_cleared_buildings', 5))
  for (const invalid of [
    '2026-02-29T12:00:00Z', '2026-02-30T12:00:00Z',
    '2026-11-31T00:00:00Z', '2026-11-02T24:00:00Z',
    '2026-11-02T20:00:00+14:01', '2026-11-02T20:00:00-15:00',
    '2026-11-02T20:60:00Z', '2026-11-02T20:00:60Z',
  ]) {
    assert.throws(
      () => requireChronicleEventRows({ data: [{ ...event, occurred_at: invalid }], error: null }, 'simulation_events', 5),
      /Core read invalid: simulation_events event receipt/,
      invalid,
    )
    assert.throws(
      () => requireChronicleTombstoneRows({ data: [{ ...stone, cleared_at: invalid }], error: null }, 'earth_cleared_buildings', 5),
      /Core read invalid: earth_cleared_buildings tombstone/,
      invalid,
    )
  }
})

test('paginates Core rows until empty and preserves all receipts', async () => {
  const source = Array.from({ length: 5 }, (_, i) => ({ id: 'event-' + i, subject_id: 'building-1', event_type: 'entity.updated', occurred_at: '2026-11-02T20:00:00Z' }))
  const calls = []
  const rows = await readCompleteChroniclePages(async (from, to) => {
    calls.push([from, to])
    return { data: source.slice(from, to + 1), error: null }
  }, requireChronicleEventRows, 'simulation_events', 2, row => row.id)
  assert.deepEqual(rows, source)
  assert.deepEqual(calls, [[0, 1], [2, 3], [4, 5], [5, 6]])
})

test('short PostgREST pages cannot silently truncate a building chronicle', async () => {
  const source = Array.from({ length: 4 }, (_, i) => ({
    source_ref: 'osm:way/' + i, profile_id: null, display_name: null, cleared_at: '2026-11-02T20:00:00Z',
  }))
  const rows = await readCompleteChroniclePages(
    async from => ({ data: source.slice(from, from + 1), error: null }),
    requireChronicleTombstoneRows, 'earth_cleared_buildings', 3, row => row.source_ref,
  )
  assert.deepEqual(rows, source)
})

test('bounded pagination accepts exact cap but fails closed on overflow', async () => {
  const source = Array.from({ length: 4 }, (_, i) => ({ id: 'event-' + i, subject_id: 'building-1', event_type: 'entity.updated', occurred_at: '2026-11-02T20:00:00Z' }))
  const fetch = async (from, to) => ({ data: source.slice(from, to + 1), error: null })
  assert.deepEqual(
    await readCompleteChroniclePages(fetch, requireChronicleEventRows, 'simulation_events', 2, row => row.id, 4),
    source,
  )
  await assert.rejects(
    readCompleteChroniclePages(fetch, requireChronicleEventRows, 'simulation_events', 2, row => row.id, 3),
    /exceeds maximum history/,
  )
})

test('pagination rejects read errors, missing collections, duplicates and bad bounds', async () => {
  const valid = { id: 'same', subject_id: 'building-1', event_type: 'entity.updated', occurred_at: '2026-11-02T20:00:00Z' }
  await assert.rejects(readCompleteChroniclePages(
    async () => ({ data: null, error: { message: 'timeout' } }),
    requireChronicleEventRows, 'simulation_events', 2, row => row.id,
  ), /Core read failed/)
  await assert.rejects(readCompleteChroniclePages(
    async () => ({ data: null, error: null }),
    requireChronicleEventRows, 'simulation_events', 2, row => row.id,
  ), /Core read incomplete/)
  await assert.rejects(readCompleteChroniclePages(
    async () => ({ data: [valid], error: null }),
    requireChronicleEventRows, 'simulation_events', 2, row => row.id, 3,
  ), /duplicate or missing row key/)
  await assert.rejects(readCompleteChroniclePages(
    async () => ({ data: [], error: null }),
    requireChronicleEventRows, 'simulation_events', 0, row => row.id,
  ), /pagination bounds/)
})

test('pagination limits database roundtrips even for tiny caller page sizes', async () => {
  let calls = 0
  await assert.rejects(readCompleteChroniclePages(async () => {
    calls += 1
    return { data: [{ id: 'event-' + calls, subject_id: 'building-1', event_type: 'entity.updated', occurred_at: '2026-11-02T20:00:00Z' }], error: null }
  }, requireChronicleEventRows, 'simulation_events', 1, row => row.id, 100, 3), /exceeds page budget/)
  assert.equal(calls, 3)
})
