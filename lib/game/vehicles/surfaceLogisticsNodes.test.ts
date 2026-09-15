import assert from 'node:assert/strict'
import {
  resolveSurfaceLogisticsEndpoints,
  resolveSurfaceLogisticsNode,
} from './surfaceLogisticsNodes'

const entities = [
  { id: 'tile-1', entity_id: 'habitat-1', x_m: 120, y_m: -45 },
  { id: 'tile-2', entity_id: 'mine-1', x_m: '300', y_m: '50' },
]

{
  const resolved = resolveSurfaceLogisticsNode({
    id: 'inv-meta',
    subject_id: 'habitat-1',
    metadata: { xM: 10, yM: 20 },
  }, entities)
  assert.deepEqual(resolved, {
    inventoryId: 'inv-meta',
    point: { xM: 10, yM: 20 },
    source: 'inventory-metadata',
    spatialEntityId: null,
  })
}

{
  const resolved = resolveSurfaceLogisticsNode({
    id: 'inv-entity',
    subject_id: 'mine-1',
  }, entities)
  assert.deepEqual(resolved, {
    inventoryId: 'inv-entity',
    point: { xM: 300, yM: 50 },
    source: 'spatial-entity',
    spatialEntityId: 'tile-2',
  })
}

{
  const resolved = resolveSurfaceLogisticsNode({
    id: 'inv-bad-meta',
    subject_id: 'habitat-1',
    metadata: { xM: '', yM: 20 },
  }, entities)
  assert.equal(resolved?.source, 'spatial-entity')
  assert.deepEqual(resolved?.point, { xM: 120, yM: -45 })
}

{
  const endpoints = resolveSurfaceLogisticsEndpoints(
    { id: 'origin', subject_id: 'habitat-1' },
    { id: 'destination', subject_id: 'mine-1' },
    entities,
  )
  assert.equal(endpoints.status, 'resolved')
  if (endpoints.status === 'resolved') {
    assert.deepEqual(endpoints.origin.point, { xM: 120, yM: -45 })
    assert.deepEqual(endpoints.destination.point, { xM: 300, yM: 50 })
  }
}

{
  const endpoints = resolveSurfaceLogisticsEndpoints(
    { id: 'origin', subject_id: 'missing' },
    { id: 'destination', subject_id: 'mine-1' },
    entities,
  )
  assert.equal(endpoints.status, 'unresolved')
  if (endpoints.status === 'unresolved') {
    assert.equal(endpoints.reason, 'origin-unresolved')
    assert.equal(endpoints.origin, null)
    assert.deepEqual(endpoints.destination?.point, { xM: 300, yM: 50 })
  }
}

console.log('surfaceLogisticsNodes tests passed')
