import { projectFeedbackReceiptList as project } from './feedbackReceiptList'
const assert = (condition: boolean, message: string) => { if (!condition) throw Error(message) }
const make = (id: string, date: string) => ({ id, title: 'Gemeinsame Werkstatt', status: 'under_review', created_at: date, private_source_ref: 'npc_conversation_log:42' })
const a = make('123e4567-e89b-42d3-a456-426614174000', '2026-10-30T06:00:00Z')
const b = make('123e4567-e89b-42d3-a456-426614174001', '2026-10-31T06:00:00Z')
const list = project([a, b], 1)
assert(list !== null && list.length === 1 && list[0].id === b.id, 'newest first with limit')
assert(!JSON.stringify(list).includes('npc_conversation_log'), 'private provenance excluded')
assert(project([a, { ...b, status: 'approved' }]) === null, 'fail closed on corrupt status')
assert(project([a], 0) === null && project([a], 101) === null && project(null) === null, 'invalid paging rejected')
assert(project(Array.from({ length: 101 }, () => a)) === null, 'unbounded rows rejected')
// Lexicographic ISO sorting is wrong when the same timeline uses different offsets.
const olderOffset = make('123e4567-e89b-42d3-a456-426614174002', '2026-11-01T00:15:00+02:00') // 22:15Z
const newerUtc = make('123e4567-e89b-42d3-a456-426614174003', '2026-10-31T23:45:00Z')
assert(project([olderOffset, newerUtc], 1)?.[0]?.id === newerUtc.id, 'sort by UTC instant across offset and day boundary')
const earlierMicro = make('123e4567-e89b-42d3-a456-426614174004', '2026-10-31T06:00:00.123455Z')
const laterMicro = make('123e4567-e89b-42d3-a456-426614174005', '2026-10-31T06:00:00.123456Z')
assert(project([earlierMicro, laterMicro], 1)?.[0]?.id === laterMicro.id, 'preserve PostgreSQL microsecond ordering')
const sameInstantOffset = make('123e4567-e89b-42d3-a456-426614174006', '2026-10-31T08:00:00.123456+02:00')
assert(project([sameInstantOffset, laterMicro])?.map(item => item.id).join(',') ===
  [laterMicro.id, sameInstantOffset.id].join(','), 'same instant sorted deterministically by id')
const farEarlier = make('123e4567-e89b-42d3-a456-426614174007', '9999-12-31T23:59:59.999998Z')
const farLater = make('123e4567-e89b-42d3-a456-426614174008', '9999-12-31T23:59:59.999999Z')
assert(project([farEarlier, farLater], 1)?.[0]?.id === farLater.id, 'far-future microseconds avoid unsafe Number precision')
console.log('Feedback receipt list tests passed')
