import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChronicle, verifiedBuildingStateAt } from './buildingChronicle.ts'

// A timestamp is not a committed Core execution sequence. A verified create
// and demolition at the same instant must never be resolved by event ID order.
test('equal-time construction and demolition remain unknown regardless of IDs and input order', () => {
  const at = '2026-11-05T04:00:00Z'
  for (const [createId, deleteId] of [['a-create', 'z-delete'], ['z-create', 'a-delete']]) {
    const create = { id: createId, event_type: 'entity.created', subject_id: 'seelenberg-house',
      actor_id: 'owner', occurred_at: at, effects: [], metadata: {} }
    const remove = { id: deleteId, event_type: 'entity.deleted', subject_id: 'seelenberg-house',
      actor_id: 'owner', occurred_at: at, effects: [], metadata: { deletion_kind: 'demolition' } }
    for (const events of [[create, remove], [remove, create]]) {
      const chronicle = buildChronicle({
        events, tombstones: [], existingEntityIds: new Set(), viewerProfileId: null,
        verifiedReceiptIds: new Set([createId, deleteId]),
      })
      assert.equal(verifiedBuildingStateAt(chronicle, { subjectId: 'seelenberg-house' }, at), 'unknown')
    }
  }
})

test('later independently verified construction may resolve an earlier equal-time conflict', () => {
  const events = [
    { id: 'create', event_type: 'entity.created', subject_id: 'brombach-house', actor_id: 'owner',
      occurred_at: '2026-11-05T04:00:00Z', effects: [], metadata: {} },
    { id: 'delete', event_type: 'entity.deleted', subject_id: 'brombach-house', actor_id: 'owner',
      occurred_at: '2026-11-05T04:00:00Z', effects: [], metadata: { deletion_kind: 'demolition' } },
    { id: 'later-create', event_type: 'entity.created', subject_id: 'brombach-house', actor_id: 'owner',
      occurred_at: '2026-11-05T05:00:00Z', effects: [], metadata: {} },
  ]
  const chronicle = buildChronicle({
    events, tombstones: [], existingEntityIds: new Set(['brombach-house']), viewerProfileId: null,
    verifiedReceiptIds: new Set(events.map(event => event.id)),
  })
  const key = { subjectId: 'brombach-house' }
  assert.equal(verifiedBuildingStateAt(chronicle, key, '2026-11-05T04:30:00Z'), 'unknown')
  assert.equal(verifiedBuildingStateAt(chronicle, key, '2026-11-05T05:00:00Z'), 'standing')
})
