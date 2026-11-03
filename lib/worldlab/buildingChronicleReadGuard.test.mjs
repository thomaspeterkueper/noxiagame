import test from 'node:test'
import assert from 'node:assert/strict'
import { requireChronicleOptional, requireChronicleRows, requireEarthLocationId, requireUnambiguousChronicleSelector, shouldReadChronicleEvents, resolveChronicleReadLimit, requireCompleteChroniclePage, requireChronicleEventRows, requireChronicleTombstoneRows, readCompleteChroniclePages, readChronicleKeysetPages, chronicleKeysetFilter, compareChronicleInstants } from './buildingChronicleReadGuard.ts'

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

test('keyset pagination survives deletion before the cursor without skipping rows', async () => {
  const source = ['d', 'c', 'b', 'a'].map(id => ({ id, occurred_at: '2026-11-02T20:00:00Z' }))
  const calls = []
  const rows = await readChronicleKeysetPages(async (cursor, limit) => {
    calls.push(cursor?.id ?? null)
    if (cursor?.id === 'c') source.splice(source.findIndex(row => row.id === 'd'), 1)
    const remaining = source.filter(row => !cursor || row.occurred_at < cursor.timestamp ||
      (row.occurred_at === cursor.timestamp && row.id < cursor.id))
    return { data: remaining.slice(0, limit), error: null }
  }, (result, sourceName, limit) => requireCompleteChroniclePage(result, sourceName, limit),
  'simulation_events', 2, row => ({ timestamp: row.occurred_at, id: row.id }))
  assert.deepEqual(rows.map(row => row.id), ['d', 'c', 'b', 'a'])
  assert.deepEqual(calls, [null, 'c', 'a'])
})

test('keyset reader fails closed on reordered pages and repeated keys', async () => {
  const row = id => ({ id, occurred_at: '2026-11-02T20:00:00Z' })
  for (const badPage of [[row('d')], [row('c'), row('c')]]) {
    let calls = 0
    await assert.rejects(readChronicleKeysetPages(async () => ({
      data: calls++ === 0 ? [row('d'), row('c')] : badPage, error: null,
    }), requireCompleteChroniclePage, 'simulation_events', 2,
    item => ({ timestamp: item.occurred_at, id: item.id })), /cursor order or duplicate/)
  }
})

test('keyset cursor compares actual instants rather than timezone-formatted strings', async () => {
  const rows = [
    { id: 'new', occurred_at: '2026-11-03T00:00:00+02:00' },
    { id: 'old', occurred_at: '2026-11-02T21:00:00Z' },
  ]
  const seen = []
  const result = await readChronicleKeysetPages(async (cursor, limit) => {
    seen.push(cursor?.id ?? null)
    return { data: rows.filter(row => !cursor ||
      Date.parse(row.occurred_at) < Date.parse(cursor.timestamp) ||
      (Date.parse(row.occurred_at) === Date.parse(cursor.timestamp) && row.id < cursor.id)).slice(0, limit), error: null }
  }, requireCompleteChroniclePage, 'simulation_events', 1,
  row => ({ timestamp: row.occurred_at, id: row.id }))
  assert.deepEqual(result.map(row => row.id), ['new', 'old'])
  assert.deepEqual(seen, [null, 'new', 'old'])
})

test('keyset pagination rejects timestamp order reversals even with unique keys', async () => {
  const newer = { id: 'a', occurred_at: '2026-11-03T00:00:00Z' }
  const older = { id: 'z', occurred_at: '2026-11-02T00:00:00Z' }
  let count = 0
  await assert.rejects(readChronicleKeysetPages(async () => ({
    data: count++ === 0 ? [older] : [newer], error: null,
  }), requireCompleteChroniclePage, 'simulation_events', 1,
  row => ({ timestamp: row.occurred_at, id: row.id })), /cursor order or duplicate/)
})

