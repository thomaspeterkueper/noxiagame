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
  assert.equal(buildingStateAt(result, { subjectId: 'house-1' }, '2026-11-05T00:00:00Z'), 'unknown')
})

test('change of use and simultaneous remodel retain both evidence dimensions', () => {
  const result = project([receipt('r2', { building_use: 'residential', height: 4 }, { building_use: 'shop', height: 6 })])
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].kind, 'remodeled')
  assert.equal(result.entries[0].detail.remodeled, true)
  assert.equal(result.entries[0].detail.repurposed, true)
  assert.equal(buildingStateAt(result, { subjectId: 'house-1' }, '2026-11-05T00:00:00Z'), 'unknown')
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
  assert.equal(buildingStateAt(unverified, { subjectId: 'house-1' }, '2026-11-05T00:00:00Z'), 'unknown')
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

test('verified ownership transfer cannot resurrect a demolished building', () => {
  const events = [
    { id: 'build', event_type: 'entity.created', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-01T10:00:00Z', effects: [], metadata: {} },
    { id: 'demolish', event_type: 'entity.deleted', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-02T10:00:00Z', effects: [], metadata: { deletion_kind: 'demolition' } },
    { ...receipt('transfer', { owner_id: 'owner-1' }, { owner_id: 'owner-2' }), occurred_at: '2026-11-03T10:00:00Z' },
  ]
  const chronicle = buildChronicle({
    events, tombstones: [], existingEntityIds: new Set(), viewerProfileId: 'owner-1',
    verifiedReceiptIds: new Set(['build', 'demolish', 'transfer']),
  })
  assert.equal(chronicle.entries.at(-1).kind, 'owner_changed')
  assert.equal(verifiedBuildingStateAt(chronicle, { subjectId: 'house-1' }, '2026-11-02T11:00:00Z'), 'demolished')
  assert.equal(verifiedBuildingStateAt(chronicle, { subjectId: 'house-1' }, '2026-11-04T00:00:00Z'), 'unknown')
})


test('only a later verified creation restores existence after demolition and ownership transfer', () => {
  const events = [
    { id: 'built-a', event_type: 'entity.created', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-01T10:00:00Z', effects: [], metadata: {} },
    { id: 'removed-a', event_type: 'entity.deleted', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-02T10:00:00Z', effects: [], metadata: { deletion_kind: 'demolition' } },
    { ...receipt('owner-transfer', { owner_id: 'owner-1' }, { owner_id: 'owner-2' }), occurred_at: '2026-11-03T10:00:00Z' },
    { id: 'rebuilt-a', event_type: 'entity.created', subject_id: 'house-1', actor_id: 'owner-2', occurred_at: '2026-11-04T10:00:00Z', effects: [], metadata: {} },
  ]
  const beforeVerification = buildChronicle({
    events, tombstones: [], existingEntityIds: new Set(['house-1']), viewerProfileId: 'owner-1',
    verifiedReceiptIds: new Set(['built-a', 'removed-a', 'owner-transfer']),
  })
  const afterVerification = buildChronicle({
    events, tombstones: [], existingEntityIds: new Set(['house-1']), viewerProfileId: 'owner-1',
    verifiedReceiptIds: new Set(['built-a', 'removed-a', 'owner-transfer', 'rebuilt-a']),
  })
  const key = { subjectId: 'house-1' }
  assert.equal(verifiedBuildingStateAt(beforeVerification, key, '2026-11-02T11:00:00Z'), 'demolished')
  assert.equal(verifiedBuildingStateAt(beforeVerification, key, '2026-11-03T11:00:00Z'), 'unknown')
  assert.equal(verifiedBuildingStateAt(beforeVerification, key, '2026-11-04T11:00:00Z'), 'unknown')
  assert.equal(verifiedBuildingStateAt(afterVerification, key, '2026-11-04T11:00:00Z'), 'standing')
})


test('historical ownership change does not imply reconstruction after demolition', () => {
  const events = [
    { id: 'hist-build', event_type: 'entity.created', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-01T10:00:00Z', effects: [], metadata: {} },
    { id: 'hist-remove', event_type: 'entity.deleted', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-02T10:00:00Z', effects: [], metadata: { deletion_kind: 'demolition' } },
    { ...receipt('hist-transfer', { owner_id: 'owner-1' }, { owner_id: 'owner-2' }), occurred_at: '2026-11-03T10:00:00Z' },
  ]
  const chronicle = buildChronicle({ events, tombstones: [], existingEntityIds: new Set(), viewerProfileId: 'owner-1' })
  assert.equal(buildingStateAt(chronicle, { subjectId: 'house-1' }, '2026-11-02T11:00:00Z'), 'demolished')
  assert.equal(buildingStateAt(chronicle, { subjectId: 'house-1' }, '2026-11-03T11:00:00Z'), 'unknown')
})


test('future Core receipts never change a historical building snapshot', () => {
  const events = [
    { id: 'future-built', event_type: 'entity.created', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-07T10:00:00Z', effects: [], metadata: {} },
    { id: 'past-built', event_type: 'entity.created', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-01T10:00:00Z', effects: [], metadata: {} },
    { id: 'future-demolished', event_type: 'entity.deleted', subject_id: 'house-1', actor_id: 'owner-1', occurred_at: '2026-11-09T10:00:00Z', effects: [], metadata: { deletion_kind: 'demolition' } },
  ]
  const chronicle = buildChronicle({
    events, tombstones: [], existingEntityIds: new Set(), viewerProfileId: 'owner-1',
    verifiedReceiptIds: new Set(events.map(event => event.id)),
  })
  const key = { subjectId: 'house-1' }
  assert.equal(verifiedBuildingStateAt(chronicle, key, '2026-10-31T23:59:59Z'), 'unknown')
  assert.equal(verifiedBuildingStateAt(chronicle, key, '2026-11-01T10:00:00Z'), 'standing')
  assert.equal(verifiedBuildingStateAt(chronicle, key, '2026-11-08T00:00:00Z'), 'standing')
  assert.equal(verifiedBuildingStateAt(chronicle, key, '2026-11-09T10:00:00Z'), 'demolished')
})
