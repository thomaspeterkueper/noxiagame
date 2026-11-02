import test from 'node:test'
import assert from 'node:assert/strict'
import { requireChronicleOptional, requireChronicleRows, requireEarthLocationId, shouldReadChronicleEvents } from './buildingChronicleReadGuard.ts'

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