test('PostgREST keyset filters quote timestamps and OSM source references', () => {
  const cursor = { timestamp: '2026-11-03T01:02:03+02:00', id: 'osm:way/12,(special)"\\\\' }
  const filter = chronicleKeysetFilter('cleared_at', 'source_ref', cursor)
  assert.match(filter, /^cleared_at\.lt\."2026-11-03T01:02:03\+02:00",and\(cleared_at\.eq\."2026-11-03T01:02:03\+02:00",source_ref\.lt\."/)
  assert.ok(filter.includes(String.raw`\"`))
  assert.ok(filter.includes(String.raw`\\`))
  assert.throws(() => chronicleKeysetFilter('occurred_at', 'id', { timestamp: 'yesterday', id: 'abc' }), /invalid: cursor/)
  assert.throws(() => chronicleKeysetFilter('occurred_at', 'id', { timestamp: '2026-11-03T00:00:00Z', id: '' }), /invalid: cursor/)
})

test('keyset pagination fails closed at history and request budgets', async () => {
  const row = id => ({ id, occurred_at: '2026-11-03T00:00:00Z' })
  const source = ['d', 'c', 'b', 'a'].map(row)
  const read = async (cursor, limit) => ({
    data: source.filter(item => !cursor || item.id < cursor.id).slice(0, limit), error: null,
  })
  const cursor = item => ({ timestamp: item.occurred_at, id: item.id })
  assert.deepEqual(
    await readChronicleKeysetPages(read, requireCompleteChroniclePage, 'simulation_events', 2, cursor, 4),
    source,
  )
  await assert.rejects(
    readChronicleKeysetPages(read, requireCompleteChroniclePage, 'simulation_events', 2, cursor, 3),
    /exceeds maximum history/,
  )
  await assert.rejects(
    readChronicleKeysetPages(read, requireCompleteChroniclePage, 'simulation_events', 1, cursor, 10, 2),
    /exceeds page budget/,
  )
  await assert.rejects(
    readChronicleKeysetPages(async () => ({ data: null, error: { message: 'timeout' } }),
      requireCompleteChroniclePage, 'simulation_events', 2, cursor),
    /Core read failed/,
  )
  await assert.rejects(
    readChronicleKeysetPages(async () => ({ data: null, error: null }),
      requireCompleteChroniclePage, 'simulation_events', 2, cursor),
    /Core read incomplete/,
  )
})

test('keyset filter rejects malformed runtime column names and absent cursors', () => {
  const valid = { timestamp: '2026-11-03T01:02:03Z', id: 'event-1' }
  for (const [timeColumn, idColumn, cursor] of [
    ['occurred_at);drop table', 'id', valid],
    ['occurred_at', 'id.or(true)', valid],
    ['cleared_at', 'source_ref', null],
    ['cleared_at', 'source_ref', undefined],
  ]) {
    assert.throws(() => chronicleKeysetFilter(timeColumn, idColumn, cursor), /invalid: cursor/)
  }
  assert.ok(chronicleKeysetFilter('occurred_at', 'id', valid).startsWith('occurred_at.lt.'))
})

test('microsecond cursor ordering does not collapse receipts within one millisecond', async () => {
  const newer = { id: 'a', occurred_at: '2026-11-03T00:00:00.123456Z' }
  const older = { id: 'z', occurred_at: '2026-11-03T00:00:00.123455Z' }
  assert.equal(compareChronicleInstants(newer.occurred_at, older.occurred_at), 1)
  assert.equal(compareChronicleInstants('2026-11-03T01:00:00.123456+01:00', newer.occurred_at), 0)
  const rows = await readChronicleKeysetPages(async cursor => ({
    data: !cursor ? [newer] : cursor.id === 'a' ? [older] : [], error: null,
  }), requireCompleteChroniclePage, 'simulation_events', 2,
  row => ({ timestamp: row.occurred_at, id: row.id }), 2, 3)
  assert.deepEqual(rows.map(row => row.id), ['a', 'z'])
  await assert.rejects(readChronicleKeysetPages(async cursor => ({
    data: cursor ? [older] : [newer], error: null,
  }), requireCompleteChroniclePage, 'simulation_events', 2,
  row => ({ timestamp: row.occurred_at, id: row.id }), 2, 3),
  /cursor order or duplicate/)
  await assert.rejects(readChronicleKeysetPages(async () => ({
    data: [newer, older], error: null,
  }), requireCompleteChroniclePage, 'simulation_events', 2,
  row => ({ timestamp: row.occurred_at, id: row.id })), /cursor order or duplicate/)
  assert.throws(() => compareChronicleInstants('2026-11-03T00:00:00.1234567Z', older.occurred_at),
    /sub-microsecond cursor/)
})

test('first-page keyset rows and SQL filters reject sub-microsecond timestamps', async () => {
  const bad = '2026-11-03T00:00:00.1234567Z'
  await assert.rejects(readChronicleKeysetPages(async () => ({
    data: [{ id: 'event-1', occurred_at: bad }], error: null,
  }), requireCompleteChroniclePage, 'simulation_events', 2,
  row => ({ timestamp: row.occurred_at, id: row.id })), /cursor order or duplicate/)
  assert.throws(() => chronicleKeysetFilter('occurred_at', 'id', {
    timestamp: bad, id: 'event-1',
  }), /invalid: cursor/)
  assert.doesNotThrow(() => chronicleKeysetFilter('occurred_at', 'id', {
    timestamp: '2026-11-03T00:00:00.123456000Z', id: 'event-1',
  }))
})

test('keyset pages preserve equal-timestamp ID tie breaks across boundaries', async () => {
  const rows = [
    { id: 'c', occurred_at: '2026-11-03T00:00:00.123456Z' },
    { id: 'b', occurred_at: '2026-11-03T01:00:00.123456+01:00' },
    { id: 'a', occurred_at: '2026-11-03T00:00:00.123456Z' },
  ]
  const seenCursors = []
  const result = await readChronicleKeysetPages(async (cursor, limit) => {
    seenCursors.push(cursor?.id ?? null)
    return {
      data: rows.filter(row => !cursor ||
        compareChronicleInstants(row.occurred_at, cursor.timestamp) < 0 ||
        (compareChronicleInstants(row.occurred_at, cursor.timestamp) === 0 && row.id < cursor.id)
      ).slice(0, limit),
      error: null,
    }
  }, requireCompleteChroniclePage, 'simulation_events', 1,
  row => ({ timestamp: row.occurred_at, id: row.id }), 3, 5)
  assert.deepEqual(result.map(row => row.id), ['c', 'b', 'a'])
  assert.deepEqual(seenCursors, [null, 'c', 'b', 'a'])
  await assert.rejects(readChronicleKeysetPages(async cursor => ({
    data: cursor ? [{ id: 'd', occurred_at: '2026-11-03T00:00:00.123456Z' }] : [rows[0]],
    error: null,
  }), requireCompleteChroniclePage, 'simulation_events', 1,
  row => ({ timestamp: row.occurred_at, id: row.id })), /cursor order or duplicate/)
})
