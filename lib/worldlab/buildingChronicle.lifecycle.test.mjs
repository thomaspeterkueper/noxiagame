import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChronicle, buildingStateAt, verifiedBuildingStateAt } from './buildingChronicle.ts'

const receipt = (id, from, to) => ({
  id, event_type: 'entity.updated', subject_id: 'house-1', actor_id: 'owner-1',
  occurred_at: '2026-11-04T04:00:00Z',
  effects: [{ from, to }], metadata: {},
})
const project = events => buildChronicle({ events, tombstones: [], existingEntityIds: new Set(['house-1']), viewerProfileId: 'owner-1' })

test('documented extension is a remodel, not a demolition or new building', () => {
  const result = project([receipt('r1', { building_levels: 1 }, { building_levels: 2 })])
  assert.equal(result.entries[0].kind, 'remodeled')
  assert.deepEqual(result.entries[0].detail.fields, ['building_levels'])
  assert.equal(buildingStateAt(result, { subjectId: 'house-1' }, '2026-11-05T00:00:00Z'), 'standing')
})

test('change of use and simultaneous remodel retain both evidence dimensions', () => {
  const result = project([receipt('r2', { building_use: 'residential', height: 4 }, { building_use: 'shop', height: 6 })])
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].kind, 'remodeled')
  assert.equal(result.entries[0].detail.remodeled, true)
  assert.equal(result.entries[0].detail.repurposed, true)
  assert.equal(buildingStateAt(result, { subjectId: 'house-1' }, '2026-11-05T00:00:00Z'), 'standing')
  assert.equal(project([receipt('r3', { building_use: 'house' }, { building_use: 'library' })]).entries[0].kind, 'repurposed')
})

test('generic changes are not invented as remodels and owner changes retain precedence', () => {
  assert.equal(project([receipt('r4', { display_name: 'Old' }, { display_name: 'New' })]).entries[0].kind, 'changed')
  assert.equal(project([receipt('r5', { owner_id: 'a', height: 3 }, { owner_id: 'b', height: 5 })]).entries[0].kind, 'owner_changed')
})

test('persisted metadata and actor cannot self-attest authorization', () => {
  const event = { ...receipt('r6', { height: 3 }, { height: 5 }), metadata: { committed: true, authorized: true } }
  const unverified = project([event])
  assert.equal(unverified.entries[0].kind, 'remodeled')
  assert.equal(unverified.entries[0].authorized, false)
  const verified = buildChronicle({
    events: [event], tombstones: [], existingEntityIds: new Set(['house-1']),
    viewerProfileId: 'owner-1', verifiedReceiptIds: new Set(['r6']),
  })
  assert.equal(verified.entries[0].authorized, true)
  assert.equal(buildingStateAt(unverified, { subjectId: 'house-1' }, '2026-11-05T00:00:00Z'), 'standing')
})


test('verified projection rejects mixed or missing identity selectors', () => {
  const created = {
    id: 'created-1', event_type: 'entity.created', subject_id: 'house-1',
    actor_id: 'owner-1', occurred_at: '2026-11-04T04:00:00Z',
    effects: [], metadata: {},
  }
  const chronicle = buildChronicle({
    events: [created], tombstones: [{ source_ref: 'osm:other-house', profile_id: 'owner-1', cleared_at: '2026-11-04T05:00:00Z' }],
    existingEntityIds: new Set(['house-1']), viewerProfileId: 'owner-1',
    verifiedReceiptIds: new Set(['created-1']), verifiedTombstoneRefs: new Set(['osm:other-house']),
  })
  const at = '2026-11-05T00:00:00Z'
  assert.equal(verifiedBuildingStateAt(chronicle, { subjectId: 'house-1' }, at), 'standing')
  assert.equal(verifiedBuildingStateAt(chronicle, { sourceRef: 'osm:other-house' }, at), 'demolished')
  assert.equal(verifiedBuildingStateAt(chronicle, { subjectId: 'house-1', sourceRef: 'osm:other-house' }, at), 'unknown')
  assert.equal(verifiedBuildingStateAt(chronicle, {}, at), 'unknown')
})

test('historical viewer rejects mixed and missing building identities', () => {
  const chronicle = buildChronicle({
    events: [{
      id: 'created-historical', event_type: 'entity.created', subject_id: 'house-1',
      actor_id: 'owner-1', occurred_at: '2026-11-04T04:00:00Z',
      effects: [], metadata: {},
    }],
    tombstones: [{ source_ref: 'osm:other-house', profile_id: 'owner-1', cleared_at: '2026-11-04T05:00:00Z' }],
    existingEntityIds: new Set(['house-1']), viewerProfileId: 'owner-1',
  })
  const at = '2026-11-05T00:00:00Z'
  assert.equal(buildingStateAt(chronicle, { subjectId: 'house-1' }, at), 'standing')
  assert.equal(buildingStateAt(chronicle, { sourceRef: 'osm:other-house' }, at), 'demolished')
  assert.equal(buildingStateAt(chronicle, { subjectId: 'house-1', sourceRef: 'osm:other-house' }, at), 'unknown')
  assert.equal(buildingStateAt(chronicle, {}, at), 'unknown')
})
