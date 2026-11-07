import { selectFeedbackAttempt as select } from './feedbackSubmissionAttempt'
const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const first = select(null, '{"title":"Werkstatt"}', '11111111-1111-4111-8111-111111111111')
assert(first !== null, 'new attempt')
assert(select(first, first!.body, '22222222-2222-4222-8222-222222222222')?.key === first!.key, 'retry reuses key')
assert(select(first, '{"title":"Wiese"}', '22222222-2222-4222-8222-222222222222')?.key !== first!.key, 'changed draft gets new key')
assert(select({ body: first!.body, key: 'invalid' }, first!.body, '22222222-2222-4222-8222-222222222222')?.key !== 'invalid', 'bad previous key discarded')
assert(select(null, '', '22222222-2222-4222-8222-222222222222') === null, 'empty payload rejected')
assert(select(null, 'x'.repeat(8193), '22222222-2222-4222-8222-222222222222') === null, 'oversized payload rejected')
assert(select(null, 'ä'.repeat(5000), '22222222-2222-4222-8222-222222222222') === null, 'UTF-8 byte cap rejects multibyte oversize')
assert(select(null, 'ä'.repeat(4000), '22222222-2222-4222-8222-222222222222') !== null, 'UTF-8 byte cap accepts bounded multibyte payload')
console.log('Feedback submission attempt tests passed')
