import test from 'node:test'
import assert from 'node:assert/strict'
import { requireChronicleOptional, requireChronicleRows, requireEarthLocationId, requireUnambiguousChronicleSelector, shouldReadChronicleEvents, resolveChronicleReadLimit } from './buildingChronicleReadGuard.ts'

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
      /invalid: blank building selector/,
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
